
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');

const mode = process.argv[2] || 'phone';
const root = process.cwd();
const expoHome = path.join(root, '.expo-home');
const mobileRoot = path.join(root, 'apps', 'mobile');
const localTemp = path.join(root, '.tmp');
fs.mkdirSync(expoHome, { recursive: true });
fs.mkdirSync(localTemp, { recursive: true });

const preferredPorts = {
  phone: [8084, 8085, 8086, 8087],
  dev: [8084, 8085, 8086, 8087],
  android: [8084, 8085, 8086, 8087],
  ios: [8084, 8085, 8086, 8087],
  tunnel: [8084, 8085, 8086, 8087],
  web: [8091, 8092, 8093],
};
function canBind(port) {
  return new Promise((resolve) => {
    let pending = 2;
    let failed = false;

    function done(ok) {
      if (!ok) failed = true;
      pending -= 1;
      if (pending === 0) resolve(!failed);
    }

    for (const host of ['127.0.0.1', '0.0.0.0']) {
      const server = net.createServer();
      server.unref();
      server.on('error', () => done(false));
      server.listen(port, host, () => {
        server.close(() => done(true));
      });
    }
  });
}

async function getPort() {
  const pool = preferredPorts[mode] || preferredPorts.phone;
  for (const port of pool) {
    if (await canBind(port)) {
      return port;
    }
  }
  return pool[pool.length - 1];
}
async function main() {
  if (mode === 'reset') {
    for (const target of [
      expoHome,
      path.join(mobileRoot, '.expo'),
      path.join(mobileRoot, '.expo-export'),
      path.join(mobileRoot, 'node_modules', '.cache'),
    ]) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
      } catch {}
    }
    process.exit(0);
  }

  const port = await getPort();
  const args = ['run', 'dev', '--'];

  if (mode === 'web') args.push('--web');
  if (mode === 'android') args.push('--lan', '--android');
  if (mode === 'ios') args.push('--lan', '--ios');
  if (mode === 'tunnel') args.push('--tunnel');
  if (mode === 'phone' || mode === 'dev') args.push('--lan');

  args.push('--clear');
  args.push('--port', String(port));

  console.log('[mobile] starting ' + mode + ' on port ' + port);

const child = spawn('npm', args, {
    cwd: mobileRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      BROWSER: mode === 'web' ? 'none' : process.env.BROWSER,
      EXPO_NO_TELEMETRY: '1',
      EXPO_OFFLINE: '1',
      EXPO_UNSTABLE_HEADLESS: '1',
      EXPO_HOME: expoHome,
      HOME: expoHome,
      TMP: localTemp,
      TEMP: localTemp,
      USERPROFILE: expoHome,
    },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

