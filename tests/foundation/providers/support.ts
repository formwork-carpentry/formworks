import { Container } from '../../../src/core/container/Container.js';
import { Config } from '../../../src/core/config/Config.js';
import { ConfigResolver } from '../../../src/core/config/ConfigResolver.js';

export function createProviderTestContext() {
  const container = new Container();

  const config = new Config({
    app: {
      name: 'test-app',
      env: 'testing',
      debug: false,
    },
    logging: {
      default: 'console',
      channels: {
        console: { driver: 'console' },
      },
    },
    database: {
      default: 'memory',
      connections: {
        memory: { driver: 'memory' },
      },
    },
    cache: {
      default: 'memory',
      stores: {
        memory: { driver: 'memory' },
      },
    },
    queue: {
      default: 'sync',
      connections: {
        sync: { driver: 'sync' },
      },
    },
    mail: {
      default: 'log',
      mailers: {
        log: { driver: 'log' },
      },
      from: {
        address: 'noreply@example.com',
        name: 'Test',
      },
    },
    storage: {
      default: 'local',
      disks: {
        local: { driver: 'local', root: 'storage/app' },
      },
    },
    bridge: {
      default: 'grpc',
      transports: {
        grpc: { driver: 'grpc', target: '127.0.0.1:50051' },
      },
    },
  });

  const resolver = new ConfigResolver(config);
  return { container, resolver };
}
