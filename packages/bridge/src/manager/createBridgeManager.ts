import { grpcDriverFactory } from "@formwork/bridge-grpc";
import { kafkaDriverFactory } from "@formwork/bridge-kafka";
import { natsDriverFactory } from "@formwork/bridge-nats";

import type { CarpenterFactoryAdapter } from "@formwork/core/adapters";
import type { ITransport } from "@formwork/core/contracts";
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
