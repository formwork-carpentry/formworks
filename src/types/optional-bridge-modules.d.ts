declare module "@carpentry/bridge-grpc" {
  export const grpcDriverFactory: import("@carpentry/formworks/adapters").CarpenterFactoryAdapter<
    import("@carpentry/formworks/bridge").BridgeTransportConfig,
    import("@carpentry/formworks/contracts").ITransport
  >;
}

declare module "@carpentry/bridge-kafka" {
  export const kafkaDriverFactory: import("@carpentry/formworks/adapters").CarpenterFactoryAdapter<
    import("@carpentry/formworks/bridge").BridgeTransportConfig,
    import("@carpentry/formworks/contracts").ITransport
  >;
}

declare module "@carpentry/bridge-nats" {
  export const natsDriverFactory: import("@carpentry/formworks/adapters").CarpenterFactoryAdapter<
    import("@carpentry/formworks/bridge").BridgeTransportConfig,
    import("@carpentry/formworks/contracts").ITransport
  >;
}

declare module "@carpentry/storage-s3" {
  export const s3DriverFactory: import("@carpentry/formworks/adapters").CarpenterFactoryAdapter<
    import("@carpentry/formworks/storage").StorageDiskConfig,
    import("@carpentry/formworks/contracts").IStorageAdapter
  >;
}

declare module "@carpentry/db-postgres" {
  export const postgresDriverFactory: import("@carpentry/formworks/db").DatabaseDriverFactory;
}

declare module "@carpentry/db-mysql" {
  export const mysqlAdapter: import("@carpentry/formworks/db").DatabaseDriverFactory;
}

declare module "@carpentry/db-sqlite" {
  export const sqliteAdapter: import("@carpentry/formworks/db").DatabaseDriverFactory;
}

declare module "@carpentry/db-mongodb" {
  export const mongodbAdapter: import("@carpentry/formworks/db").DatabaseDriverFactory;
}

declare module "@carpentry/db-filesystem" {
  export const filesystemAdapter: import("@carpentry/formworks/db").DatabaseDriverFactory;
}

declare module "@carpentry/db-memory" {
  export const memoryAdapter: import("@carpentry/formworks/db").DatabaseDriverFactory;
}
