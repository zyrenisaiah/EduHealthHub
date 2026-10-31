// Health files: Word export/import round trip, PDF output, and who may edit.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start();
  const d = await h.login('Doctor');

  // Pure functions: blocks -> .docx -> blocks keeps headings, text and bold
  const out = await d.evaluate(async () => {
    const src = [{ t: 'h1', r: [{ x: 'Title' }] }, { t: 'p', r: [{ x: 'Plain ' }, { x: 'bold', b: true }] }, { t: 'li', r: [{ x: 'item' }] }];
    const back = await readDocx(new File([buildDocx(src)], 'a.docx'));
    return JSON.stringify(back.blocks || back);
  });
  assert(/Title/.test(out) && /"h1"/.test(out) && /"b":true/.test(out) && /item/.test(out), 'docx round trip lost content: ' + out);
  assert(await d.evaluate(() => pdfText('Hello', 10, false) > 0 && pdfText('Hello', 10, true) > pdfText('Hello', 10, false)), 'pdfText widths');

  // Doctor edits a document and downloads Word + PDF
  await d.fill('#hq', '110001000001'); await d.waitForSelector('#hres');
  await d.click('#hres [data-act=open][data-tab=profile]'); await d.waitForSelector('[data-act=docopen]');
  await d.click('[data-act=docopen][data-k="Medical Clearance"]'); await d.waitForSelector('.docpage');
  await d.click('[data-act=dedit]'); await d.click('.docpage p:nth-of-type(2)'); await d.keyboard.press('End'); await d.keyboard.type(' EDITED BY DOCTOR');
  await d.click('[data-act=dsave]'); await d.waitForSelector('text=Saved.');
  assert((await d.textContent('.docpage')).includes('EDITED BY DOCTOR'), 'edit should persist');
  let [dl] = await Promise.all([d.waitForEvent('download'), d.click('[data-act=ddocx]')]);
  assert(/\.docx$/.test(dl.suggestedFilename()), 'word download name');
  [dl] = await Promise.all([d.waitForEvent('download'), d.click('[data-act=dpdf]')]);
  const pdf = require('fs').readFileSync(await dl.path()); assert.strictEqual(pdf.slice(0, 5).toString(), '%PDF-', 'pdf header');

  // Teacher: view + PDF only. Dentist: view only.
  const t = await h.login('Teacher');
  await t.fill('#hq', '110001000001'); await t.waitForSelector('#hres'); await t.click('#hres [data-act=open][data-tab=profile]'); await t.waitForSelector('[data-act=docopen]');
  await t.click('[data-act=docopen]'); await t.waitForSelector('.docpage');
  assert(!(await t.$('[data-act=dedit]')) && await t.$('[data-act=dpdf]'), 'teacher: PDF yes, edit no');
  const n = await h.login('Dentist');
  await n.fill('#hq', '110001000001'); await n.waitForSelector('#hres'); await n.click('#hres [data-act=open][data-tab=profile]'); await n.click('[data-act=docopen]'); await n.waitForSelector('.docpage');
  assert(!(await n.$('[data-act=dedit]')) && !(await n.$('[data-act=dpdf]')) && !(await n.$('[data-act=ddocx]')), 'dentist: view only');

  assert.deepStrictEqual(h.errors, [], 'browser errors:\n' + h.errors.join('\n'));
  await h.stop(); console.log('documents ok');
})().catch(e => { console.error(e); process.exit(1); });
