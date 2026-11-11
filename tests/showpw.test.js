// Every password box has a Show / Hide button that really switches the box, on the login, sign-up and My account screens.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 900 }), errs = [];
  const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); });
  const check = async (ids, where) => {
    for (const id of ids) {
      assert.strictEqual(await p.$eval('#' + id, e => e.type), 'password', where + ' ' + id + ' starts hidden');
      const btn = await p.$('#' + id + ' + [data-act=showpw]'); assert(btn, where + ' ' + id + ' has a Show button');
      await btn.click(); assert.strictEqual(await p.$eval('#' + id, e => e.type), 'text', where + ' ' + id + ' shows'); assert.strictEqual((await btn.textContent()).trim(), 'Hide');
      await btn.click(); assert.strictEqual(await p.$eval('#' + id, e => e.type), 'password', where + ' ' + id + ' hides again');
    }
  };
  await p.goto(h.base + 'index.html'); await p.waitForSelector('#loginform'); await check(['pw'], 'login');
  await p.click('[data-act=signupopen]'); await p.waitForSelector('#signupform'); await check(['su-pw', 'su-pw2'], 'sign-up');
  await p.click('[data-act=signupback]'); await p.fill('#lu', 'Test Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform [type=submit]'); await p.waitForSelector('.shell');
  await p.click('[data-act=nav][data-v=account]'); await p.waitForSelector('#pwform'); await check(['pw-c', 'pw-n', 'pw-r'], 'My account');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('showpw ok');
})().catch(e => { console.error(e); process.exit(1); });
