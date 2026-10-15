import { spawn } from 'node:child_process';
import fs from 'node:fs';

// Бесплатный HTTPS-туннель для запуска с ПК (без хостинга).
// localhost.run через ssh (работает из РФ, но адрес периодически меняется)
// или Cloudflare Quick Tunnel (bin/cloudflared.exe): адрес стабильнее, но Cloudflare в РФ замедляют.
// onUrl вызывается при каждом новом адресе.
// TUNNEL_PROVIDER=cloudflared включает Cloudflare (из РФ режется), по умолчанию localhost.run
const CLOUDFLARED = false;
const LOG = new URL('./data/tunnel.log', import.meta.url);

export function startTunnel(port, onUrl) {
  let last = null;
  let child = null;
  const [cmd, args, re] = CLOUDFLARED
    ? [CLOUDFLARED, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${port}`], /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/]
    : ['ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-o', 'ExitOnForwardFailure=yes',
        '-R', `80:localhost:${port}`, 'nokey@localhost.run'], /https:\/\/[a-z0-9-]+\.lhr\.life/];
  console.log('Туннель:', CLOUDFLARED ? 'cloudflared' : 'localhost.run');

  const run = () => {
    child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const scan = (d) => {
      fs.appendFile(LOG, d, () => {});
      const m = String(d).match(re);
      if (m && m[0] !== last) { last = m[0]; onUrl(last); }
    };
    child.stdout.on('data', scan);
    child.stderr.on('data', scan);
    child.on('exit', (code) => { console.error(new Date().toISOString(), 'туннель упал, код', code); setTimeout(run, 3000); });
  };
  run();
  process.on('exit', () => child?.kill());
}
