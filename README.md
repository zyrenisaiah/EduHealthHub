# EduHealthHub: website files

Upload everything in this folder to your GitHub repository, keeping the folder layout (`css/` and `js/` stay folders).

| File | What it is |
|---|---|
| `index.html` | Home page and login |
| `doctor.html`, `nurse.html`, `dentist.html`, `teacher.html` | One page per role. Logging in sends you to your role's page. Opening another role's page sends you back to your own. |
| `css/style.css` | All styling (light and dark themes) |
| `js/config.js` | **Your database settings go here** (Supabase URL and key) |
| `js/data.js` | Constants, sections, LRN pattern, sample-student generator |
| `js/core.js` | Data loading, permissions, login screen, overview, student list, stock |
| `js/cloud.js` | Online sync (save, load, poll, login) |
| `js/app.js` | Student record, exam card, odontogram, teacher tools, PDF/HTML export, actions |
| `js/logo.js` | Logo and role pictures |
| `supabase-setup.sql` | Run once in Supabase SQL Editor |
| `accounts.txt` | The 30 starting accounts |

## Connect the shared database
1. Create a free project at supabase.com. In **SQL Editor** run all of `supabase-setup.sql`.
2. In **Project Settings > API** copy the Project URL and the anon/publishable key.
3. Open `js/config.js` and paste them between the quotes, then upload that file to GitHub.
4. Hard refresh the site, log in as Dummy Doctor1 / doctor1, and press **Upload starting data** on Overview (once).

Leave `js/config.js` empty to run each browser on its own (no sharing).
