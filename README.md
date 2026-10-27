# EduHealthHub: files to upload

Upload ALL files in this folder to the TOP LEVEL of your GitHub repository (no folders). 14 files:
index.html, doctor.html, nurse.html, dentist.html, teacher.html, style.css, config.js, logo.js, data.js, core.js, cloud.js, app.js, supabase-setup.sql, accounts.txt (README.md optional).

## Connect the shared database
1. Create a free project at supabase.com. In SQL Editor run all of `supabase-setup.sql`.
2. In Project Settings > API copy the Project URL and the anon/publishable key.
3. Open `config.js`, paste them between the quotes, save.
4. Hard refresh the site, log in as Dummy Doctor1 / doctor1, press "Upload starting data" on Overview (once).

Leave `config.js` empty to run each browser on its own (no sharing).

## Gmail confirmation (optional, recommended)
Each person can link their own Gmail under **My account**. After that, every login needs a 6-digit code emailed to it.
The emails are sent by the Supabase Edge Function `send-code` (source in `edge/send-code.ts`). It needs two secrets in
Supabase > Edge Functions > Secrets:
- `GMAIL_USER`: the Gmail address that sends the codes (a dedicated one, e.g. eduhealthhub.noreply@gmail.com)
- `GMAIL_APP_PASSWORD`: a Google "App password" for that Gmail (Google Account > Security > 2-Step Verification > App passwords)
