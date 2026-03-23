/**
 * @module @carpentry/http
 * @description Server — wraps node:http around HttpKernel so the app actually listens on a port.
 *
 * @example
 * ```ts
 * import { serve } from '..';
 * import { createApp } from './app.js';
 *
 * const { kernel, config } = await createApp();
 * serve(kernel, { port: 3000 });
 * // => Server listening on http://localhost:3000
 * ```
 */

import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import type { HttpKernel } from "../kernel/HttpKernel.js";
import { Request } from "../request/Request.js";
import type { CarpenterResponse } from "../response/Response.js";

/**
 * @typedef {Object} ServeOptions
 * @property {number} [port=3000] - Port to listen on
 * @property {string} [host='0.0.0.0'] - Host to bind to
 * @property {Function} [onReady] - Called when server is listening
 */
export interface ServeOptions {
  port?: number;
  host?: string;
  onReady?: (address: { port: number; host: string }) => void;
}

/**
 * Read the full request body from an IncomingMessage stream.
 *
 * @param {IncomingMessage} req - Node.js incoming request
 * @returns {Promise<string>} Raw body string
 */
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Convert a Node.js IncomingMessage into a Carpenter Request.
 *
 * @param {IncomingMessage} nodeReq - Node.js request
 * @returns {Promise<Request>} Carpenter request wrapping a Web API Request
 */
async function toRequest(nodeReq: IncomingMessage): Promise<Request> {
  const host = nodeReq.headers.host ?? "localhost";
  const url = `http://${host}${nodeReq.url ?? "/"}`;
  const method = nodeReq.method ?? "GET";

  const headers = new Headers();
  for (const [key, val] of Object.entries(nodeReq.headers)) {
    if (typeof val === "string") headers.set(key, val);
    else if (Array.isArray(val)) headers.set(key, val.join(", "));
  }

  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readBody(nodeReq) : null;

  const webRequest = new globalThis.Request(url, {
    method,
    headers,
    body,
  });

  return new Request(webRequest);
}

/**
 * Start an HTTP server that routes requests through the Carpenter HttpKernel.
 *
 * @param {HttpKernel} kernel - The application HTTP kernel
 * @param {ServeOptions} [options] - Server options
 * @returns {Server} The underlying node:http Server (for testing/shutdown)
 *
 * @example
 * ```ts
 * const { kernel } = await createApp();
 * const server = serve(kernel, {
 *   port: 3000,
 *   onReady: ({ port }) => console.log(`Listening on :${port}`),
 * });
 *
 * // Graceful shutdown
 * process.on('SIGTERM', () => server.close());
 * ```
 */
export function serve(kernel: HttpKernel, options: ServeOptions = {}): Server {
  const port = options.port ?? Number.parseInt(process.env.APP_PORT ?? "3000", 10);
  const host = options.host ?? "0.0.0.0";

  const server = createServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    try {
      const request = await toRequest(nodeReq);
      const response = (await kernel.handle(request)) as CarpenterResponse;

      const headers = response.getHeaders();
      if (!headers["content-type"]) headers["content-type"] = "application/json";
      const body = response.getBody();

      nodeRes.writeHead(response.statusCode, headers);
      nodeRes.end(typeof body === "string" ? body : JSON.stringify(body));
    } catch (err) {
      nodeRes.writeHead(500, { "content-type": "application/json" });
      nodeRes.end(
        JSON.stringify({ error: "Internal Server Error", message: (err as Error).message }),
      );
    }
  });

  server.listen(port, host, () => {
    const addr = { port, host };
    if (options.onReady) {
      options.onReady(addr);
    } else {
      console.log(`Server listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    }
  });

  return server;
}
