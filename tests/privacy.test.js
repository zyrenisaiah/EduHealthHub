// Privacy guards: content security policy, forced password change, idle logout.
const assert = require('assert'), fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { start, ROOT } = require('./helpers');
(async () => {
  for (const f of ['index', 'doctor', 'nurse', 'dentist', 'teacher']) {
    const html = fs.readFileSync(path.join(ROOT, f + '.html'), 'utf8');
    assert(/Content-Security-Policy/.test(html) && /object-src 'none'/.test(html) && /name="referrer"/.test(html), f + '.html needs the CSP and referrer meta tags');
  }
  const h = await start();

  // 1) Forced password change (cloud mode, mocked server)
  const browser = await chromium.launch(), p = await browser.newPage(), calls = [], errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://test.supabase.co"').replace(/key:"[^"]*"/, 'key:"k"') }); });
  await p.route('https://test.supabase.co/**', async r => {
    const u = r.request().url(), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}; calls.push([u.split('/').pop(), body]);
    if (/app_login$/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't1', account: { id: 'A1', role: 'Doctor', name: 'Dummy Doctor1', must_change: true } }) });
    if (/app_change_password$/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"SESSION_EXPIRED"}' });
  });
  await p.goto(h.base + 'doctor.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Dummy Doctor1'); await p.fill('#pw', 'doctor1'); await p.click('#loginform button[type=submit]');
  await p.waitForSelector('#mustform'); assert(!(await p.$('#loginform')), 'login form is replaced by the new-password form');
  await p.fill('#mu-n', 'short1'); await p.fill('#mu-r', 'short1'); await p.click('#mustform button[type=submit]');
  assert(!calls.some(c => c[0] === 'app_change_password'), 'a weak password is stopped before it is sent');
  await p.fill('#mu-n', 'GoodPassword2026'); await p.fill('#mu-r', 'GoodPassword2027'); await p.click('#mustform button[type=submit]');
  assert(/do not match/i.test(await p.textContent('#mustform')), 'mismatch is explained');
  await p.fill('#mu-n', 'GoodPassword2026'); await p.fill('#mu-r', 'GoodPassword2026'); await p.click('#mustform button[type=submit]');
  await p.waitForURL(/doctor\.html/, { timeout: 5000 }).catch(() => {});
  const chg = calls.find(c => c[0] === 'app_change_password');
  assert(chg && chg[1].p_token === 't1' && chg[1].p_old === 'doctor1' && chg[1].p_new === 'GoodPassword2026', 'change-password call carries the session, old and new password');
  assert.deepStrictEqual(errs, [], 'CSP or script errors: ' + errs.join('\n'));
  await browser.close();

  // 2) Idle logout (local mode): 14 min warns, 15 min logs out
  const ctx = h.ctx, d = await ctx.newPage(); await d.clock.install();
  await d.route(/fonts\./, r => r.abort());
  await d.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace(/key:"[^"]*"/, 'key:""') }); });
  await d.goto(h.base + 'doctor.html'); await d.waitForSelector('#loginform');
  await d.fill('#lu', 'Dummy Doctor1'); await d.fill('#pw', 'doctor1'); await d.click('#loginform button[type=submit]'); await d.waitForSelector('.shell');
  await d.clock.fastForward('14:30'); assert(await d.$('.shell'), 'still signed in at 14.5 minutes');
  await d.mouse.move(100, 100); await d.mouse.down(); await d.mouse.up();
  await d.clock.fastForward('14:30'); assert(await d.$('.shell'), 'activity restarts the idle clock');
  await d.clock.fastForward('16:00');
  await d.waitForSelector('#loginform', { timeout: 5000 }); assert(!(await d.$('.shell')), 'logged out after 15 idle minutes');
  await h.stop(); console.log('privacy ok');
})().catch(e => { console.error(e); process.exit(1); });
