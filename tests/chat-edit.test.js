// Edit and unsend: own messages only, edits/unsends from other people arrive through sync "changes".
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 760 }), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace('const CLOUD_ON', 'var CLOUD_ON') }); });
  await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Dummy Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => {
    CLOUD_ON = true; TOK = 't'; window.calls = []; let rev = 10;
    window.rpc = async (fn, a) => { calls.push([fn, a]);
      if (fn === 'app_msg_edit') return { id: a.p_id, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: S.user.role, b: a.p_body, k: 'text', r: null, t: Date.now(), v: ++rev, d: false, e: new Date().toISOString() };
      if (fn === 'app_msg_unsend') return { id: a.p_id, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: S.user.role, b: '', k: 'text', r: null, t: Date.now(), v: ++rev, d: true, e: null };
      return {} };
    S.msg.dir = [{ id: 'D1', name: 'Dummy Doctor', role: 'Doctor' }]; S.msg.dirOk = true; S.msg.dirT = Date.now() + 1e9;
    const mine = { id: 1, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: 'Nurse', k: 'text', b: 'my first note', t: Date.now(), v: 1 };
    const theirs = { id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: 'doctor says hi', t: Date.now(), v: 2 };
    S.msg.msgs = [mine, theirs]; S.msg.ids = new Set([1, 2]); S.msg.last = 2; S.msg.rev = 2; S.msg.active = 'clinic'; S.view = 'chat'; render(); });
  assert.strictEqual((await p.$$('[data-act=medit]')).length, 1, 'only my own message has Edit');
  await p.click('[data-act=medit]'); await p.fill('#medtext', 'my fixed note'); await p.click('[data-act=msave]');
  await p.waitForFunction(() => document.querySelector('#chthread').textContent.includes('my fixed note'));
  assert((await p.textContent('#chthread')).includes('edited'), 'shows the edited tag');
  assert.strictEqual(await p.evaluate(() => calls.find(c => c[0] === 'app_msg_edit')[1].p_body), 'my fixed note');
  // someone else edits their message: arrives as a change
  await p.evaluate(() => msgApply({ id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: 'doctor fixed it', t: Date.now(), v: 50, d: false, e: new Date().toISOString() }) || chatRefresh());
  assert((await p.textContent('#chthread')).includes('doctor fixed it'), 'other person edit shows up');
  await p.click('[data-act=munsend]'); await p.waitForFunction(() => document.querySelector('#chthread').textContent.includes('You unsent a message'));
  assert(!(await p.textContent('#chthread')).includes('my fixed note'), 'unsent text is gone');
  await p.evaluate(() => { msgApply({ id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: '', t: Date.now(), v: 60, d: true, e: null }); chatRefresh(); });
  assert((await p.textContent('#chthread')).includes('Dummy Doctor unsent a message'), 'other person unsend shows up');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('chat-edit ok');
})().catch(e => { console.error(e); process.exit(1); });
