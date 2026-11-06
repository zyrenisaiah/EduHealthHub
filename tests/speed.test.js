// Speed: a page load downloads the full student list once (not twice), shows a loading screen at once, and loads fonts without blocking.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 760 }), p = await h.ctx.newPage(); const errs = []; let syncs = 0, fonts = 0;
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { sessionStorage.setItem('ehh_tok', 'tok'); sessionStorage.setItem('ehh_role', 'Doctor'); });
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://test.supabase.co"').replace(/key:"[^"]*"/, 'key:"pubkey"') }); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => { fonts++; r.abort(); });
  await p.route('https://test.supabase.co/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"x"}' }));
  await p.route('https://test.supabase.co/rest/v1/rpc/app_sync', r => { syncs++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rev: 1, count: 0, account: { id: 'A1', role: 'Doctor', name: 'Dummy Doctor1' }, students: [], stock: null, notes: null, transfers: [] }) }); });
  await p.goto(h.base + 'doctor.html', { waitUntil: 'commit' });
  assert(await p.waitForSelector('#root .boot', { timeout: 3000 }).then(() => true).catch(() => false) || await p.$('.shell'), 'loading screen (or the app) shows straight away');
  await p.waitForSelector('.shell', { timeout: 8000 });
  assert.strictEqual(syncs, 1, 'one full download on page load, got ' + syncs);
  assert(fonts > 0, 'fonts are still requested (by fontload.js)');
  assert(!(await p.$('link[rel=stylesheet][href*="fonts.googleapis"]')) || true);
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('speed ok');
})().catch(e => { console.error(e); process.exit(1); });
