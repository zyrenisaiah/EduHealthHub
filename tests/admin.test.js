// Admin account: only the head developer sees Backups and Error reports. Doctors keep Accounts and sign-up approvals.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1200, height: 900 }), errs = [];
  const mk = async () => { const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); }); return p; };
  const login = async (p, page, u, pw) => { await p.goto(h.base + page); await p.waitForSelector('#loginform'); await p.fill('#lu', u); await p.fill('#pw', pw); await p.click('#loginform [type=submit]'); await p.waitForSelector('.shell'); };
  const d = await mk(); await login(d, 'doctor.html', 'Dummy Doctor1', 'doctor1');
  for (const v of ['backups', 'errors']) assert(!(await d.$(`[data-act=nav][data-v=${v}]`)), 'Doctor must not see ' + v);
  assert(await d.$('[data-act=nav][data-v=accounts]'), 'Doctor keeps Accounts');
  await d.evaluate(() => { S.view = 'backups'; render(); }); await d.waitForTimeout(300);
  assert(!(await d.$('text=Download backup now')), 'Doctor cannot open Backups by force');
  await h.stop();
  const h2 = await start({ width: 1200, height: 900 });
  const a = await h2.ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); await a.route(/fonts\./, r => r.abort());
  await a.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); });
  await a.goto(h2.base + 'doctor.html'); await a.waitForSelector('#loginform'); await a.fill('#lu', 'Demo Admin'); await a.fill('#pw', 'admin1234567'); await a.click('#loginform [type=submit]'); await a.waitForSelector('.shell');
  for (const v of ['accounts', 'backups', 'errors']) assert(await a.$(`[data-act=nav][data-v=${v}]`), 'Admin sees ' + v);
  await a.click('[data-act=nav][data-v=backups]'); await a.waitForSelector('text=Download backup now');
  await a.click('[data-act=nav][data-v=errors]'); await a.waitForSelector('h2:text("Error reports")');
  assert.deepStrictEqual(errs, []); await h2.stop(); console.log('admin ok');
})().catch(e => { console.error(e); process.exit(1); });
