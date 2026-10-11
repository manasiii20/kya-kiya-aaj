# kya kiya aaj

A mobile-first daily log that makes getting things done feel good. Tick a task and it peels off as a sticky note onto today's pile. Review your day by swiping cards. Look back at a wall of piles.

## What's in it

- **today**: add, edit, recolour, reorder (drag the handle), filter, multi-select (long-press). Ticking flies a sticky onto today's pile with a little confetti. Unfinished things from earlier days can be brought over or let go.
- **review**: a swipe deck of the day's tasks (ticked ones too) mixed with silly yes/no questions. Right = did it, left = didn't. Works for any past day.
- **wall**: a calendar where each day shows its pile of done stickies. Tap a day to fan them out.
- **me**: notes to future you (they pop up now and then), your questions, and backup / export.

## Data

Everything is stored on the phone first (IndexedDB), so the app works fully offline and installs as a PWA.

Cloud backup is optional. With Supabase configured, the app silently creates an anonymous account and backs up in the background. You can attach an email under **me** to restore on another phone.

### Setting up backup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Turn on **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
4. Under **Authentication → URL Configuration**, add your Netlify URL to the redirect URLs.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`) locally and in Netlify's environment variables.

Without these the app runs on-device only.

## Develop

```sh
npm install
npm run dev
```

## Deploy (Netlify)

Connect the repo. `netlify.toml` already sets `npm run build` and publishes `dist`.
