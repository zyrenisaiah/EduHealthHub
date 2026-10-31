// Every role opens every tab on desktop and phone widths with no script errors, no broken text, no sideways scroll.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  for (const vp of [{ width: 1200, height: 900 }, { width: 380, height: 760 }]) {
    const h = await start(vp);
    for (const role of ['Doctor', 'Nurse', 'Dentist', 'Teacher']) {
      const p = await h.login(role), n = await p.$$eval('.nav button', b => b.length);
      assert(n >= 4, role + ' should have at least 4 tabs, got ' + n);
      for (let i = 0; i < n; i++) {
        const bs = await p.$$('.nav button'), label = (await bs[i].textContent()).trim();
        await bs[i].click(); await p.waitForTimeout(200);
        const txt = await p.textContent('#root');
        assert(!/undefined|NaN|\[object/.test(txt), `${role}/${label}: broken text on screen`);
        assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), `${role}/${label}: sideways scroll at ${vp.width}px`);
      }
    }
    assert.deepStrictEqual(h.errors, [], 'browser errors:\n' + h.errors.join('\n'));
    await h.stop();
  }
  console.log('smoke ok');
})().catch(e => { console.error(e); process.exit(1); });
