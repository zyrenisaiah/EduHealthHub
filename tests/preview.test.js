// Click a photo or file in chat to preview it: photo, PDF and text open in a viewer; Word/Excel say to download; Esc / Close / backdrop close it.
const assert = require('assert'), { start } = require('./helpers');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
(async () => {
  const h = await start({ width: 1100, height: 760 }), p = await h.ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""').replace('const CLOUD_ON', 'var CLOUD_ON') }); });
  await p.goto(h.base + 'nurse.html'); await p.waitForSelector('#loginform');
  await p.fill('#lu', 'Dummy Nurse1'); await p.fill('#pw', 'nurse1'); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(PNG => {
    CLOUD_ON = true; TOK = 'tok';
    const F = { 1: { name: 'photo.png', mime: 'image/png', b64: PNG }, 2: { name: 'doc.pdf', mime: 'application/pdf', b64: btoa('%PDF-1.1\n%%EOF') }, 3: { name: 'note.txt', mime: 'text/plain', b64: btoa('hello <b>world</b>') }, 4: { name: 'sheet.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: btoa('x') } };
    window.rpc = async (fn, a) => { if (fn === 'app_file_get') { const f = F[a.p_fid]; return { name: f.name, mime: f.mime, size: 5, b64: f.b64 } } return {} };
    S.msg.dir = [{ id: 'T1', name: 'Dummy Teacher 11A1', role: 'Teacher' }]; S.msg.dirOk = true; S.msg.dirT = Date.now() + 1e9;
    S.msg.msgs = Object.entries(F).map(([id, f]) => ({ id: +id, conv: 'desk:T1', s: 'T1', sn: 'T', sr: 'Teacher', k: 'file', b: '', r: { fid: +id, name: f.name, mime: f.mime, size: 5 }, t: Date.now() + +id }));
    S.msg.active = 'desk:T1'; S.view = 'chat'; render(); }, PNG);
  await p.waitForSelector('.fimgbtn');
  // photo
  await p.click('.fimgbtn'); await p.waitForSelector('#pv .pvimg'); assert((await p.textContent('#pv .pvname')).includes('photo.png'));
  await p.keyboard.press('Escape'); assert(!(await p.$('#pv')), 'Esc closes');
  // text (shown as text, never as HTML)
  await p.click('.fnamebtn:has-text("note.txt")'); await p.waitForSelector('#pv .pvtxt');
  assert.strictEqual((await p.textContent('#pv .pvtxt')).trim(), 'hello <b>world</b>'); assert(!(await p.$('#pv .pvtxt b')), 'text is not turned into HTML');
  await p.click('#pv [data-pv=x]'); assert(!(await p.$('#pv')), 'Close button closes');
  // pdf
  await p.click('.fnamebtn:has-text("doc.pdf")'); await p.waitForSelector('#pv .pvpdf'); assert((await p.getAttribute('#pv .pvpdf', 'src')).startsWith('blob:'));
  await p.mouse.click(5, 300); await p.waitForTimeout(100); assert(!(await p.$('#pv')), 'clicking outside closes');
  // other types: no preview, but download works
  await p.click('.fnamebtn:has-text("sheet.xlsx")'); await p.waitForSelector('#pv .pvmsg');
  assert((await p.textContent('#pv .pvmsg')).includes('cannot be previewed'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pv [data-pv=dl]')]); assert.strictEqual(dl.suggestedFilename(), 'sheet.xlsx');
  await p.keyboard.press('Escape');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('preview ok');
})().catch(e => { console.error(e); process.exit(1); });
