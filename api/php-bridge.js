// php-bridge.js — Vercel TEST hosting only (docs/VERCEL.md). Hostinger runs PHP directly.
//
// Vercel's community PHP runtime (vercel-php) currently fails to start on Vercel's own
// launcher (vercel-community/php#650). This is a plain Node.js function instead: on a cold
// start it runs the same prebuilt PHP 8.3 (from @libphp/amazon-linux-2-v83) as PHP's built-in
// server with api/vercel.php as the router, then passes every request through unchanged
// (method, path, headers, body; status, headers incl. Set-Cookie, body back).
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'node_modules', '@libphp', 'amazon-linux-2-v83', 'native');
const PORT = 8730;
let ready = null;

function phpIni() {
  // The package's php.ini points extension_dir at /var/task/php/modules; ours live in node_modules.
  const ini = fs.readFileSync(path.join(PKG, 'php', 'php.ini'), 'utf8')
    .replace(/^extension_dir=.*$/m, `extension_dir=${path.join(PKG, 'php', 'modules')}`);
  const file = '/tmp/am-php.ini';
  fs.writeFileSync(file, `${ini}\nexpose_php=Off\ndisplay_errors=Off\nlog_errors=On\nvariables_order=EGPCS\n`);
  return file;
}

function phpBinary() {
  const bin = path.join(PKG, 'php', 'php');
  try { fs.accessSync(bin, fs.constants.X_OK); return bin; } catch { /* not executable after packaging */ }
  const copy = '/tmp/am-php';
  if (!fs.existsSync(copy)) { fs.copyFileSync(bin, copy); fs.chmodSync(copy, 0o755); }
  return copy;
}

function portOpen(tries) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const c = net.connect(PORT, '127.0.0.1');
      c.on('connect', () => { c.destroy(); resolve(); });
      c.on('error', () => (n <= 0 ? reject(new Error('PHP did not start')) : setTimeout(() => attempt(n - 1), 20)));
    };
    attempt(tries);
  });
}

function start() {
  // AM_PHP_BIN: a local PHP for testing this bridge off Vercel (its own php.ini).
  const local = process.env.AM_PHP_BIN;
  const php = spawn(local || phpBinary(), [...(local ? [] : ['-c', phpIni()]), '-S', `127.0.0.1:${PORT}`, '-t', ROOT, path.join(__dirname, 'vercel.php')], {
    cwd: ROOT,
    env: { ...process.env, LD_LIBRARY_PATH: `${path.join(PKG, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`, PHP_CLI_SERVER_WORKERS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  php.stdout.on('data', (d) => process.stdout.write(`php: ${d}`));
  php.stderr.on('data', (d) => { const s = String(d); if (!/ Accepted| Closing| \[200\]: /.test(s)) process.stderr.write(`php: ${s}`); });
  php.on('exit', (code) => { console.error(`php exited (${code})`); ready = null; });
  return portOpen(500);
}

module.exports = async (req, res) => {
  try {
    if (!ready) ready = start();
    await ready;
  } catch (e) {
    ready = null;
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: { code: 'server_starting', message: 'Please try again in a moment.' }, meta: {} }));
    return;
  }
  const headers = { ...req.headers };
  delete headers.connection;
  const up = http.request({ host: '127.0.0.1', port: PORT, method: req.method, path: req.url, headers }, (r) => {
    const out = { ...r.headers };
    delete out['transfer-encoding'];
    delete out.connection;
    res.writeHead(r.statusCode || 500, out);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) { res.statusCode = 502; res.end(); }
  });
  req.pipe(up);
};

// Vercel must hand us the raw body (uploads, exact JSON for the idempotency hash).
module.exports.config = { api: { bodyParser: false } };
