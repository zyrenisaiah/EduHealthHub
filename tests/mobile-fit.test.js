// On a phone-sized screen no page may be wider than the screen (the odontogram scrolls inside its own box).
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  for (const role of ['Dentist', 'Doctor', 'Nurse', 'Teacher']) {
    const h = await start({ width: 390, height: 800 }), p = await h.login(role);
    for (const step of [() => goOpen(DB.students[0].id, 'dental'), () => { S.tab = 'exam'; render(); }, () => { S.view = 'chat'; render(); }, () => { S.view = NAV[S.user.role][0][0]; render(); }]) {
      await p.evaluate(step); await p.waitForTimeout(100);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth); assert(sw <= 392, role + ' page is ' + sw + 'px wide on a 390px screen');
    }
    assert.deepStrictEqual(h.errors, [], role); await h.stop();
  }
  console.log('mobile-fit ok');
})().catch(e => { console.error(e); process.exit(1); });
