// Shared test helpers: a tiny static server and a browser that runs the site in LOCAL mode
// (the Supabase URL is blanked, so no real database or internet is touched).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
    }).listen(0, '127.0.0.1', () => res({ srv, base: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

const ACCOUNTS = {
  Doctor: ['doctor.html', 'Dummy Doctor1', 'doctor1'],
  Nurse: ['nurse.html', 'Dummy Nurse1', 'nurse1'],
  Dentist: ['dentist.html', 'Dummy Dentist1', 'dentist1'],
  Teacher: ['teacher.html', 'Dummy Teacher 11A1', 'acad1'],
};

async function start(viewport = { width: 1200, height: 900 }) {
  const { srv, base } = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const errors = [];
  async function login(role) {
    const [file, user, pw] = ACCOUNTS[role];
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(role + ' page error: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push(role + ' console: ' + m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace(/key:"[^"]*"/, 'key:""') }); });
    await p.goto(base + file); await p.waitForSelector('#loginform');
    await p.fill('#lu', user); await p.fill('#pw', pw); await p.click('#loginform button[type=submit]');
    await p.waitForSelector('.shell'); return p;
  }
  async function stop() { await browser.close(); srv.close(); }
  return { login, errors, stop, ctx, base };
}
module.exports = { start, ROOT };
