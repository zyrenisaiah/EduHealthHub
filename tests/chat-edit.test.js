// Edit and unsend: own messages only, edits/unsends from other people arrive through sync "changes".
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 760 }), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace('const CLOUD_ON', 'var CLOUD_ON') }); });
  await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Dummy Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => {
    CLOUD_ON = true; TOK = 't'; window.calls = []; let rev = 10;
    window.rpc = async (fn, a) => { calls.push([fn, a]);
      if (fn === 'app_msg_edit') return { id: a.p_id, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: S.user.role, b: a.p_body, k: 'text', r: null, t: Date.now(), v: ++rev, d: false, e: new Date().toISOString() };
      if (fn === 'app_msg_send') return { id: 100 + calls.length, conv: a.p_conv, s: S.user.id, sn: S.user.name, sr: S.user.role, b: a.p_body, k: a.p_kind, r: a.p_ref, t: Date.now(), v: ++rev, d: false, e: null };
      if (fn === 'app_msg_unsend') return { id: a.p_id, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: S.user.role, b: '', k: 'text', r: null, t: Date.now(), v: ++rev, d: true, e: null };
      return {} };
    S.msg.dir = [{ id: 'D1', name: 'Dummy Doctor', role: 'Doctor' }]; S.msg.dirOk = true; S.msg.dirT = Date.now() + 1e9;
    const mine = { id: 1, conv: 'clinic', s: S.user.id, sn: S.user.name, sr: 'Nurse', k: 'text', b: 'my first note', t: Date.now(), v: 1 };
    const theirs = { id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: 'doctor says hi', t: Date.now(), v: 2 };
    S.msg.msgs = [mine, theirs]; S.msg.ids = new Set([1, 2]); S.msg.last = 2; S.msg.rev = 2; S.msg.active = 'clinic'; S.view = 'chat'; render(); });
  const menu = async (id) => { await p.hover('#m-' + id); await p.click('#m-' + id + ' .mdots'); await p.waitForSelector('#mmenu'); return (await p.textContent('#mmenu')); };
  let mt = await menu(2); assert(mt.includes('Reply') && mt.includes('Forward') && !mt.includes('Edit') && !mt.includes('Unsend'), 'other person: reply/forward only: ' + mt);
  await p.keyboard.press('Escape'); assert(!(await p.$('#mmenu')), 'Esc closes the menu');
  mt = await menu(1); assert(['Reply', 'Forward', 'Copy', 'Edit', 'Unsend'].every(w => mt.includes(w)), 'own message: all options: ' + mt);
  // reply
  await p.click('#mmenu [data-act=mmreply]'); await p.waitForSelector('#replybar:not([hidden])'); assert((await p.textContent('#replybar')).includes('yourself'));
  await p.fill('#chtext', 'answering that'); await p.click('#chform button[type=submit]');
  await p.waitForFunction(() => calls.some(c => c[0] === 'app_msg_send'));
  assert.deepStrictEqual(await p.evaluate(() => calls.find(c => c[0] === 'app_msg_send')[1].p_ref), { re: 1 }, 'reply stores only the id of the original');
  assert(await p.$eval('#replybar', e => e.hidden), 'reply bar clears after sending');
  // forward (text only) to the clinic chat
  await p.evaluate(() => { S.msg.tmp['dm:D1:' + S.user.id] = 1; });
  mt = await menu(2); await p.click('#mmenu [data-act=mmfwd]'); await p.waitForSelector('#fwdm .citem');
  await p.click('#fwdm .citem'); await p.waitForFunction(() => calls.filter(c => c[0] === 'app_msg_send').length === 2);
  const fw = await p.evaluate(() => calls.filter(c => c[0] === 'app_msg_send')[1][1]); assert.strictEqual(fw.p_body, 'doctor says hi'); assert.strictEqual(fw.p_ref.fw, 'Dummy Doctor'); assert(!(await p.$('#fwdm')), 'forward sheet closes');
  await menu(1);
  await p.click('[data-act=medit]'); const cs = await p.$eval('#medtext', e => { const c = getComputedStyle(e); return [c.color, c.backgroundColor]; }); assert.notStrictEqual(cs[0], cs[1], 'edit text is readable (colour differs from its background)'); assert.notStrictEqual(cs[0], 'rgb(255, 255, 255)', 'edit text is not white');
  await p.fill('#medtext', 'my fixed note'); await p.click('[data-act=msave]');
  await p.waitForFunction(() => document.querySelector('#chthread').textContent.includes('my fixed note'));
  assert((await p.textContent('#chthread')).includes('edited'), 'shows the edited tag');
  assert.strictEqual(await p.evaluate(() => calls.find(c => c[0] === 'app_msg_edit')[1].p_body), 'my fixed note');
  // someone else edits their message: arrives as a change
  await p.evaluate(() => msgApply({ id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: 'doctor fixed it', t: Date.now(), v: 50, d: false, e: new Date().toISOString() }) || chatRefresh());
  assert((await p.textContent('#chthread')).includes('doctor fixed it'), 'other person edit shows up');
  await menu(1); await p.click('#mmenu [data-act=munsend]'); await p.waitForFunction(() => document.querySelector('#chthread').textContent.includes('You unsent a message'));
  assert(!(await p.textContent('#chthread')).includes('my fixed note'), 'unsent text is gone');
  await p.evaluate(() => { msgApply({ id: 2, conv: 'clinic', s: 'D1', sn: 'Dummy Doctor', sr: 'Doctor', k: 'text', b: '', t: Date.now(), v: 60, d: true, e: null }); chatRefresh(); });
  assert((await p.textContent('#chthread')).includes('Dummy Doctor unsent a message'), 'other person unsend shows up');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('chat-edit ok');
})().catch(e => { console.error(e); process.exit(1); });
