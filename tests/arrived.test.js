// A student the clinic has received (pass arrived) must show in "In the clinic now" even before a visit is logged.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 800 }), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); });
  await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Dummy Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { const s = DB.students[0]; (s.passes = s.passes || []).push({ id: 'P1', status: 'arrived', time: '10:00', arr: '10:05', by: 'T', recvBy: 'Nurse' }); render(); });
  const t = await p.textContent('#restq'); assert(t.includes('1 in clinic') && t.includes('visit not logged'), t);
  await p.click('#restq [data-act=hpick]'); await p.waitForSelector('#hf-walk, form');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('arrived ok');
})().catch(e => { console.error(e); process.exit(1); });
