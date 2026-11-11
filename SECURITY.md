# EduHealthHub security notes

No website is "unhackable". This is what protects this one, what was tested, and what is still the school's job.

## Built in
- **Database locked.** Every table has row security on and no public access. The browser can only call named, checked functions, and every one needs a valid session token.
- **Logins.** Passwords are bcrypt-hashed, case-sensitive, 10+ characters with a letter and number. Wrong tries slow down and lock (5 tries: 5 minutes, 10 tries: 15 minutes), and the answer never says which part was wrong.
- **Two-step verification** (authenticator app + recovery codes). Built and tested. It is a switch: `update public.app_flags set v=true where k='require_2fa';` turns it on for everyone.
- **Sessions.** 8 hours at most, end when the browser closes, one signed-in account per browser, 300 requests a minute per account, deactivated accounts are cut off at once.
- **Roles enforced on the server**, not just hidden in the page: Teachers only reach their advisory section, only Doctors manage accounts and approvals.
- **Activity log** of who did what. Nightly backup kept 7 days.
- **Page rules (CSP).** Only the site's own scripts and Google sign-in run; no inline scripts; connections only to the database; no outside images, frames or plug-ins; the site cannot be shown inside another website's frame; no referrer is sent.
- **Uploads.** Only PDF, JPG, PNG, WebP, GIF, DOCX, XLSX and TXT, size-capped, names cleaned; profile pictures only JPG, PNG or WebP (no SVG).
- **Google sign-in** is checked on the server: audience, issuer, expiry and verified email.

## Tested (run `node tests/run.js`)
- `xss.test.js`: hostile text (script and image tricks) put into every learner, account, stock and sign-up field never runs or becomes live HTML on any screen of any role.
- Database tests: a Doctor cannot do admin things, a session cannot be reused after logout or deactivation, the login code step cannot be skipped or replayed.

## Known limits (honest list)
- **The demo passwords are public** in this repository (`supabase-setup.sql` and git history). Anyone who reads the repo can log in as `Test Doctor1`. Fine for dummy data. **Before any real record goes in:** give every account a new random password (Accounts > Reset password, or `select ehh_require_password_change();` followed by people choosing their own right away), turn two-step on, and consider making the repository private.
- A person who keeps guessing can temporarily lock a victim's account (5 tries = 5 minutes). That is the price of stopping password guessing.
- The free Supabase plan has no point-in-time recovery and can pause an idle project.
- Supabase's own sign-up (email accounts) is not used by this site. In the Supabase dashboard, Authentication > Sign In / Providers, switch off "Allow new users to sign up" so nobody can create unused logins there.
- The unused `send-code` function (email codes) is deployed. It needs a valid session to do anything and has no mail secrets set, but delete it in the dashboard (Edge Functions) if you will not use emailed codes.
- Phones and computers themselves: lock screens, shared computers and shoulder-surfing are outside what a website can fix.
