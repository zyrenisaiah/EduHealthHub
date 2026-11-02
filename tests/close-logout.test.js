// Closing the browser signs the account out (cloud mode, mocked server).
const assert = require('assert'), { chromium } = require('playwright'), { start } = require('./helpers');
(async () => {
  const h = await start(), browser = await chromium.launch(), ctx = await browser.newContext(), calls = [];
  await ctx.route(/fonts\./, r => r.abort());
  await ctx.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://test.supabase.co"').replace(/key:"[^"]*"/, 'key:"k"') }); });
  await ctx.route('https://test.supabase.co/**', r => { const u = r.request().url().split('/').pop(); const b = r.request().postData(); calls.push([u, b ? JSON.parse(b) : {}]); r.fulfill({ status: /app_(logout|ping)$/.test(u) ? 200 : 400, contentType: 'application/json', body: /app_(logout|ping)$/.test(u) ? 'null' : '{"message":"SESSION_EXPIRED"}' }); });
  const logouts = () => calls.filter(c => c[0] === 'app_logout').map(c => c[1].p_token);
  const open = async () => { const p = await ctx.newPage(); await p.goto(h.base + 'index.html'); await p.waitForSelector('#loginform'); return p; };
  const marker = () => ctx.pages()[0].evaluate(() => localStorage.getItem('ehh_closing'));

  // 1) A page closing leaves a note
  const a = await open();
  await a.evaluate(() => { TOK = 'tokA'; ss.set('ehh_tok', 'tokA'); dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); });
  assert(/tokA/.test(await marker()), 'closing page leaves a note');
  // bfcache-style hide (page may come back) leaves no note
  await a.evaluate(() => { localStorage.removeItem('ehh_closing'); dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); });
  assert.strictEqual(await marker(), null, 'a page that may come back is not treated as closed');

  // 2) Browser was closed >15 s ago: next visit ends that session on the server
  await a.evaluate(() => { TOK = null; localStorage.setItem('ehh_closing', JSON.stringify([{ tok: 'tokOld', t: Date.now() - 60000 }])); });
  const b = await open();
  await b.waitForTimeout(300); assert(logouts().includes('tokOld'), 'old session is logged out on the server at the next visit');
  assert.strictEqual(await marker(), null, 'note cleared');

  // 3) A quick reload or page change (under 15 s) is NOT a logout
  const before = logouts().length;
  await b.evaluate(() => { ss.set('ehh_tok', 'tokR'); localStorage.setItem('ehh_closing', JSON.stringify([{ tok: 'tokR', t: Date.now() }])); });
  await b.reload(); await b.waitForSelector('#loginform').catch(() => {}); await b.waitForTimeout(300);
  assert.strictEqual(logouts().length, before, 'reload does not log out');

  // 4) A tab restored after the browser was closed (token still in the tab, note older than 15 s) is signed out
  const c = await ctx.newPage(); await c.goto(h.base + 'index.html'); await c.waitForSelector('#loginform');
  await c.evaluate(() => { ss.set('ehh_tok', 'tokRestore'); ss.set('ehh_role', 'Doctor'); localStorage.setItem('ehh_closing', JSON.stringify([{ tok: 'tokRestore', t: Date.now() - 30000 }])); });
  await c.reload(); await c.waitForSelector('#loginform'); await c.waitForTimeout(300);
  assert(logouts().includes('tokRestore'), 'restored tab is logged out on the server');
  assert.strictEqual(await c.evaluate(() => ss.get('ehh_tok')), null, 'restored tab loses its token');

  // 5) Heartbeat while a page is open
  const d = await ctx.newPage(); await d.clock.install(); await d.goto(h.base + 'index.html'); await d.waitForSelector('#loginform');
  await d.evaluate(() => { TOK = 'tokHB'; S.user = { id: 'A1', role: 'Doctor' }; hbStart(); });
  await d.clock.fastForward('00:50'); await d.waitForTimeout(200);
  assert(calls.some(c => c[0] === 'app_ping' && c[1].p_token === 'tokHB'), 'open page pings the server');
  await browser.close(); await h.stop(); console.log('close-logout ok');
})().catch(e => { console.error(e); process.exit(1); });
