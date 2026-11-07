// Two-step verification screens, against a fake online database: first login sets it up (QR, first code, recovery codes),
// later logins ask for a code, a wrong code is refused, a recovery code works once.
const assert = require('assert'), crypto = require('crypto'), { start } = require('./helpers');
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const unb32 = s => { let bits = ''; for (const c of s) bits += AL.indexOf(c).toString(2).padStart(5, '0'); const b = []; for (let i = 0; i + 8 <= bits.length; i += 8) b.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(b); };
const totp = (sec, ctr) => { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(ctr)); const h = crypto.createHmac('sha1', sec).update(m).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); };
(async () => {
  const h = await start({ width: 1000, height: 900 }), errs = [], syncTok = [];
  const st = { sec: null, pend: null, on: false, last: 0, codes: [], used: new Set() };
  const acct = on => ({ id: 'A1', role: 'Doctor', name: 'Dummy Doctor1', username: 'Dummy Doctor1', email: 'd@x.org', must_change: false, totp: on, need2fa: !on });
  const ok = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  const p = await h.ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://fake.supabase.co"').replace(/key:"[^"]*"/, 'key:"k"') }); });
  await p.route('https://fake.supabase.co/**', r => {
    const fn = r.request().url().split('/rpc/')[1], a = JSON.parse(r.request().postData() || '{}'), c = Math.floor(Date.now() / 30000);
    const good = (sec, code) => { for (const k of [c - 1, c, c + 1]) if (k > st.last && totp(sec, k) === code) { st.last = k; return true } return false };
    if (fn === 'app_login') return ok(r, st.on ? { totp: 'P1' } : { token: 'T1', account: acct(false) });
    if (fn === 'app_totp_begin') { st.pend = crypto.randomBytes(20); const s = (() => { let bits = ''; for (const b of st.pend) bits += b.toString(2).padStart(8, '0'); let o = ''; for (let i = 0; i < bits.length; i += 5) o += AL[parseInt(bits.slice(i, i + 5), 2)]; return o })(); return ok(r, { secret: s, username: 'Dummy Doctor1' }); }
    if (fn === 'app_totp_enable') { if (!good(st.pend, a.p_code)) return ok(r, { error: 'BAD_CODE' }); st.sec = st.pend; st.on = true; st.codes = Array.from({ length: 8 }, (_, i) => 'abcde-0000' + i); return ok(r, { codes: st.codes }); }
    if (fn === 'app_totp_login') { const rc = (a.p_code || '').toLowerCase(); if (good(st.sec, a.p_code) || (st.codes.includes(rc) && !st.used.has(rc) && st.used.add(rc))) return ok(r, { token: 'T2', account: acct(true) }); return ok(r, { error: 'BAD_CODE' }); }
    if (fn === 'app_sync') { syncTok.push(a.p_token); return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'SESSION_EXPIRED' }) }); }
    return ok(r, null);
  });
  const login = async () => { await p.goto(h.base + 'doctor.html'); await p.waitForSelector('#loginform'); await p.fill('#lu', 'Dummy Doctor1'); await p.fill('#pw', 'doctor1'); await p.click('#loginform [type=submit]'); };
  // 1) first login: set-up screen
  await login(); await p.waitForSelector('#enrollform svg');
  const key = (await p.textContent('#enrollform .mono')).replace(/\s/g, ''); assert.strictEqual(key.length, 32, 'key shown');
  assert(await p.$('#enrollform .qrbox svg'), 'QR drawn');
  await p.fill('#en-c', '000000'); await p.click('#enrollform [type=submit]'); await p.waitForSelector('#enrollform .pill.bad');
  assert(!(await p.$('.rcodes')), 'wrong first code must not finish set-up');
  const sec = unb32(key), c = Math.floor(Date.now() / 30000);
  await p.fill('#en-c', totp(sec, c)); await p.click('#enrollform [type=submit]'); await p.waitForSelector('.rcodes');
  assert.strictEqual((await p.$$('.rcodes span')).length, 8, '8 recovery codes');
  await p.click('[data-act=enrdone]'); await p.waitForSelector('#enrollform .pill.bad');   // box not ticked
  await p.check('#en-ok'); await p.click('[data-act=enrdone]'); await p.waitForTimeout(1200);
  assert(syncTok.includes('T1'), 'after set-up the session is opened');
  // 2) next login asks for a code
  await login(); await p.waitForSelector('#totpform');
  await p.fill('#tc', '123456'); await p.click('#totpform [type=submit]'); await p.waitForSelector('#totpform .pill.bad');
  await p.fill('#tc', totp(sec, c + 1)); await p.click('#totpform [type=submit]'); await p.waitForTimeout(1200);
  assert(syncTok.includes('T2'), 'good code opens the session');
  // 3) recovery code works once
  await login(); await p.waitForSelector('#totpform'); await p.fill('#tc', 'abcde-00000'); await p.click('#totpform [type=submit]'); await p.waitForTimeout(1200);
  assert.strictEqual(syncTok.filter(t => t === 'T2').length, 2, 'recovery code opens the session');
  await login(); await p.waitForSelector('#totpform'); await p.fill('#tc', 'abcde-00000'); await p.click('#totpform [type=submit]'); await p.waitForSelector('#totpform .pill.bad');
  assert.deepStrictEqual(errs, []); await h.stop(); console.log('twofa ok');
})().catch(e => { console.error(e); process.exit(1); });
