// Doctor "Accounts": search, reset password (temp shown once), deactivate blocks login, advisory change.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1200, height: 900 }), errs = [];
  const mk = async () => { const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); }); return p; };
  const d = await mk(); await d.goto(h.base + 'doctor.html'); await d.waitForSelector('#loginform');
  await d.fill('#lu', 'Dummy Doctor1'); await d.fill('#pw', 'doctor1'); await d.click('#loginform [type=submit]'); await d.waitForSelector('.shell');
  await d.click('[data-act=nav][data-v=accounts]'); await d.waitForSelector('text=Reset a forgotten password');
  await d.fill('[data-bind=acq]', 'Nurse1'); await d.waitForSelector('tbody tr'); assert.strictEqual((await d.$$('tbody tr')).length, 1, 'search narrows the list');
  await d.click('[data-act=acreset]'); await d.waitForSelector('text=Temporary password for Dummy Nurse1');
  const tmp = (await d.textContent('.mono[style*="user-select"]')).trim(); assert(/^[A-Za-z0-9]{12}$/.test(tmp) && /[A-Za-z]/.test(tmp) && /[0-9]/.test(tmp), 'temp password shape ' + tmp);
  await d.click('[data-act=actoggle]'); await d.waitForSelector('text=Deactivated');
  await d.waitForTimeout(800);
  const n = await mk(); await n.goto(h.base + 'nurse.html'); await n.waitForSelector('#loginform');
  await n.fill('#lu', 'Dummy Nurse1'); await n.fill('#pw', tmp); await n.click('#loginform [type=submit]'); await n.waitForSelector('.pill.bad');
  assert(!(await n.$('.shell')), 'deactivated account cannot log in');
  await d.click('[data-act=actoggle]'); await d.waitForSelector('text=Active'); await d.waitForTimeout(800);
  await n.reload(); await n.waitForSelector('#loginform'); await n.fill('#lu', 'Dummy Nurse1'); await n.fill('#pw', tmp); await n.click('#loginform [type=submit]'); await n.waitForSelector('.shell');
  await d.fill('[data-bind=acq]', 'Teacher 11A1'); await d.waitForSelector('[id^=acadv-]');
  await d.selectOption('[id^=acadv-]', '11-ACAD-2'); await d.click('[data-act=acadvsave]'); await d.waitForTimeout(300);
  assert.strictEqual(await d.$eval('[id^=acadv-]', e => e.value), '11-ACAD-2');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('accounts ok');
})().catch(e => { console.error(e); process.exit(1); });
