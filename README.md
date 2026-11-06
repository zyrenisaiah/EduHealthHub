# EduHealthHub: files to upload

Upload ALL files in this folder to the TOP LEVEL of your GitHub repository (no folders). 14 files:
index.html, doctor.html, nurse.html, dentist.html, teacher.html, style.css, config.js, logo.js, data.js, core.js, cloud.js, app.js, supabase-setup.sql (README.md optional).

## Connect the shared database
1. Create a free project at supabase.com. In SQL Editor run all of `supabase-setup.sql`.
2. In Project Settings > API copy the Project URL and the anon/publishable key.
3. Open `config.js`, paste them between the quotes, save.
4. Hard refresh the site, log in as Dummy Doctor1 / doctor1, press "Upload starting data" on Overview (once).

Leave `config.js` empty to run each browser on its own (no sharing).

## Google confirmation (optional, recommended)
People can link their Google account under **My account**. After that, every login asks them to confirm with it, like "Continue with Google" on other sites.
1. Google Cloud Console (console.cloud.google.com): create a project, then **APIs & Services > OAuth consent screen** (External, publish to Production), then **Credentials > Create credentials > OAuth client ID > Web application**.
2. Under **Authorized JavaScript origins** add `https://zyrenisaiah.github.io`.
3. Copy the **Client ID** (it is public, no secret needed) into `GOOGLE_CLIENT_ID` in `config.js`, and into `CLIENT_ID` in `edge/google-auth.ts`, then deploy that function (name `google-auth`, JWT verification off).

## Speed, tracking and safety notes
- Images are separate cached files in `assets/`; scripts load with `defer`; pages show skeleton screens while data loads.
- Teachers only download learners from their own advisory. Staff download everything once, then only changes.
- Every change is written to `audit_log` (who, what, when). The Doctor can read it under **Activity log**.
- Run the whole `supabase-setup.sql` again after updating the site; it is safe to repeat.
- **Messages**: chat between accounts (teacher and clinic desk, clinic team, direct messages). A teacher's "send to clinic" pass appears as a live tracking card that updates as the clinic receives and times out the learner.

## Keeping the site healthy

**Tests.** `npm install`, then `npm test` runs the browser tests (they use fake local data and never touch the real database). `npm run check` checks every script for syntax errors. GitHub runs both automatically on every push (see `.github/workflows/ci.yml`); a red ✗ on a commit means something broke.

**Error reports.** If something breaks in anyone's browser, it is saved to the `error_log` table. They are not shown in the Doctor screen (it is a technical matter, not a clinical one). Read them in Supabase: Table editor > `error_log`, or ask for a check.

**Request caps.** Each signed-in account may make at most 300 requests a minute; beyond that the server answers `SLOW_DOWN`. Logins and messages have their own, tighter limits.

**Backups.**
- Every night at 03:00 (Manila time) the database copies all records into `backup_*` tables and keeps the last 7 days.
- There is no download-backup button. The database keeps its own nightly backup for 7 days (see `supabase-setup.sql`, BACKUPS).
- *Restore one learner* (SQL editor): `select id, at from backup_snapshots order by id desc;` then `select ehh_restore_student(<snapshot id>, '<student id>');`
- *Take a backup right now:* `select ehh_backup('before big change');`
- These in-database copies protect against bad edits and deletions. They do not protect if the whole Supabase project is lost, which is why the downloaded file matters. Do it weekly, and on a paid Supabase plan turn on its own daily backups too.

**Login rules.** Usernames and passwords are case-sensitive (`Dummy Doctor1` is not `dummy doctor1`; spaces count). Email addresses are not. 5 wrong tries lock that name for 5 minutes, 10 wrong tries for 15 minutes (changing capitals does not get around the lock), and a site-wide brake stops guessing across many names. Sessions last 8 hours, at most 5 per account, end after 15 idle minutes, and end when the browser or tab is closed (the next visit revokes it on the server; a session with no sign of life for 10 minutes is dead anyway). New passwords need 10+ characters with a letter and a number, and changing a password signs out the account's other sessions. The demo accounts use short demo passwords (see the account list in `supabase-setup.sql`); a Doctor can reset any password from the Accounts screen. See **GO-LIVE.md** for everything to do before real student data goes in (including `select ehh_require_password_change();`).

**Live updates.** Messages and record changes appear within a moment, with no refresh. The database sends each signed-in browser an empty "something changed" ping (Supabase Realtime, on a secret per-session channel name); the browser then fetches what it is allowed to see through the normal checked calls. No health data travels over the live channel. If the live connection is down, pages quietly go back to checking every few seconds.
