// The send-to-clinic journey and the permission matrix, end to end in local mode.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start();
  const t = await h.login('Teacher');
  const lrn = await t.evaluate(() => advList()[2].lrn);

  // Teacher: search shows only pass/status info, never medical details; can send the student to the clinic
  await t.fill('#hq', lrn); await t.waitForSelector('#hres');
  assert(!/Allerg|Blood|DMFT/.test(await t.textContent('#hres')), 'teacher must not see medical details');
  await t.click('[data-act=hpanel][data-k=send]'); await t.fill('#s-note', 'feels unwell'); await t.click('#hf-send button[type=submit]');
  await t.waitForTimeout(300);
  assert(/way/i.test(await t.textContent('#hres .pill')), 'status should say on the way');

  // Teacher cannot look up a student from another advisory
  await t.fill('#hq', '110002000001');
  assert(!(await t.$('#hres [data-act=hpanel]')), 'teacher must not act on another advisory');

  // Nurse: sees incoming pass, receives, logs the visit
  await t.waitForTimeout(1200);
  const n = await h.login('Nurse');
  await n.waitForSelector('[data-act=hrecv]'); await n.click('[data-act=hrecv]');
  await n.waitForSelector('#hf-walk'); await n.selectOption('#w-ail', 'Headache'); await n.click('#hf-walk button[type=submit]');
  await n.waitForTimeout(300);
  assert.strictEqual(await n.$$eval('#restq tbody tr', r => r.length), 1, 'student should be listed as in the clinic');

  // Teacher sees "In clinic"
  await t.reload(); await t.waitForSelector('.shell'); await t.waitForTimeout(1200);
  assert(/In clinic/.test(await t.textContent('#root')), 'teacher should see the student in the clinic');

  // Nurse sends the student home; teacher can verify the excuse slip
  await n.click('[data-act=hreturn][data-o=home]'); await n.waitForTimeout(900);
  await t.reload(); await t.waitForSelector('.shell');
  assert.strictEqual(await t.$$eval('[data-act=hver]', r => r.length), 1, 'teacher should see one excused slip');
  await t.click('[data-act=hver]');
  assert(/excused to go home/.test(await t.textContent('.refbox')), 'verified slip should say excused');

  // Doctor cannot edit the odontogram; Dentist can
  const d = await h.login('Doctor');
  await d.fill('#hq', lrn); await d.waitForSelector('#hres'); await d.click('[data-act=open][data-tab=dental]'); await d.waitForSelector('.tabs');
  assert(!(await d.$('[data-act=marksound]')), 'doctor odontogram must be read-only');
  const dn = await h.login('Dentist');
  await dn.fill('#hq', lrn); await dn.waitForSelector('#hres'); await dn.click('[data-act=open][data-tab=dental]'); await dn.waitForSelector('.tabs');
  assert(await dn.$('[data-act=marksound]'), 'dentist must be able to edit the odontogram');

  assert.deepStrictEqual(h.errors, [], 'browser errors:\n' + h.errors.join('\n'));
  await h.stop(); console.log('clinic-flow ok');
})().catch(e => { console.error(e); process.exit(1); });
