# EduHealthHub: files to upload

Upload ALL files in this folder to the TOP LEVEL of your GitHub repository (no folders). 14 files:
index.html, doctor.html, nurse.html, dentist.html, teacher.html, style.css, config.js, logo.js, data.js, core.js, cloud.js, app.js, supabase-setup.sql, accounts.txt (README.md optional).

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
