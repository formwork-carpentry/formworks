/**
 * @module @formwork/cli
 * @description DevServer — watches source files and auto-restarts the application
 * on changes. Provides the `carpenter dev` command for local development.
 *
 * WHY: During development, restarting the server after every code change is tedious.
 * DevServer watches the file system and restarts automatically, keeping the
 * feedback loop tight. It also provides hooks for build steps (TypeScript
 * compilation, asset bundling) before restart.
 *
 * HOW: Uses node:fs.watch to monitor source directories. On change, it
 * debounces (waits for rapid saves to settle), runs optional build steps,
 * then restarts the child process. Output is piped through with color coding.
 *
 * NOTE: This is NOT browser HMR (Vite/webpack-style). It's server-side
 * auto-restart, like nodemon. For browser HMR, use the Vite integration
 * with @formwork/ui.
 *
 * @patterns Observer (file system events), Template Method (restart lifecycle)
 * @principles SRP (file watching + process management only)
 *
 * @example
 * ```ts
 * const server = new DevServer({
 *   entry: 'src/server.ts',
 *   watch: ['src'],
 *   ignore: ['node_modules', 'dist', '.git'],
 *   extensions: ['.ts', '.json'],
 *   debounceMs: 300,
 *   onRestart: () => console.log('Restarting...'),
 * });
 *
 * await server.start(); // Watches files and auto-restarts
 * ```
 */

import { type ChildProcess, spawn } from "node:child_process";
import { type FSWatcher, watch } from "node:fs";
import { extname } from "node:path";

// ── Types ─────────────────────────────────────────────────

export interface DevServerConfig {
  /** Entry file to run (e.g., 'src/server.ts') */
  entry: string;
  /** Directories to watch for changes (default: ['src']) */
  watch?: string[];
  /** Patterns to ignore (default: ['node_modules', 'dist', '.git']) */
  ignore?: string[];
  /** File extensions to watch (default: ['.ts', '.js', '.json']) */
  extensions?: string[];
  /** Debounce time in ms — wait for rapid saves to settle (default: 300) */
  debounceMs?: number;
  /** Runtime to use (default: 'node') — can be 'bun', 'deno', etc. */
  runtime?: string;
  /** Additional args passed to the runtime */
  runtimeArgs?: string[];
  /** Callback fired before each restart */
  onRestart?: (changedFile: string) => void;
  /** Callback fired on server start */
  onStart?: () => void;
  /** Callback fired on server error */
  onError?: (error: Error) => void;
  /** Environment variables to pass to the child process */
  env?: Record<string, string>;
}

/** Runtime state of the dev server */
export interface DevServerState {
  running: boolean;
  restartCount: number;
  lastRestart: number;
  watchedFiles: number;
  pid: number | null;
}

// ── Dev Server ────────────────────────────────────────────

/**
 * Watches configured paths and restarts the child runtime when sources change (debounced).
 * Prefer constructing with {@link DevServerConfig} and calling {@link DevServer.start}.
 *
 * @example
 * ```ts
 * import { DevServer } from '@formwork/cli';
 *
 * const dev = new DevServer({ entry: 'src/server.ts', watch: ['src'], debounceMs: 250 });
 * await dev.start();
 * ```
 *
 * @see DevServerConfig
 */
export class DevServer {
  private config: Required<DevServerConfig>;
  private child: ChildProcess | null = null;
  private watchers: FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private restartCount = 0;
  private lastRestart = 0;
  private watchedFileCount = 0;
  private stopped = false;

  constructor(config: DevServerConfig) {
    this.config = {
      entry: config.entry,
      watch: config.watch ?? ["src"],
      ignore: config.ignore ?? ["node_modules", "dist", ".git", ".turbo"],
      extensions: config.extensions ?? [".ts", ".js", ".json"],
      debounceMs: config.debounceMs ?? 300,
      runtime: config.runtime ?? "node",
      runtimeArgs: config.runtimeArgs ?? ["--import", "tsx"],
      onRestart: config.onRestart ?? (() => {}),
      onStart: config.onStart ?? (() => {}),
      onError: config.onError ?? (() => {}),
      env: config.env ?? {},
    };
  }

  /**
   * Start the dev server — launches the child process and begins watching files.
   * @returns {Promise<void>} Resolves when watchers are set up
   */
  async start(): Promise<void> {
    this.stopped = false;
    this.spawnChild();
    await this.setupWatchers();
    this.config.onStart();
  }

  /**
   * Stop the dev server — kills the child process and closes all watchers.
   * @returns {void}
   */
  stop(): void {
    this.stopped = true;
    this.killChild();
    this.closeWatchers();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  /**
   * Get current state (for monitoring/testing).
   * @returns {DevServerState} Running status, restart count, PID
   */
  getState(): DevServerState {
    return {
      running: this.child !== null && !this.child.killed,
      restartCount: this.restartCount,
      lastRestart: this.lastRestart,
      watchedFiles: this.watchedFileCount,
      pid: this.child?.pid ?? null,
    };
  }

  // ── Process Management ──────────────────────────────────

  /** Spawn the child process running the entry file */
  private spawnChild(): void {
    const args = [...this.config.runtimeArgs, this.config.entry];
    this.child = spawn(this.config.runtime, args, {
      stdio: "inherit",
      env: { ...process.env, ...this.config.env, NODE_ENV: "development" },
    });

    this.child.on("error", (err) => this.config.onError(err));
    this.child.on("exit", (code) => {
      // Don't restart if we intentionally stopped or process exited cleanly
      if (!this.stopped && code !== 0) {
        // Process crashed — wait before restart to avoid tight crash loops
        setTimeout(() => {
          if (!this.stopped) this.restart("process crash");
        }, 1000);
      }
    });
  }

  /** Kill the current child process */
  private killChild(): void {
    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
      // Force kill after 3 seconds if SIGTERM doesn't work
      setTimeout(() => {
        if (this.child && !this.child.killed) this.child.kill("SIGKILL");
      }, 3000);
    }
    this.child = null;
  }

  /** Restart the child process (kill old → spawn new) */
  private restart(trigger: string): void {
    if (this.stopped) return;
    this.config.onRestart(trigger);
    this.killChild();
    this.restartCount++;
    this.lastRestart = Date.now();
    // Small delay to ensure port is freed
    setTimeout(() => {
      if (!this.stopped) this.spawnChild();
    }, 100);
  }

  // ── File Watching ───────────────────────────────────────

  /** Set up recursive file watchers on all watch directories */
  private async setupWatchers(): Promise<void> {
    for (const dir of this.config.watch) {
      try {
        await this.watchDirectory(dir);
      } catch {
        // Directory may not exist — skip silently
      }
    }
  }

  /** Watch a single directory recursively */
  private async watchDirectory(dir: string): Promise<void> {
    const watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      // Check if the file matches our extension filter
      const ext = extname(filename);
      if (!this.config.extensions.includes(ext)) return;
      // Check if the file is in an ignored directory
      if (this.config.ignore.some((ign) => filename.includes(ign))) return;

      // Debounce — wait for rapid saves to settle before restarting
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.restart(filename);
      }, this.config.debounceMs);
    });

    this.watchers.push(watcher);
    this.watchedFileCount++;
  }

  /** Close all file watchers */
  private closeWatchers(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
  }
}
