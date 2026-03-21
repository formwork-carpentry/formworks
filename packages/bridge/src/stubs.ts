/**
 * @module @formwork/bridge
 * @description Transport stubs for gRPC, NATS, Kafka
 */

import { BridgeDependencyError, BridgeTransportNotConnectedError } from "./exceptions/transport.js";
import type { BridgeMessage, BridgeResponse, ITransport } from "./types.js";

export class GrpcTransportStub implements ITransport {
  readonly name = "grpc";
  async connect() {
    throw new BridgeDependencyError(
      "GrpcTransport",
      '"@grpc/grpc-js"',
      "npm install @grpc/grpc-js @grpc/proto-loader",
    );
  }
  async disconnect() {}
  onRequest() {}
  /**
   * @returns {Promise<BridgeResponse<Res>>}
   */
  async send<Req, Res>(_msg: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    throw new BridgeTransportNotConnectedError(this.name, "Not connected.");
  }
}

export class NatsTransportStub implements ITransport {
  readonly name = "nats";
  async connect() {
    throw new BridgeDependencyError("NatsTransport", '"nats"', "npm install nats");
  }
  async disconnect() {}
  onRequest() {}
  /**
   * @returns {Promise<BridgeResponse<Res>>}
   */
  async send<Req, Res>(_msg: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    throw new BridgeTransportNotConnectedError(this.name, "Not connected.");
  }
}

export class KafkaTransportStub implements ITransport {
  readonly name = "kafka";
  async connect() {
    throw new BridgeDependencyError("KafkaTransport", '"kafkajs"', "npm install kafkajs");
  }
  async disconnect() {}
  onRequest() {}
  /**
   * @returns {Promise<BridgeResponse<Res>>}
   */
  async send<Req, Res>(_msg: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    throw new BridgeTransportNotConnectedError(this.name, "Not connected.");
  }
}
