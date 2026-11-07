// Attack test: hostile text in every stored field must never become live HTML or run script, in any screen of any role.
const assert = require('assert'), { start } = require('./helpers');
const PAY = '"><img src=x onerror="window.__xss=1"><svg onload="window.__xss=1"><script>window.__xss=1</script>\'`${7*7}';
(async () => {
  let h;
  const mk = async () => { const p = await h.ctx.newPage(); await p.route(/fonts\./, r => r.abort());
    await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:""') }); }); return p; };
  for (const [page, user, pw, views] of [['doctor.html', 'Dummy Doctor1', 'doctor1', ['home', 'overview', 'students', 'stock', 'chat', 'accounts', 'activity', 'account']], ['nurse.html', 'Dummy Nurse1', 'nurse1', ['home', 'students', 'stock', 'chat', 'account']], ['dentist.html', 'Dummy Dentist1', 'dentist1', ['home', 'students', 'chat', 'account']], ['teacher.html', 'Dummy Teacher 11A1', 'acad1', ['home', 'dash', 'files', 'chat', 'account']]]) {
    h = await start({ width: 1200, height: 900 }); const p = await mk(); p.on('dialog', d => { global.__dialog = true; d.dismiss(); });
    await p.goto(h.base + page); await p.waitForSelector('#loginform'); await p.fill('#lu', user); await p.fill('#pw', pw); await p.click('#loginform [type=submit]'); await p.waitForSelector('.shell');
    await p.evaluate(PAY => {
      const walk = (o, d) => { if (!o || d > 6) return; for (const k of Object.keys(o)) { if (k === 'id' || k === 'role') continue; if (typeof o[k] === 'string' && o[k].length < 400) o[k] = PAY; else if (typeof o[k] === 'object') walk(o[k], d + 1); } };
      DB.students.slice(0, 40).forEach(s => walk(s, 0)); DB.accounts.forEach(a => { if (a.id !== S.user.id) { a.name = PAY; a.username = PAY + a.id; a.email = PAY; a.adv = PAY } });
      if (DB.stock) walk(DB.stock, 0); (DB.notes || []).forEach(n => walk(n, 0)); (DB.transfers || []).forEach(n => walk(n, 0)); (DB.signups = DB.signups || []).push({ id: 1, name: PAY, role: 'Nurse', email: PAY, username: PAY, at: new Date().toISOString() });
    }, PAY);
    for (const v of views) {
      await p.evaluate(v => { S.view = v; if (S.f) S.f.q = 'onerror'; try { render() } catch (e) {} }, v); await p.waitForTimeout(150);
      const bad = await p.evaluate(() => window.__xss || document.querySelectorAll('img[src="x"],svg[onload],[onerror],[onload]').length || 0);
      assert(!bad, user + ' screen ' + v + ' ran or built hostile HTML');
    }
    const sid = await p.evaluate(() => DB.students[0] && DB.students[0].id);
    if (sid) for (const tab of [undefined, 'dental', 'notes', 'visits']) {
      await p.evaluate(([sid, tab]) => { S.sid = sid; S.view = 'student'; S.back = S.back || 'students'; if (tab) S.tab = tab; try { render() } catch (e) {} }, [sid, tab]); await p.waitForTimeout(150);
      const bad = await p.evaluate(() => window.__xss || document.querySelectorAll('img[src="x"],svg[onload],[onerror],[onload]').length || 0);
      assert(!bad, user + ' learner page ' + tab + ' ran or built hostile HTML');
    }
    await p.evaluate(PAY => { const d = document.createElement('div'); d.innerHTML = mtextHtml(PAY + ' @' + PAY); document.body.appendChild(d); }, PAY); await p.waitForTimeout(100);
    assert(!(await p.evaluate(() => window.__xss || document.querySelectorAll('img[src="x"],svg[onload],[onerror]').length)), 'message text must be escaped');
    assert(!global.__dialog, 'no pop-up from injected script'); await p.close(); await h.stop();
  }
  console.log('xss ok');
})().catch(e => { console.error(e); process.exit(1); });
