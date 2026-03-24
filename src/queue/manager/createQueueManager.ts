import type { IDatabaseAdapter } from "@carpentry/formworks/contracts";

import { DatabaseQueueAdapter } from "../adapters/DatabaseQueueAdapter.js";
import { type QueueConnectionConfig, QueueManager } from "./QueueManager.js";

export interface QueueManagerFactoryDependencies {
  resolveDatabaseAdapter: () => IDatabaseAdapter;
}

export function createQueueManager(
  defaultConnection: string,
  configs: Record<string, QueueConnectionConfig>,
  dependencies: QueueManagerFactoryDependencies,
): QueueManager {
  const manager = new QueueManager(defaultConnection, configs);
  manager.registerDriver(
    "database",
    (cfg) =>
      new DatabaseQueueAdapter(dependencies.resolveDatabaseAdapter(), {
        table: ((cfg as Record<string, unknown>).table as string) ?? "jobs",
      }),
  );
  return manager;
}
