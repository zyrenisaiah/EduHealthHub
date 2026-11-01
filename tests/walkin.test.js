// Walk-in form: choosing "Other" makes the nurse type the ailment.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start(), n = await h.login('Nurse');
  await n.fill('#hq', '110001000005'); await n.waitForSelector('#hres'); await n.click('#hres [data-act=hpanel][data-k=walk]'); await n.waitForSelector('#hf-walk');
  assert(!(await n.isVisible('#w-other')), 'typing box hidden until Other is chosen');
  await n.selectOption('#w-ail', 'Other');
  assert(await n.isVisible('#w-other'), 'typing box appears for Other');
  await n.click('#hf-walk button[type=submit]');
  assert(await n.$('#hf-walk'), 'cannot save while the ailment is empty');
  await n.fill('#w-other', 'insect bite'); await n.click('#hf-walk button[type=submit]'); await n.waitForTimeout(300);
  const a = await n.evaluate(() => stu(DB.students.find(s => s.lrn === '110001000005').id).visits.slice(-1)[0].ailment);
  assert.strictEqual(a, 'Other: insect bite');
  await n.click('#hres [data-act=hpanel][data-k=walk]'); await n.selectOption('#w-ail', 'Fever'); await n.selectOption('#w-ail', 'Other'); await n.selectOption('#w-ail', 'Headache');
  assert(!(await n.isVisible('#w-other')), 'box hides again for a normal ailment');
  assert.deepStrictEqual(h.errors, []); await h.stop(); console.log('walkin ok');
})().catch(e => { console.error(e); process.exit(1); });
