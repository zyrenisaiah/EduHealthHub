# EduHealthHub: files to upload

Upload ALL files in this folder to the TOP LEVEL of your GitHub repository (no folders). 14 files:
index.html, doctor.html, nurse.html, dentist.html, teacher.html, style.css, config.js, logo.js, data.js, core.js, cloud.js, app.js, supabase-setup.sql, accounts.txt (README.md optional).

## Connect the shared database
1. Create a free project at supabase.com. In SQL Editor run all of `supabase-setup.sql`.
2. In Project Settings > API copy the Project URL and the anon/publishable key.
3. Open `config.js`, paste them between the quotes, save.
4. Hard refresh the site, log in as Dummy Doctor1 / doctor1, press "Upload starting data" on Overview (once).

Leave `config.js` empty to run each browser on its own (no sharing).
