// A script error in the browser must be sent to the error_log reporter (cloud mode), deduplicated and capped.
const assert = require('assert'), { chromium } = require('playwright'), { start } = require('./helpers');
(async () => {
  const h = await start(), browser = await chromium.launch(), p = await browser.newPage(), sent = [];
  await p.route(/fonts\./, r => r.abort());
  await p.route('**/config.js', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/url:"https:[^"]*"/, 'url:"https://test.supabase.co"').replace(/key:"[^"]*"/, 'key:"k"') }); });
  await p.route('https://test.supabase.co/**', r => { const u = r.request().url(); if (/app_report_error/.test(u)) { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, body: 'null', contentType: 'application/json' }); } r.fulfill({ status: 400, body: '{"message":"x"}', contentType: 'application/json' }); });
  await p.goto(h.base + 'doctor.html'); await p.waitForSelector('#loginform');
  await p.evaluate(() => { setTimeout(() => { throw new Error('boom one'); }, 0); setTimeout(() => { throw new Error('boom one'); }, 5); for (let i = 0; i < 9; i++) setTimeout(() => { throw new Error('other ' + i); }, 10 + i); });
  await p.waitForTimeout(600);
  assert(sent.some(s => s.p_data.msg.includes('boom one')), 'error should be reported');
  assert.strictEqual(sent.filter(s => s.p_data.msg.includes('boom one')).length, 1, 'same error must be reported only once');
  assert(sent.length <= 5, 'at most 5 reports per page, got ' + sent.length);
  assert(sent[0].p_data.page.endsWith('.html') && sent[0].p_data.ua, 'report carries page and browser');
  await browser.close(); await h.stop(); console.log('error-report ok');
})().catch(e => { console.error(e); process.exit(1); });
