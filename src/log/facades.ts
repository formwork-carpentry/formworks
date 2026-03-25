/**
 * @module @carpentry/log
 * @description Log and Audit facades — global access points
 * @patterns Facade
 */

import type { LogManager } from "./LogManager.js";
import type { AuditLogger } from "./audit.js";
import type { AuditAction, AuditEntry } from "./audit.js";

let globalLogManager: LogManager | null = null;
let globalAuditLogger: AuditLogger | null = null;

/**
 * @param {LogManager} m
 */
export function setLogManager(m: LogManager): void {
  globalLogManager = m;
}
/**
 * @param {AuditLogger} a
 */
export function setAuditLogger(a: AuditLogger): void {
  globalAuditLogger = a;
}

export const Log = {
  emergency: (msg: string, ctx?: Record<string, unknown>) => getLogManager().emergency(msg, ctx),
  alert: (msg: string, ctx?: Record<string, unknown>) => getLogManager().alert(msg, ctx),
  critical: (msg: string, ctx?: Record<string, unknown>) => getLogManager().critical(msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => getLogManager().error(msg, ctx),
  warning: (msg: string, ctx?: Record<string, unknown>) => getLogManager().warning(msg, ctx),
  notice: (msg: string, ctx?: Record<string, unknown>) => getLogManager().notice(msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => getLogManager().info(msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => getLogManager().debug(msg, ctx),
  channel: (name?: string) => getLogManager().channel(name),
};

export const Audit = {
  record: (entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string }) =>
    getAuditLogger().record(entry),
  created: (type: string, id: string | number, vals?: Record<string, unknown>) =>
    getAuditLogger().created(type, id, vals),
  updated: (
    type: string,
    id: string | number,
    old?: Record<string, unknown>,
    next?: Record<string, unknown>,
  ) => getAuditLogger().updated(type, id, old, next),
  deleted: (type: string, id: string | number) => getAuditLogger().deleted(type, id),
  viewed: (type: string, id?: string | number) => getAuditLogger().viewed(type, id),
  login: (userId: string | number, meta?: Record<string, unknown>) =>
    getAuditLogger().login(userId, meta),
  logout: (userId: string | number) => getAuditLogger().logout(userId),
  failedLogin: (creds: Record<string, unknown>, meta?: Record<string, unknown>) =>
    getAuditLogger().failedLogin(creds, meta),
};

function getLogManager(): LogManager {
  if (!globalLogManager) throw new Error("LogManager not initialized.");
  return globalLogManager;
}

function getAuditLogger(): AuditLogger {
  if (!globalAuditLogger) throw new Error("AuditLogger not initialized.");
  return globalAuditLogger;
}
