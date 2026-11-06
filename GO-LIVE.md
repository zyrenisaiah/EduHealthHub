# Before real student data goes in

Health records are sensitive personal information (in the Philippines, covered by the Data Privacy Act of 2012, RA 10173). Everything below marked **Code** is already built; **You** means a step only the school can do.

## 1. Accounts and passwords
- [ ] **You** Replace the demo accounts. Each real person gets their own account; shared logins ("Dummy Nurse1") must not be used for real data.
- [ ] **You** Force a new password for everyone: in the Supabase SQL editor run `select ehh_require_password_change();`. Each person then chooses their own password (10+ characters, a letter and a number) at next login, and cannot open any record before that.
- [x] `accounts.txt` was removed from the repository. Its old contents stay in the git history, and the demo passwords are also visible in `supabase-setup.sql`, so still run the forced password change.
- [x] **Code** Case-sensitive logins, lockouts after 5 and 10 wrong tries, 8-hour sessions, one signed-in account per browser (a second tab cannot log in as someone else), no idle timeout (a session ends when the browser or tab closes, after 8 hours, or on log out).

## 2. Who may see what (decide, then check it matches)
- [x] **Code** Roles are enforced by the database, not only the screen: Doctor (everything except dental edits), Nurse (no clearances or care plans), Dentist (dental only), Teacher (own advisory, pass and status only, no medical details).
- [ ] **You** Confirm with the school head and the doctor that this matrix is what the school wants. Change roles by editing the permission rules in `supabase-setup.sql` (`app_save_students`).
- [ ] **You** Decide who the **Data Protection Officer** is. The DPO should read the Activity log.

## 3. Tracking
- [x] **Code** Every change to a record is logged (who, what, when). Every time someone **opens** a learner's record is logged too (once per person per learner every 10 minutes). The Doctor reads both in **Activity log** (Changes / Records opened / Everything).
- [x] **Code** Browser errors are saved to the `error_log` table for the site maintainer (not shown to clinical staff).
- [ ] **You** Review the Records opened list regularly (suggested: weekly) for people looking at learners they have no reason to see.

## 4. Backups
- [x] **Code** Nightly in-database backup (7 days). The Doctor **Download backup** button was removed on request.
- [ ] **You** Download a backup weekly and keep it somewhere private (encrypted drive). The file contains health records.
- [ ] **You** The free Supabase plan can pause an unused project and has no point-in-time recovery. Consider the paid plan with daily backups once real data is in.

## 5. Consent, notices and retention (school decisions)
- [ ] **You** Parents/guardians (or learners aged 18+) are informed what is recorded and why, and consent where required. Update `privacy.html` and `terms.html` with the school's real wording and contact.
- [ ] **You** Decide how long records are kept and who deletes them after a learner leaves.
- [ ] **You** Staff sign a confidentiality agreement before getting an account.
- [ ] **You** Decide what to do if there is a breach: the Data Privacy Act requires telling the National Privacy Commission and affected people within 72 hours.

## 6. Technical safety nets already in place
- Pages only load scripts from the site itself and Google sign-in, and only talk to Supabase (content security policy). No page sends a referrer.
- Every table is locked; browsers can only call the checked functions. Each account is capped at 300 requests a minute.
- Live updates carry no data; they only tell the browser to refresh.
- Automatic tests run on every push (GitHub Actions).

## 7. Known limits
- The demo mode ("offline") stores data in the browser. **Never use it for real data.**
- The site is hosted on GitHub Pages and Supabase's free tier. Fine for a pilot; for a whole school consider paid plans and a Philippine or Singapore data region review.
