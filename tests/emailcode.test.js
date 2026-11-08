// Account with a linked Gmail: after the password, a 6-digit code is emailed; the right code logs in, a wrong one does not,
// resend works, and if email is not set up the screen says so and still offers Google.
const assert = require('assert'), { start } = require('./helpers');
(async () => {
  const h = await start({ width: 1000, height: 800 }), errs = [], sends = [], syncTok = [];
  let mailOk = true, tries = 0;
  const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://fake.supabase.co"').replace(/key:"[^"]*"/, 'key:"k"') }); });
  const ok = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  await p.route('https://fake.supabase.co/**', r => {
    const u = r.request().url(), a = JSON.parse(r.request().postData() || '{}');
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/functions/v1/google-auth')) return a.kind === 'start' && a.credential === 'good' ? ok(r, { pending: 'P2', hint: 'z***@gmail.com' }) : r.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'NO_GOOGLE_ACCOUNT' }) });
    if (u.includes('/functions/v1/send-code')) { sends.push(a); return mailOk ? ok(r, { ok: true, hint: 'z***@gmail.com' }) : r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'MAIL_NOT_SET_UP' }) }); }
    const fn = u.split('/rpc/')[1];
    if (fn === 'app_login') return ok(r, { pending: 'P1', hint: 'zy***@gmail.com' });
    if (fn === 'app_verify_login') { tries++; return a.p_code === '123456' ? ok(r, { token: 'T9', account: { id: 'T1', role: 'Teacher', name: 'Dummy Teacher 11A1', username: 'Dummy Teacher 11A1', email: 'z@x.org', must_change: false, need2fa: false } }) : ok(r, { error: 'BAD_CODE' }); }
    if (fn === 'app_sync') { syncTok.push(a.p_token); return r.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'SESSION_EXPIRED' }) }); }
    return ok(r, null);
  });
  const login = async () => { await p.goto(h.base + 'teacher.html'); await p.waitForSelector('#loginform'); await p.fill('#lu', 'Dummy Teacher 11A1'); await p.fill('#pw', 'x'); await p.click('#loginform [type=submit]'); };
  await login(); await p.waitForSelector('#codeform'); await p.waitForSelector('#codeform .pill.good');
  assert.strictEqual(sends.length, 1, 'code emailed automatically'); assert.strictEqual(sends[0].kind, 'login'); assert.strictEqual(sends[0].token, 'P1');
  assert((await p.textContent('#codeform .pill.good')).includes('z***@gmail.com'));
  await p.fill('#lc', '000000'); await p.click('#codeform [type=submit]'); await p.waitForSelector('#codeform .pill.bad');
  assert(!syncTok.length, 'wrong code does not log in');
  await p.click('[data-act=resendcode]'); await p.waitForFunction(() => document.querySelector('#codeform .pill.good')); await p.waitForTimeout(200); assert.strictEqual(sends.length, 2, 'resend');
  await p.fill('#lc', '123456'); await p.click('#codeform [type=submit]'); await p.waitForTimeout(1500);
  assert(syncTok.includes('T9'), 'right code logs in');
  // email not set up: says so, Google button area still there, no crash
  mailOk = false; await login(); await p.waitForSelector('#codeform .pill.bad'); await p.waitForSelector('#g-login', { state: 'attached' });
  assert((await p.textContent('#codeform .pill.bad')).includes('email setup'));
  // Google first, then the code (no password typed, no Google shortcut on the code screen)
  mailOk = true; sends.length = 0; await p.goto(h.base + 'teacher.html'); await p.waitForSelector('#loginform');
  await p.evaluate(() => googleStart('bad')); await p.waitForSelector('#loginform .pill.bad'); assert(!sends.length, 'unknown Google account: no code sent');
  await p.evaluate(() => googleStart('good')); await p.waitForSelector('#codeform .pill.good');
  assert.strictEqual(sends.length, 1); assert.strictEqual(sends[0].token, 'P2'); assert((await p.textContent('#codeform')).includes('Google confirmed'));
  assert.strictEqual(await p.locator('#g-login').count(), 0, 'no Google shortcut after Google-first');
  await p.fill('#lc', '123456'); await p.click('#codeform [type=submit]'); await p.waitForTimeout(1500); assert(syncTok.includes('T9'), 'code finishes the Google-first login');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('emailcode ok');
})().catch(e => { console.error(e); process.exit(1); });
