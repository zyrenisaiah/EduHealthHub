// Sign-up: request -> Doctor approves -> new account can log in; rejected / duplicate / weak handled.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 900 }), errs = [];
  const mk = async () => { const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); }); return p; };
  const p = await mk(); await p.goto(h.base + 'index.html'); await p.waitForSelector('#loginform');
  await p.click('[data-act=signupopen]'); await p.waitForSelector('#signupform');
  const fill = async (o) => { for (const [k, v] of Object.entries(o)) await p.fill('#su-' + k, v); };
  await p.selectOption('#su-role', 'Teacher'); assert(await p.isVisible('#su-advf'), 'teacher sees advisory');
  await p.selectOption('#su-role', 'Nurse'); assert(!(await p.isVisible('#su-advf')), 'nurse has no advisory');
  await fill({ name: 'New Nurse', email: 'new.nurse@school.test', user: 'NewNurse', pw: 'short1', pw2: 'short1' }); await p.click('#signupform [type=submit]');
  assert((await p.textContent('#signupform')).includes('10 characters'), 'weak password refused');
  await fill({ name: 'New Nurse', email: 'new.nurse@school.test', user: 'NewNurse', pw: 'Strongpass12', pw2: 'Strongpass12' }); await p.click('#signupform [type=submit]');
  await p.waitForSelector('text=Request sent');
  // cannot log in before approval
  await p.click('[data-act=signupback]'); await p.fill('#lu', 'NewNurse'); await p.fill('#pw', 'Strongpass12'); await p.click('#loginform [type=submit]');
  await p.waitForSelector('.pill.bad'); assert(p.url().includes('index'), 'not logged in before approval');
  // duplicate request
  await p.click('[data-act=signupopen]'); await fill({ name: 'Other', email: 'NEW.nurse@school.test', user: 'Another', pw: 'Strongpass12', pw2: 'Strongpass12' }); await p.click('#signupform [type=submit]');
  assert((await p.textContent('#signupform')).includes('already used'), 'duplicate email refused');
  // a teacher can write their own section
  await p.click('[data-act=signupback]'); await p.click('[data-act=signupopen]');
  await p.selectOption('#su-role', 'Teacher'); await p.selectOption('#su-adv', '__other'); assert(await p.isVisible('#su-adv2'), 'write-your-own box appears');
  await fill({ name: 'Own Section', email: 'own@school.test', user: 'OwnSection', pw: 'Strongpass12', pw2: 'Strongpass12' }); await p.click('#signupform [type=submit]');
  assert((await p.textContent('#signupform')).includes('Write your advisory section'), 'empty own section refused');
  await p.fill('#su-adv2', 'Grade 12 STEM-A'); await p.click('#signupform [type=submit]'); await p.waitForSelector('text=Request sent');
  await p.waitForTimeout(700); // local save is debounced
  // doctor approves
  const d = await mk(); await d.goto(h.base + 'doctor.html'); await d.waitForSelector('#loginform');
  await d.fill('#lu', 'Test Doctor1'); await d.fill('#pw', 'doctor1'); await d.click('#loginform [type=submit]'); await d.waitForSelector('.shell');
  await d.waitForSelector('#signq'); assert((await d.textContent('#signq')).includes('New Nurse'));
  await d.click('#signq [data-act=sgok]'); await d.waitForFunction(() => !(document.querySelector('#signq') || { textContent: '' }).textContent.includes('New Nurse'));
  assert((await d.textContent('#signq')).includes('Grade 12 STEM-A'), 'doctor sees the section the teacher wrote');
  await d.click('#signq [data-act=sgok]'); await d.waitForFunction(() => !document.querySelector('#signq'));
  await d.waitForTimeout(800); // local save is debounced
  const n = await mk(); await n.goto(h.base + 'nurse.html'); await n.waitForSelector('#loginform');
  await n.fill('#lu', 'NewNurse'); await n.fill('#pw', 'Strongpass12'); await n.click('#loginform [type=submit]'); await n.waitForSelector('.shell');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('signup ok');
})().catch(e => { console.error(e); process.exit(1); });
