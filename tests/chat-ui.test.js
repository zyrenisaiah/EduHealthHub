// Messenger-style attach sheet: search rows, file tiles, and the composer always stays visible.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  for (const vp of [{ width: 1100, height: 760 }, { width: 1100, height: 600 }, { width: 390, height: 740 }]) {
    const h = await start(vp), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace('const CLOUD_ON', 'var CLOUD_ON') }); });
    await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
    await p.fill('#lu', 'Dummy Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
    await p.evaluate(() => { CLOUD_ON = true; S.msg.dir = [{ id: 'T1', name: 'Dummy Teacher 11A1', role: 'Teacher' }]; S.msg.dirOk = true; S.msg.dirT = Date.now() + 1e9; S.msg.msgs = [{ id: 1, conv: 'desk:T1', s: 'T1', sn: 'T', sr: 'Teacher', k: 'text', b: 'hi', t: Date.now() }]; S.msg.active = 'desk:T1'; S.view = 'chat'; render(); });
    await p.click('[data-act=cpanel][data-k=attach]'); await p.fill('#cq', 'Dummy Student 1'); await p.waitForSelector('.crow');
    assert((await p.$$('.crow')).length >= 1, 'search shows learner rows');
    await p.click('.crow'); await p.waitForSelector('.ctile');
    assert.strictEqual((await p.$$('.ctile')).length, 7, 'learner card + 6 file types as tiles');
    const inside = await p.evaluate(() => { const c = document.querySelector('.chat').getBoundingClientRect(), k = document.querySelector('.chcomp').getBoundingClientRect(); return k.bottom <= c.bottom + 1 && k.height > 30; });
    assert(inside, 'composer stays inside the chat at ' + vp.width + 'x' + vp.height);
    await p.click('.cclose'); assert(!(await p.$('.sheet')), 'close button closes the sheet');
    assert.deepStrictEqual(errs, []); await h.stop();
  }
  console.log('chat-ui ok');
})().catch(e => { console.error(e); process.exit(1); });
