// Device file attachments in chat: upload tile -> app_file_put -> file message -> card, bad type/size rejected.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1100, height: 760 }), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace('const CLOUD_ON', 'var CLOUD_ON') }); });
  await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Test Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => {
    CLOUD_ON = true; TOK = 'tok'; window.calls = [];
    window.rpc = async (fn, a) => { calls.push([fn, a]);
      if (fn === 'app_file_put') return { fid: 7, name: a.p_name, mime: a.p_mime, size: 5 };
      if (fn === 'app_msg_send') return { id: 9, conv: a.p_conv, s: S.user.id, sn: S.user.name, sr: S.user.role, b: a.p_body, k: a.p_kind, r: a.p_ref, t: Date.now() };
      if (fn === 'app_file_get') return { name: 'x.txt', mime: 'text/plain', size: 5, b64: btoa('hello') };
      return {} };
    S.msg.dir = [{ id: 'T1', name: 'Test Teacher 11A1', role: 'Teacher' }]; S.msg.dirOk = true; S.msg.dirT = Date.now() + 1e9;
    S.msg.msgs = [{ id: 1, conv: 'desk:T1', s: 'T1', sn: 'T', sr: 'Teacher', k: 'text', b: 'hi', t: Date.now() }]; S.msg.active = 'desk:T1'; S.view = 'chat'; render(); });
  await p.click('[data-act=cpanel][data-k=attach]'); await p.waitForSelector('#cfile', { state: 'attached' });
  await p.setInputFiles('#cfile', { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await p.waitForTimeout(200);
  assert(!(await p.evaluate(() => calls.some(c => c[0] === 'app_file_put'))), 'blocked type is never uploaded');
  await p.setInputFiles('#cfile', { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2100000) });
  await p.waitForTimeout(200);
  assert(!(await p.evaluate(() => calls.some(c => c[0] === 'app_file_put'))), 'oversize file is never uploaded');
  await p.setInputFiles('#cfile', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await p.waitForSelector('.fcard');
  const sent = await p.evaluate(() => calls.find(c => c[0] === 'app_msg_send'));
  assert.strictEqual(sent[1].p_kind, 'file'); assert.strictEqual(sent[1].p_ref.fid, 7);
  assert((await p.textContent('.fcard')).includes('note.txt'), 'card shows the file name');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=cfdl]')]);
  assert.strictEqual(dl.suggestedFilename(), 'x.txt');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('chat-files ok');
})().catch(e => { console.error(e); process.exit(1); });
