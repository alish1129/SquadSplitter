# Squad Split

A React + Supabase app for a pickup soccer group: members sign in with a
magic link and can mark themselves IN for the week; admins rate players,
manage positions, and generate two balanced teams. Public visitors can view
the roster and teams without signing in.

## 1. Set up the database

In your Supabase project dashboard: **SQL Editor -> New query**, paste the
entire contents of `supabase/schema.sql`, and run it. It's safe to re-run if
you ever need to.

This creates the tables, security policies, and a trigger so every new
sign-in automatically gets a profile and a roster entry.

**Enable email sign-in:** Authentication -> Providers -> make sure Email is
enabled, and under Authentication -> URL Configuration set your Site URL
(e.g. `http://localhost:5173` for now, your real domain once deployed) and
add it to Redirect URLs too — that's where the magic-link email sends people
back to.

## 2. Configure the app

```bash
cp .env.example .env
```

Open `.env` and fill in your project's URL and anon key, found in
**Project Settings -> API** in the Supabase dashboard.

## 3. Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL, sign in with your own email, and check your
inbox for the magic link.

## 4. Make yourself the first admin

Nobody is an admin until you say so. After signing in once, go back to the
Supabase SQL Editor and run (with your real email):

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

Refresh the app — you'll now see "Manage roster" and "Admins" panels, where
you can promote other people to admin straight from the UI (no more SQL
needed after this).

## 5. Deploy it publicly (Vercel)

1. Push this project to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in, **Add New -> Project**,
   and import that repository. Vercel auto-detects Vite — no build config
   needed.
3. Before deploying, add the two environment variables from your `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under the project's
   **Environment Variables** settings.
4. Deploy. Vercel gives you a public `*.vercel.app` URL.
5. Back in Supabase (**Authentication -> URL Configuration**), add that
   Vercel URL to both the Site URL and Redirect URLs, so magic links sent in
   production point to the right place.

Share the Vercel link with your group — anyone can open it and view the
roster/teams, and anyone who signs in gets added to the roster automatically.

## How it works

- **Roster & ratings** live in Supabase's `players` table (name, up to two
  positions, a 1–100 rating, and whether they're IN this week).
- **Row Level Security** enforces the rules server-side, not just in the UI:
  everyone can read the roster; only admins can edit ratings/positions or
  add/remove players; a signed-in member can only toggle their *own* IN
  status (enforced through a dedicated database function, not the raw
  table).
- **Realtime**: the app subscribes to live database changes, so everyone
  viewing the page sees updates immediately — no refresh needed.
- **Team generation** (`src/lib/teamBalancer.js`) groups the IN players by
  position, then hands each one (highest rating first) to whichever team
  currently has the lower total rating, keeping both skill and position mix
  close.

## Project structure

```
supabase/schema.sql       one-time database setup (tables, policies, RPC, trigger)
src/App.jsx                top-level state, data loading, realtime subscriptions
src/supabaseClient.js      Supabase client, reads .env
src/lib/teamBalancer.js    pure team-splitting logic
src/components/            UI: auth widget, turnout list, teams, roster manager, admin list
```
