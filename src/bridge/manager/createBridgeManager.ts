import { grpcDriverFactory } from "@carpentry/bridge-grpc";
import { kafkaDriverFactory } from "@carpentry/bridge-kafka";
import { natsDriverFactory } from "@carpentry/bridge-nats";

import type { CarpenterFactoryAdapter } from "@carpentry/formworks/adapters";
import type { ITransport } from "@carpentry/formworks/contracts";
import { BridgeManager, type BridgeTransportConfig } from "./BridgeManager.js";

export function createBridgeManager(
  defaultTransport: string,
  configs: Record<string, BridgeTransportConfig>,
): BridgeManager {
  const manager = new BridgeManager(defaultTransport, configs);
  manager.registerDriver(
    "grpc",
    grpcDriverFactory as CarpenterFactoryAdapter<BridgeTransportConfig, ITransport>,
  );
  manager.registerDriver(
    "kafka",
    kafkaDriverFactory as CarpenterFactoryAdapter<BridgeTransportConfig, ITransport>,
  );
  manager.registerDriver(
    "nats",
    natsDriverFactory as CarpenterFactoryAdapter<BridgeTransportConfig, ITransport>,
  );
  return manager;
}
