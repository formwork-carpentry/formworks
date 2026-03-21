#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';

const expected = {
  postgres: {
    ports: ['5432/tcp'],
  },
  mysql: {
    ports: ['3306/tcp'],
  },
  redis: {
    ports: ['6379/tcp'],
  },
  nats: {
    ports: ['4222/tcp', '8222/tcp'],
  },
  kafka: {
    ports: ['9092/tcp'],
  },
  jaeger: {
    ports: ['16686/tcp', '4317/tcp', '4318/tcp'],
  },
};

function runDocker(args, env) {
  const result = spawnSync('docker', args, {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    code: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function resolveDockerEnv() {
  const baseEnv = { ...process.env };

  const firstTry = runDocker(['version', '--format', '{{.Server.Version}}'], baseEnv);
  if (firstTry.code === 0) {
    return baseEnv;
  }

  const desktopSocket = path.join(os.homedir(), '.docker', 'desktop', 'docker.sock');
  if (fs.existsSync(desktopSocket)) {
    const desktopEnv = { ...baseEnv, DOCKER_HOST: `unix://${desktopSocket}` };
    const secondTry = runDocker(['version', '--format', '{{.Server.Version}}'], desktopEnv);
    if (secondTry.code === 0) {
      return desktopEnv;
    }
  }

  throw new Error(
    [
      'Could not connect to Docker daemon.',
      'Tried current Docker endpoint and Docker Desktop user socket fallback.',
      'If using system Docker, add your user to docker group and re-login:',
      '  sudo usermod -aG docker $USER',
      'If using Docker Desktop on Linux, ensure Desktop is running.',
    ].join('\n'),
  );
}

function inspectContainer(name, env) {
  const result = runDocker(
    ['inspect', name, '--format', '{{json .State}}||{{json .NetworkSettings.Ports}}'],
    env,
  );

  if (result.code !== 0) {
    return null;
  }

  const [stateJson, portsJson] = result.stdout.split('||');
  return {
    state: JSON.parse(stateJson),
    ports: JSON.parse(portsJson),
  };
}

function listComposeContainers(service, env) {
  const result = runDocker(
    ['ps', '-a', '--filter', `label=com.docker.compose.service=${service}`, '--format', '{{.Names}}'],
    env,
  );

  if (result.code !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveContainerName(service, env) {
  const composeContainers = listComposeContainers(service, env);

  // Prefer running compose-managed containers when available.
  for (const name of composeContainers) {
    const info = inspectContainer(name, env);
    if (info && info.state.Running) {
      return name;
    }
  }

  // Fall back to any compose container, even if stopped.
  for (const name of composeContainers) {
    if (inspectContainer(name, env)) {
      return name;
    }
  }

  return null;
}

function startContainers(names, env) {
  const result = runDocker(['start', ...names], env);
  return result.code === 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDockerWithRetries(args, env, options = {}) {
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 2000;
  const expect = options.expect;

  let lastResult = { code: 1, stdout: '', stderr: '' };

  for (let i = 0; i < attempts; i += 1) {
    lastResult = runDocker(args, env);
    if (lastResult.code === 0) {
      if (!expect || lastResult.stdout.includes(expect)) {
        return lastResult;
      }
    }

    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return lastResult;
}

function tcpProbe(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function printHeader(message) {
  console.log(`\n== ${message} ==`);
}

async function main() {
  const env = resolveDockerEnv();
  if (env.DOCKER_HOST) {
    console.log(`Using Docker endpoint: ${env.DOCKER_HOST}`);
  } else {
    console.log('Using Docker endpoint from current context.');
  }

  const services = Object.keys(expected);
  const resolved = {};

  printHeader('Checking containers');
  const missing = [];
  const notRunning = [];

  for (const service of services) {
    const name = resolveContainerName(service, env);
    if (!name) {
      missing.push(service);
      continue;
    }

    resolved[service] = name;
    const info = inspectContainer(name, env);

    if (!info.state.Running) {
      notRunning.push(name);
    }
  }

  if (missing.length > 0) {
    console.error('Missing services/containers:');
    for (const service of missing) {
      console.error(`  - ${service} (no compose container found)`);
    }
    console.error('Run: docker compose up -d');
    process.exit(1);
  }

  if (notRunning.length > 0) {
    console.log(`Starting stopped containers: ${notRunning.join(', ')}`);
    const started = startContainers(notRunning, env);
    if (!started) {
      console.error('Failed to start one or more containers.');
      process.exit(1);
    }
    await sleep(2000);
  }

  printHeader('Validating ports and health');
  let failures = 0;

  for (const service of services) {
    const name = resolved[service];
    const info = inspectContainer(name, env);
    if (!info || !info.state.Running) {
      console.error(`[FAIL] ${service} (${name}) is not running.`);
      failures += 1;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(info.state, 'Health') && info.state.Health) {
      const health = info.state.Health.Status;
      if (health === 'unhealthy') {
        console.error(`[FAIL] ${service} (${name}) health is ${health}.`);
        failures += 1;
      } else if (health === 'starting') {
        console.log(`[WARN] ${service} (${name}) health is starting.`);
      } else {
        console.log(`[PASS] ${service} (${name}) health is healthy.`);
      }
    } else {
      console.log(`[PASS] ${service} (${name}) is running.`);
    }

    for (const containerPort of expected[service].ports) {
      const bindings = info.ports[containerPort];
      if (!bindings || bindings.length === 0) {
        console.error(`[FAIL] ${service} (${name}) missing host binding for ${containerPort}.`);
        failures += 1;
        continue;
      }

      const hostPort = Number(bindings[0].HostPort);
      const reachable = await tcpProbe('127.0.0.1', hostPort);
      if (!reachable) {
        console.error(`[FAIL] ${service} (${name}) host port ${hostPort} not reachable.`);
        failures += 1;
      } else {
        console.log(`[PASS] ${service} (${name}) host port ${hostPort} reachable.`);
      }
    }
  }

  printHeader('Protocol probes');
  const probes = [
    {
      name: 'Postgres',
      service: 'postgres',
      args: ['pg_isready', '-U', 'postgres'],
    },
    {
      name: 'MySQL',
      service: 'mysql',
      args: ['mysqladmin', 'ping', '-h', '127.0.0.1', '--silent'],
    },
    {
      name: 'Redis',
      service: 'redis',
      args: ['redis-cli', 'ping'],
      expect: 'PONG',
    },
    {
      name: 'Kafka',
      service: 'kafka',
      args: ['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:9092', '--list'],
    },
  ];

  for (const probe of probes) {
    const containerName = resolved[probe.service];
    const result = await runDockerWithRetries(
      ['exec', containerName, ...probe.args],
      env,
      { attempts: 20, delayMs: 2000, expect: probe.expect },
    );
    if (result.code !== 0) {
      console.error(`[FAIL] ${probe.name} probe failed: ${result.stderr || result.stdout}`);
      failures += 1;
      continue;
    }

    if (probe.expect && !result.stdout.includes(probe.expect)) {
      console.error(`[FAIL] ${probe.name} probe output did not include expected text: ${probe.expect}`);
      failures += 1;
      continue;
    }

    console.log(`[PASS] ${probe.name} probe succeeded.`);
  }

  if (failures > 0) {
    console.error(`\nDocker stack validation failed with ${failures} issue(s).`);
    process.exit(1);
  }

  console.log('\nDocker stack validation passed.');
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
