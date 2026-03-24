import { grpcDriverFactory } from "@carpentry/bridge-grpc";
import { kafkaDriverFactory } from "@carpentry/bridge-kafka";
import { natsDriverFactory } from "@carpentry/bridge-nats";

import { BridgeManager, type BridgeTransportConfig } from "./BridgeManager.js";

export function createBridgeManager(
  defaultTransport: string,
  configs: Record<string, BridgeTransportConfig>,
): BridgeManager {
  const manager = new BridgeManager(defaultTransport, configs);
  manager.registerDriver("grpc", grpcDriverFactory);
  manager.registerDriver("kafka", kafkaDriverFactory);
  manager.registerDriver("nats", natsDriverFactory);
  return manager;
}
