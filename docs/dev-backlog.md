# Sown dev backlog

Running list of known issues and follow-ups. Newest first.

## Polish after the catalogue move (noted 5 Nov 2026)

To do once Home and Calendar are on the new tables.

- **Intro guide (onboarding):** fix styling and positioning.
- **Show the guide only once, after registering.** Today "seen the guide" is stored only in the browser (`localStorage` key `sown_onboarded`, set in `Onboarding.jsx`, checked in `ProtectedRoute.jsx`), so it reappears on every new device, browser or home-screen install, and after site data is cleared. Store it on the account instead (e.g. `user_profiles`), and add a "View the intro guide again" option in settings. `About.jsx:158` already has a way to re-show it; move or reuse that.
- **Seed S logo (top left):** bigger and bolder. It's a key part of the branding and shouldn't fade into the background.
- **Fonts:** make font styles consistent and on brand across all screens.

## Domain and email (noted 4 Nov 2026)

- App moves to `https://app.sowngarden.co.uk` (free subdomain of the IONOS domain; CNAME to Vercel). `sowngarden.co.uk` stays the marketing website.
- Vercel: add `app.sowngarden.co.uk`, redirect `sown-app.vercel.app` to it. Supabase Site URL and Redirect URLs updated to match.
- Reinstall the PWA and re-allow notifications from the new address (push subscriptions are tied to the old origin).
- Done 4 Nov: Supabase custom SMTP via `hello@sowngarden.co.uk` (smtp.ionos.co.uk:465). SPF, DKIM and DMARC all pass, but Gmail still filed the first reset email as spam (new sender).
- Before launch: rewrite Supabase email templates (Authentication → Emails → Templates) in Sown's voice and branding; consider a dedicated sending service (Resend / Postmark) once there are real users.
- (superseded) send Supabase auth emails from the domain (e.g. `hello@sowngarden.co.uk`) via custom SMTP, so they look trustworthy and stay out of spam.

## Login and password reset (noted 4 Nov 2026)

**Status:** fix merged to `master` on 4 Nov 2026 (branch `fix-login-links`): `vercel.json` rewrite, recovery links detected app-wide, clearer expired-link handling. To test in production: in-app "Forgot password" and a dashboard-sent recovery email.

**Symptoms**
1. "Forgot password" in the app sends an email, but the link opens a **Page not found** error.
2. A password recovery email sent from the Supabase dashboard logs the user straight in and lands on the home dashboard, with no chance to set a new password.

**Likely causes (found while investigating, not yet fixed)**
1. There is no `vercel.json`, so Vercel has no SPA rewrite. Loading any deep link directly (e.g. `/password-reset`) returns Vercel's 404 instead of the React app. This will affect every route opened from an email or a bookmark, not just password reset.
2. Recovery links from the dashboard redirect to the Site URL (`/`), not `/password-reset`. The `PASSWORD_RECOVERY` event is only listened for in `src/screens/PasswordReset.jsx`, so when the app opens on `/` the event is ignored and the user is simply signed in.

**Suggested fix**
- Add `vercel.json` with a rewrite of all paths to `/index.html`.
- Listen for `PASSWORD_RECOVERY` app-wide (e.g. in `App.jsx` or the auth provider) and navigate to `/password-reset` whenever it fires.
- In Supabase **Authentication → URL Configuration**, add the live `/password-reset` URL (and `http://localhost:5173/password-reset`) to Redirect URLs.
- Test both routes: in-app "Forgot password" and a dashboard-sent recovery email.

**Workaround meanwhile:** sign in via a recovery or magic link, then change the password from the Profile screen (it already uses `supabase.auth.updateUser`).

## Next build priorities

- ~~Apply the catalogue migration~~ (applied 4 Nov 2026, old test data copied).
- ~~Move Scan and catalogue search onto the new tables~~ (merged 4 Nov 2026; daily AI limits: lookup 20, scan 50).
- ~~Move Library and Garden Zones onto the new tables~~ (merged 5 Nov 2026).
- Next: move Home and Calendar (including "mark as done") onto the new tables; remove the unused `PlantProfile.jsx` (`/plant/:id`), which still writes to the old `plants` table.
- Then: drop the old tables (`plants`, `user_plants`, `garden_zones`, `user_task_completions`) once nothing reads them.
- Build the admin screen: label photo, Claude draft, HTA safety lookup, approve.
