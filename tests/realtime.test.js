// Live updates: the browser joins its private channel, refreshes on a ping, and falls back to polling when the socket drops.
const assert = require('assert'), { chromium } = require('playwright'), { start } = require('./helpers');
(async () => {
  const h = await start(), browser = await chromium.launch(), p = await browser.newPage(), frames = []; let server = null;
  p.on('pageerror', e => { throw e; });
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://test.supabase.co"').replace(/key:"[^"]*"/, 'key:"pubkey"') }); });
  await p.route('https://test.supabase.co/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"x"}' }));
  await p.route('https://test.supabase.co/rest/v1/rpc/app_rt', r => r.fulfill({ status: 200, contentType: 'application/json', body: '"secretkey123"' }));
  await p.routeWebSocket(/test\.supabase\.co\/realtime\/v1\/websocket/, ws => {
    server = ws; ws.onMessage(m => { const f = JSON.parse(m); frames.push(f); if (f.event === 'phx_join') ws.send(JSON.stringify({ topic: f.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: f.ref })); });
  });
  await p.goto(h.base + 'index.html'); await p.waitForSelector('#loginform');
  await p.evaluate(() => { window.__polls = 0; window.__syncs = 0; TOK = 'tok'; S.user = { id: 'A1', role: 'Doctor' }; cloudPollOnce = async () => { window.__polls++; }; msgSync = async () => { window.__syncs++; }; });
  await p.evaluate(() => rtStart()); await p.waitForFunction(() => RT_ON === true, null, { timeout: 5000 });
  const join = frames.find(f => f.event === 'phx_join');
  assert.strictEqual(join.topic, 'realtime:rt:secretkey123', 'joins the private channel for this session');
  assert.strictEqual(join.payload.config.private, false); assert(!JSON.stringify(frames).includes('"tok"'), 'session token is never sent over the socket');
  // a ping makes the page refresh (once, even if several arrive together)
  for (let i = 0; i < 3; i++) server.send(JSON.stringify({ topic: 'realtime:rt:secretkey123', event: 'broadcast', payload: { event: 'ping', payload: {} } }));
  await p.waitForTimeout(400);
  assert.strictEqual(await p.evaluate(() => window.__polls), 1, 'three pings in a burst refresh once'); assert.strictEqual(await p.evaluate(() => window.__syncs), 1);
  // a ping for someone else's channel is ignored
  server.send(JSON.stringify({ topic: 'realtime:rt:other', event: 'broadcast', payload: { event: 'ping', payload: {} } })); await p.waitForTimeout(300);
  assert.strictEqual(await p.evaluate(() => window.__polls), 1, 'other channels ignored');
  // socket drops: fall back to polling
  server.close(); await p.waitForFunction(() => RT_ON === false, null, { timeout: 5000 });
  // logout stops the connection for good
  await p.evaluate(() => rtStop()); assert.strictEqual(await p.evaluate(() => RT_ON), false);
  await browser.close(); await h.stop(); console.log('realtime ok');
})().catch(e => { console.error(e); process.exit(1); });
