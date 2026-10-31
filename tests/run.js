// Runs every tests/*.test.js, each in its own process, and fails if any fail.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
  const t = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 180000 });
  const ok = r.status === 0; if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + f + ' (' + ((Date.now() - t) / 1000).toFixed(1) + 's)');
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
}
console.log(failed ? failed + ' test file(s) failed' : 'all ' + files.length + ' test files passed');
process.exit(failed ? 1 : 0);
