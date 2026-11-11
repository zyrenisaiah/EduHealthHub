// Login is strict: usernames and passwords are case-sensitive, and repeated failures lock the name.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start();
  async function attempt(user, pw) {
    const p = await h.ctx.newPage();
    await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace(/key:"[^"]*"/, 'key:""') }); });
    await p.goto(h.base + 'doctor.html'); await p.waitForSelector('#loginform');
    await p.fill('#lu', user); await p.fill('#pw', pw); await p.click('#loginform button[type=submit]');
    const ok = await p.waitForSelector('.shell', { timeout: 2500 }).then(() => true, () => false);
    const err = ok ? '' : (await p.textContent('#loginform [role=alert]').catch(() => '')).trim();
    await p.close(); return { ok, err };
  }
  assert.strictEqual((await attempt('Test Doctor1', 'doctor1')).ok, true, 'exact username + password must work');
  assert.strictEqual((await attempt('test doctor1', 'doctor1')).ok, false, 'lower-case username must fail');
  assert.strictEqual((await attempt('TEST DOCTOR1', 'doctor1')).ok, false, 'upper-case username must fail');
  assert.strictEqual((await attempt('TestDoctor1', 'doctor1')).ok, false, 'username without the space must fail');
  const bad = await attempt('Test Doctor1', 'Doctor1');
  assert.strictEqual(bad.ok, false, 'wrong-case password must fail'); assert(/incorrect/i.test(bad.err), 'shows a clear message: ' + bad.err);
  // The page also tells people about case sensitivity
  const p = await h.ctx.newPage(); await p.goto(h.base + 'index.html?role=Doctor'); await p.waitForSelector('#loginform');
  assert(/case-sensitive/i.test(await p.textContent('#loginform')), 'form should mention case sensitivity'); await p.close();
  assert.deepStrictEqual(h.errors, []); await h.stop(); console.log('login ok');
})().catch(e => { console.error(e); process.exit(1); });
