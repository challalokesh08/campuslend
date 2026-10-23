# CampusLend

Rent what you need from people on your campus, by the hour.

Browse the market, open a listing, message the owner, agree a time. The chat is the product — not a contact form bolted onto a listing page.

**Live site:** https://challalokesh08.github.io/campuslend/

---

## What this is

A static web app. No build step, no framework, no server of our own. Three text files of JavaScript and one of CSS, served as-is by GitHub Pages.

That has one hard consequence worth stating plainly: **GitHub Pages cannot run a backend.** It serves bytes. So accounts, storage and real-time messaging live in [Supabase](https://supabase.com), and this repo is only the client. All security therefore has to be enforced in the database, not in the browser. See [Security](#security).

Right now the deployed site runs in **demo mode** — a complete, clickable app backed by `localStorage`, with seeded listings and a simulated counterpart who types back. That exists so the link is useful before any backend does. Supply two values and it becomes the real thing.

---

## Run it locally

It is static files, so any file server works. The one thing you cannot do is double-click `index.html` — opening it over `file://` breaks the module loading and the hash router.

```bash
cd campuslend
python3 -m http.server 8787
# open http://localhost:8787
```

Demo sign-in: any `@cambridge.edu.in` address, code **123456**.

---

## Going live

The client is already written against Supabase; it is the two empty strings in `assets/js/config.js` that keep it in demo mode.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is enough for a campus).

2. **Run the schema.** Open `supabase/schema.sql`, paste the whole file into the project's SQL editor, run it once. It creates the four tables, the indexes, the policies, the realtime publication and the two storage buckets.

3. **Turn on email codes.** Authentication → Providers → Email: enable it. Authentication → URL Configuration: set the site URL to your Pages URL. The default Supabase email template includes a magic link — the app asks for the six-digit code instead, which is in the same email. If you want *only* the code, edit the template and remove the link.

4. **Copy two values** from Project Settings → API:
   - Project URL
   - `anon` `public` key

5. **Paste them in.**

   ```js
   // assets/js/config.js
   supabaseUrl: 'https://xxxxxxxx.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```

6. **Commit and push.** Pages redeploys in about a minute.

The `anon` key is *designed* to be public. Every visitor gets it. What stops one student reading another's messages is the row-level security in step 2 — nothing else. Never put the `service_role` key in this repo; it bypasses every policy.

### If sign-up is rejected

`enforce_campus_domain` in the schema only allows `@cambridge.edu.in`. To open it to a different college, change the domain in that function, in `assets/js/config.js`, and in `create_profile_for_user`. To drop the restriction entirely:

```sql
drop trigger if exists campus_domain_only on auth.users;
```

---

## Deploying

GitHub Pages, served straight from `main`:

**Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`.**

There is a `.nojekyll` file in the root. Without it, Jekyll would try to process the site and silently drop files; with it, Pages serves the bytes exactly as committed.

There is nothing to build. Pushing is deploying.

---

## How it is put together

```
index.html              shell, icon sprite, all view containers, sheets
assets/css/app.css      design tokens, layout, chat, sheets, auth, dark mode
assets/js/config.js     public config — the only file you edit to go live
assets/js/store.js      data layer: demo adapter and Supabase adapter
assets/js/app.js        router, views, chat, forms
supabase/schema.sql     tables, triggers, RLS, realtime, storage
vendor/supabase.js      @supabase/supabase-js 2.118.0, vendored
```

**One interface, two backends.** `CL.store` exposes the same methods either way — `listings()`, `conversations()`, `send()`, `subscribe()`. The UI never knows which one it is talking to. That is why demo mode is a real test of the chat rather than a mock of it: the bubbles, the ticks, the typing indicator, the optimistic send and the reconnect logic are the same code that will run against Postgres.

**Vanilla ES2020 on purpose.** No build step means no toolchain to rot, no `node_modules`, and a deploy that is literally `git push`. The whole client is about 60 KB of our own code plus the vendored SDK.

**Realtime.** In live mode the thread opens a Supabase channel filtered to one conversation: `INSERT` on `messages` for new messages, `UPDATE` for read receipts. In demo mode an `EventTarget` bus emits the same events, so the listener is identical.

---

## Security

The anon key is public, so the browser is treated as hostile. Every rule lives in Postgres:

| Table | Read | Write |
|---|---|---|
| `profiles` | any signed-in student | only your own row, and you cannot edit your own rating |
| `listings` | active listings, plus your own removed ones | only your own |
| `conversations` | only where you are a participant | only where you are a participant |
| `messages` | only in conversations you belong to | insert as yourself only; update only the read timestamp |

Two details that are easy to get wrong and are handled here:

- **Pairs cannot be duplicated.** `conversations` stores the two user ids sorted (`check (a_id < b_id)`) with a unique index on the pair. Two people opening a chat from opposite ends get one conversation, not two.
- **Read receipts are writes to someone else's row.** The recipient needs `UPDATE` on the sender's message to mark it read. A policy alone would therefore let them rewrite the text as well, so a trigger restricts an update to `read_at` and rejects any change to the body, sender, conversation or timestamp. Nothing can delete a message at all.

---

## What works

- Sign in with a college email and a six-digit code
- Market: search, category filter, responsive grid
- Listing detail with owner, price, condition, location
- Real-time chat: optimistic send, delivered/read ticks, day separators, message grouping, typing indicator, image messages, auto-scroll
- Unread counts on both the tab bar and the desktop rail
- Post a listing; remove your own
- Profile with a trust rating
- Dark mode, following the system and overridable
- Keyboard: Enter sends, Shift+Enter breaks the line, Escape closes sheets
- Lighthouse: 100 accessibility, 100 best practices, 100 SEO

## What is deliberately not here yet

- **Bookings and payment.** The capture flow stops at "agree in chat, pay over UPI on return." A real booking state machine is the next piece of product work, and it needs a decision about deposits first.
- **Push notifications.** A web app can do this later via a service worker; it was not worth a service worker before the messaging itself was proven.
- **Photo upload UI for listings.** The schema and bucket support it; the post form does not yet offer a file picker. Chat images do upload.
- **Moderation.** A campus pilot will need a report button and someone to read the reports.

---

## Notes

- GitHub Pages caches assets for about ten minutes. If a change does not appear, that is usually why — a hard reload shows it immediately.
- The college domain, campus name and bucket names are all in `assets/js/config.js`.
- `supabase/schema.sql` is re-runnable. It uses `if not exists` and `drop policy if exists` throughout, so a second run is safe.
- The schema has not been executed against a live Supabase project from this repo's tooling. Run it once in the SQL editor and confirm the four tables report `rowsecurity = true` (query at the end of the file) before inviting anyone.
- The old pre-rewrite version of this project was archived and removed at the owner's request. Nothing in this repo depends on it.
