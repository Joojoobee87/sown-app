# Sown dev backlog

Running list of known issues and follow-ups. Newest first.

## Domain and email (noted 4 Nov 2026)

- App moves to `https://app.sowngarden.co.uk` (free subdomain of the IONOS domain; CNAME to Vercel). `sowngarden.co.uk` stays the marketing website.
- Vercel: add `app.sowngarden.co.uk`, redirect `sown-app.vercel.app` to it. Supabase Site URL and Redirect URLs updated to match.
- Reinstall the PWA and re-allow notifications from the new address (push subscriptions are tied to the old origin).
- Before launch: send Supabase auth emails from the domain (e.g. `hello@sowngarden.co.uk`) via custom SMTP, so they look trustworthy and stay out of spam.

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

- ~~Apply the catalogue migration~~ (applied 4 Nov 2026, old test data copied). Next: move the Scan screen onto the new tables (branch `scan-new-catalogue`). It currently saves AI-written `toxic` text to the old `plants` table (`Scan.jsx:670`).
- Point `PlantProfile.jsx:301` and the manual search (`Scan.jsx:625`) at the new tables.
- Build the admin screen: label photo, Claude draft, HTA safety lookup, approve.
