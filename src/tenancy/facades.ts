/**
 * @module @carpentry/tenancy
 * @description Tenancy facades — global access
 * @patterns Facade
 */

import type { TenancyManager } from "./manager.js";
import type { Tenant, TenantResolverContext } from "./types.js";

let globalTenancyManager: TenancyManager | null = null;
/**
 * @param {TenancyManager} m
 */
export function setTenancyManager(m: TenancyManager): void {
  globalTenancyManager = m;
}

export const Tenancy = {
  tenant: () => getManager().tenant(),
  getTenant: () => getManager().getTenant(),
  hasTenant: () => getManager().hasTenant(),
  setTenant: (t: Tenant) => getManager().setTenant(t),
  initialize: (ctx: TenantResolverContext) => getManager().initialize(ctx),
  run: <T>(tenant: Tenant, fn: () => Promise<T>) => getManager().run(tenant, fn),
  end: () => getManager().end(),
};

function getManager(): TenancyManager {
  /**
   * @param {unknown} !globalTenancyManager
   */
  if (!globalTenancyManager) throw new Error("TenancyManager not initialized.");
  return globalTenancyManager;
}
