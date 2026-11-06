// One signed-in account per browser: a second tab cannot log in as someone else while the first is signed in.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 800 }, { realLock: true }), errs = [];
  const mk = async () => { const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); }); return p; };
  const a = await mk(); await a.goto(h.base + 'doctor.html'); await a.waitForSelector('#loginform');
  await a.fill('#lu', 'Dummy Doctor1'); await a.fill('#pw', 'doctor1'); await a.click('#loginform [type=submit]'); await a.waitForSelector('.shell');
  // a new tab: the login page says someone is already signed in and refuses another account
  const b = await mk(); await b.goto(h.base + 'index.html'); await b.waitForSelector('#loginform');
  assert((await b.textContent('#loginform')).includes('already signed in on this browser'), 'banner on the login page');
  await b.fill('#lu', 'Dummy Nurse1'); await b.fill('#pw', 'nurse1'); await b.click('#loginform [type=submit]'); await b.waitForTimeout(500);
  assert(!(await b.$('.shell')) && b.url().includes('index'), 'second account is not logged in');
  assert((await b.textContent('#loginform')).includes('Dummy Doctor1'), 'message names who is signed in');
  // reload of the first tab keeps its session
  await a.reload(); await a.waitForSelector('.shell');
  await b.reload(); await b.waitForSelector('#loginform'); assert((await b.textContent('#loginform')).includes('already signed in'), 'still blocked after the first tab reloaded');
  // after the first tab logs out, the second can log in
  await a.click('[data-act=logout]'); await a.waitForSelector('#loginform');
  await b.reload(); await b.waitForSelector('#loginform');
  await b.fill('#lu', 'Dummy Nurse1'); await b.fill('#pw', 'nurse1'); await b.click('#loginform [type=submit]'); await b.waitForSelector('.shell');
  // and now the first tab cannot log back in as the doctor
  await a.reload(); await a.waitForSelector('#loginform'); await a.fill('#lu', 'Dummy Doctor1'); await a.fill('#pw', 'doctor1'); await a.click('#loginform [type=submit]'); await a.waitForTimeout(500);
  assert(!(await a.$('.shell')), 'doctor blocked while the nurse is signed in');
  // two tabs signed in at once (e.g. from before this rule): the one that signed in later signs itself out
  await b.evaluate(() => localStorage.setItem('ehh_active', JSON.stringify({ tab: 'older-tab', id: 'A1', name: 'Dummy Doctor1', role: 'Doctor', since: 1, t: Date.now() })));
  await b.waitForSelector('#loginform', { timeout: 6000 }); assert(!(await b.$('.shell')), 'the newer tab signed itself out');
  assert((await b.textContent('#loginform')).includes('already signed in'), 'and says why');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('one-account ok');
})().catch(e => { console.error(e); process.exit(1); });
