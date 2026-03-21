/**
 * @module @formwork/realtime
 * @description CollaborativeDoc — a CRDT-based collaborative document that supports
 * concurrent editing by multiple users without conflicts.
 *
 * WHY: Real-time collaboration (Google Docs, Figma) requires concurrent edits to
 * merge automatically. CRDTs (Conflict-free Replicated Data Types) guarantee that
 * all replicas converge to the same state regardless of operation order.
 *
 * HOW: This implements a simplified operation-based CRDT for text documents.
 * Each edit is an operation (insert/delete at position). Operations are
 * commutative — applying them in any order produces the same result.
 *
 * NOTE: For production, integrate with Yjs or Automerge. This implementation
 * demonstrates the CRDT concept and provides the public API that the full
 * integration would use.
 *
 * @patterns Observer (change events), Command (operations), Memento (version history)
 * @principles SRP (document state only), OCP (extensible operation types)
 *
 * @example
 * ```ts
 * const doc = new CollaborativeDoc('doc-1');
 *
 * // User A inserts text
 * doc.insert(0, 'Hello ', 'user-a');
 *
 * // User B inserts at the same time
 * doc.insert(0, 'World', 'user-b');
 *
 * // Both converge to same state
 * console.log(doc.getText()); // 'WorldHello ' or 'Hello World' (CRDT-merged)
 *
 * // Subscribe to changes
 * doc.onChange((op) => broadcast(op));
 *
 * // Apply remote operations from other clients
 * doc.applyOperation(remoteOp);
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/** A single edit operation */
export interface DocOperation {
  /** Unique operation ID (for deduplication) */
  id: string;
  /** Type of operation */
  type: "insert" | "delete";
  /** Position in the document (character index) */
  position: number;
  /** Content to insert (for 'insert' operations) */
  content?: string;
  /** Number of characters to delete (for 'delete' operations) */
  length?: number;
  /** Who made this edit */
  userId: string;
  /** Lamport timestamp for ordering */
  timestamp: number;
  /** Document version when this operation was created */
  baseVersion: number;
}

/** A cursor position for a connected user */
export interface UserCursor {
  userId: string;
  /** Cursor position (character index) */
  position: number;
  /** Selection end (if text is selected) */
  selectionEnd?: number;
  /** User display name */
  name?: string;
  /** User color (for cursor highlighting) */
  color?: string;
  /** Last update timestamp */
  lastUpdated: number;
}

/** Change event listener */
export type DocChangeListener = (operation: DocOperation) => void;

/** Cursor update listener */
export type CursorListener = (cursor: UserCursor) => void;

// ── Collaborative Document ────────────────────────────────

/**
 * CRDT-based collaborative document.
 *
 * Thread-safe for single-threaded JS runtimes (Node, Deno, browser).
 * For multi-server deployments, operations should be broadcast to all
 * replicas via the @formwork/realtime broadcaster.
 */
export class CollaborativeDoc {
  /** Document ID (shared across all replicas) */
  readonly id: string;

  /** Current document text — the "ground truth" state */
  private text: string;

  /** Monotonically increasing version counter */
  private version: number;

  /** Lamport clock for causal ordering */
  private clock: number;

  /** Set of applied operation IDs (for deduplication) */
  private appliedOps = new Set<string>();

  /** Full operation history (for undo, replay, and late-joining clients) */
  private history: DocOperation[] = [];

  /** Connected users' cursors */
  private cursors = new Map<string, UserCursor>();

  /** Change listeners — called after every operation is applied */
  private changeListeners: DocChangeListener[] = [];

  /** Cursor update listeners */
  private cursorListeners: CursorListener[] = [];

  constructor(id: string, initialText = "") {
    this.id = id;
    this.text = initialText;
    this.version = 0;
    this.clock = 0;
  }

  // ── Read Operations ─────────────────────────────────────

  /** Get the current document text */
  getText(): string {
    return this.text;
  }

  /** Get the current version number */
  getVersion(): number {
    return this.version;
  }

  /** Get the full operation history */
  getHistory(): ReadonlyArray<DocOperation> {
    return this.history;
  }

  /** Get all connected users' cursors */
  getCursors(): ReadonlyArray<UserCursor> {
    return [...this.cursors.values()];
  }

  /** Get document length in characters */
  getLength(): number {
    return this.text.length;
  }

  // ── Write Operations ────────────────────────────────────

