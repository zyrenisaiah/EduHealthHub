// Fast check: every JavaScript file must parse, and every HTML page must load the scripts it needs.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let bad = 0;
for (const f of fs.readdirSync(root).filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); } catch (e) { bad++; console.error('SYNTAX ERROR in ' + f + '\n' + e.stderr); }
}
for (const f of ['index', 'doctor', 'nurse', 'dentist', 'teacher']) {
  const h = fs.readFileSync(path.join(root, f + '.html'), 'utf8');
  for (const s of ['config.js', 'core.js', 'app.js', 'chat.js']) if (!h.includes(s)) { bad++; console.error(f + '.html does not load ' + s); }
}
if (bad) process.exit(1); console.log('syntax: ok');
// No inline event handlers (the content security policy blocks them, and a typo in one broke the font loader once).
const bad2 = fs.readdirSync(root).filter(f => f.endsWith('.html')).filter(f => /\son[a-z]+\s*=\s*["']/i.test(fs.readFileSync(path.join(root, f), 'utf8')));
if (bad2.length) { console.error('Inline event handlers (onload=, onclick=...) found in: ' + bad2.join(', ')); process.exit(1); }
console.log('no inline handlers: ok');
