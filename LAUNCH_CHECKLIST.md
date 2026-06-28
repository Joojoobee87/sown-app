# Sown — Pre-launch checklist

Work through this list before going into production.

---

## API & costs

- [ ] **Gate or remove "Refresh care info" button** — every tap calls the Claude API at the same cost as a scan. Either remove it, restrict it to Pro users, or add a rate limit in the edge function before opening to the public.
- [ ] **Rate limit the identify-plant edge function** — without a limit, a single user could spam scans and run up significant API costs. Add per-user rate limiting (e.g. 20 scans/day) in the edge function using Supabase to track usage.
- [ ] **Review Claude model choice** — currently using `claude-haiku-4-5-20251001` for scans. Confirm this is still the best cost/quality balance at launch time.

## Infrastructure

- [ ] **Run all database migrations** — ensure all migration files in `supabase/migrations/` have been executed in the production Supabase project:
  - `20260621_garden_zones_attributes.sql`
  - `20260626_plants_care_columns.sql`
  - `20260627_push_subscriptions.sql`
- [ ] **Deploy both edge functions** — confirm `identify-plant` and `send-monthly-reminders` are deployed and working in production.
- [ ] **Verify Supabase secrets** — `ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` all set in production edge function secrets.
- [ ] **Verify Vercel environment variables** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` set for the production deployment.
- [ ] **Confirm GitHub Actions secrets** — `SUPABASE_URL` and `SUPABASE_ANON_KEY` set so the monthly reminders cron fires correctly.

## Security & data

- [ ] **Audit Supabase RLS policies** — confirm row-level security is enabled and correctly scoped on all tables: `user_plants`, `garden_zones`, `push_subscriptions`. The `plants` table is shared species data and should be readable by all authenticated users but only writable by the edge function (service role).
- [ ] **Review auth settings** — confirm email confirmation is enabled, password requirements are set, and OAuth providers (if any) are configured correctly in Supabase.
- [ ] **Check `.env` is not committed** — verify `.gitignore` excludes `.env` and no secrets are in the git history.

## Features & UX

- [ ] **Test push notifications end-to-end** — use GitHub Actions → Run workflow to manually trigger `send-monthly-reminders` and confirm a notification arrives on a real device.
- [ ] **Test on iOS Safari** — camera scan, push notification permission prompt, sheet scrolling, keyboard behaviour on forms.
- [ ] **Test on Android Chrome** — same checks as above.
- [ ] **Weather card** — currently shows "Weather integration coming soon". Either integrate a weather API or remove the placeholder before launch.
- [ ] **Sown Pro upgrade flow** — the upgrade sheet exists but the "Upgrade to Pro" button does nothing. Either wire up a payment provider (e.g. Stripe) or remove the Pro prompts until billing is ready.
- [ ] **About screen** — review content is accurate and up to date.
- [ ] **Delete account** — currently shows "Contact support to request account deletion". Ensure there is a working support contact before launch (GDPR requirement).

## Performance

- [ ] **Wikipedia photo fallback** — plants with no Wikipedia article will have no photo. Consider a generic botanical illustration fallback image rather than the SVG placeholder for a more polished look.
- [ ] **Bundle size** — build currently warns about chunk size (>500kB). Consider code-splitting by route before launch if load time on mobile is an issue.

---

_Last updated: June 2026_