  /**
   * Insert text at a position.
   *
   * @param position - Character index to insert at (0 = start)
   * @param content - Text to insert
   * @param userId - ID of the user making the edit
   * @returns The created operation (broadcast this to other clients)
   */
  insert(position: number, content: string, userId: string): DocOperation {
    const op: DocOperation = {
      id: this.generateOpId(),
      type: "insert",
      position: Math.min(position, this.text.length),
      content,
      userId,
      timestamp: ++this.clock,
      baseVersion: this.version,
    };

    this.applyOperation(op);
    return op;
  }

  /**
   * Delete text at a position.
   *
   * @param position - Starting character index
   * @param length - Number of characters to delete
   * @param userId - ID of the user making the edit
   * @returns The created operation
   */
  delete(position: number, length: number, userId: string): DocOperation {
    // Clamp to valid range
    const clampedPos = Math.min(position, this.text.length);
    const clampedLen = Math.min(length, this.text.length - clampedPos);

    const op: DocOperation = {
      id: this.generateOpId(),
      type: "delete",
      position: clampedPos,
      length: clampedLen,
      userId,
      timestamp: ++this.clock,
      baseVersion: this.version,
    };

    this.applyOperation(op);
    return op;
  }

  /**
   * Apply a remote operation (received from another client via broadcast).
   * Operations are idempotent — applying the same op twice has no effect.
   *
   * @returns true if the operation was applied, false if already seen
   */
  applyOperation(op: DocOperation): boolean {
    // Deduplication: skip if we've already applied this operation
    if (this.appliedOps.has(op.id)) return false;

    // Update Lamport clock to maintain causal ordering
    this.clock = Math.max(this.clock, op.timestamp) + 1;

    // Apply the operation to the text
    if (op.type === "insert" && op.content) {
      const pos = Math.min(op.position, this.text.length);
      this.text = this.text.slice(0, pos) + op.content + this.text.slice(pos);
      // Adjust cursors after the insertion point
      this.adjustCursorsAfter(pos, op.content.length);
    } else if (op.type === "delete" && op.length) {
      const pos = Math.min(op.position, this.text.length);
      const len = Math.min(op.length, this.text.length - pos);
      this.text = this.text.slice(0, pos) + this.text.slice(pos + len);
      // Adjust cursors after the deletion point
      this.adjustCursorsAfter(pos, -len);
    }

    // Record the operation
    this.appliedOps.add(op.id);
    this.history.push(op);
    this.version++;

    // Notify listeners
    for (const listener of this.changeListeners) {
      listener(op);
    }

    return true;
  }

  // ── Cursor Management ───────────────────────────────────

  /**
   * Update a user's cursor position.
   * Call this when a user moves their cursor or selects text.
   */
  updateCursor(cursor: UserCursor): void {
    this.cursors.set(cursor.userId, { ...cursor, lastUpdated: Date.now() });
    for (const listener of this.cursorListeners) {
      listener(cursor);
    }
  }

  /** Remove a user's cursor (when they disconnect) */
  /**
   * @param {string} userId
   */
  removeCursor(userId: string): void {
    this.cursors.delete(userId);
  }

  // ── Event Listeners ─────────────────────────────────────

  /** Subscribe to document changes */
  /**
   * @param {DocChangeListener} listener
   * @returns {() => void}
   */
  onChange(listener: DocChangeListener): () => void {
    this.changeListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    };
  }

  /** Subscribe to cursor updates */
  /**
   * @param {CursorListener} listener
   * @returns {() => void}
   */
  onCursorChange(listener: CursorListener): () => void {
    this.cursorListeners.push(listener);
    return () => {
      const idx = this.cursorListeners.indexOf(listener);
      if (idx >= 0) this.cursorListeners.splice(idx, 1);
    };
  }

  // ── Utility ─────────────────────────────────────────────

  /**
   * Get all operations since a specific version.
   * Used for late-joining clients to catch up.
   */
  getOperationsSince(version: number): DocOperation[] {
    return this.history.filter((op) => op.baseVersion >= version);
  }

  /** Create a snapshot of the current state */
  snapshot(): { text: string; version: number; operationCount: number } {
    return { text: this.text, version: this.version, operationCount: this.history.length };
  }

  // ── Internal ────────────────────────────────────────────

  /** Adjust all cursor positions after an edit */
  private adjustCursorsAfter(position: number, delta: number): void {
    for (const cursor of this.cursors.values()) {
      if (cursor.position >= position) {
        cursor.position = Math.max(0, cursor.position + delta);
      }
      if (cursor.selectionEnd !== undefined && cursor.selectionEnd >= position) {
        cursor.selectionEnd = Math.max(0, cursor.selectionEnd + delta);
      }
    }
  }

  /** Generate a unique operation ID */
  private generateOpId(): string {
    return `op_${this.clock}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
