# Admin access and the presentation demo

One doc: how to get into `/admin`, and a script to run the live demo end to end. For the
background on *why* each piece looks the way it does, see `docs/MAP.md`.

## Quick reference

| What | Where |
|---|---|
| **Live site** (production, real Supabase data) | <https://forged-configurator.vercel.app> |
| **Admin portal** | <https://forged-configurator.vercel.app/admin> |
| **Dealer portal** | <https://forged-configurator.vercel.app/dealer> (not ready to demo yet — see below) |
| Supabase project (if you ever need the dashboard) | `qxlfkfhzpqbxffuqqewg` — <https://supabase.com/dashboard/project/qxlfkfhzpqbxffuqqewg> |

## 1. Accessing the admin portal

1. Go to **<https://forged-configurator.vercel.app/admin>**.
2. Sign in with an admin email and password.
   - One admin account already exists and is confirmed/working: `fazal@novahavens.com`
     (created per `docs/HANDOVER.md` §1). If you know that password, just sign in.
   - **Forgot the password, or signing in for the first time?** Click **"First time here, or
     forgot your password?"** on the sign-in card. It emails a set-password link (via Supabase
     Auth) that returns you to `/admin` to set a new one (minimum 10 characters). This is the
     normal way in — nobody needs to hand you a password in chat or anywhere else.
   - **Need a second admin** (e.g. for the client to sign in too)? In the Supabase dashboard:
     **Authentication → Users → Add user**, tick **Auto Confirm User**, then run in the SQL
     Editor: `insert into public.admin_users (email) values ('their@email.com');`. Full steps:
     `docs/HANDOVER.md` §1, `.claude/skills/forgedsa-catalogue-admin/SKILL.md`.
3. **If it says "not on the admin allowlist"**: either the email isn't in `public.admin_users`,
   or (since migration `20261110170000`) the account's email isn't confirmed yet in Supabase Auth.
   Fix: tick **Auto Confirm User** when creating the account, or send a password-recovery link to
   confirm it. Details in `docs/ACCOUNTS.md` owner step 5c.

### What's inside

Six tabs: **Cars, Wheels, Finishes, Paints, Dealers, Enquiries.**

- **Cars / Wheels / Finishes / Paints** — edit prices, sizes, names, visibility (*Visible in
  configurator*), sort order, and upload files (car GLB, rim GLB/photo). Changes apply to the
  live site immediately — no deploy needed.
- **Dealers** — add/remove dealerships and which emails may sign in for each.
- **Enquiries** — every PDF download and enquiry lead, with Reply, Open build, status, notes,
  dealership assignment, and CSV export.

## 2. The demo script

This is what works on the live site **right now**, no setup required. It needs nothing from the
owner beforehand — just open the production URL.

### Part A — the customer journey (anonymous, ~3 minutes)

1. Open **<https://forged-configurator.vercel.app>**. The welcome screen cycles stills of the
   four prepared cars (M2 CS, M4 CS, M5, M5 Touring) — scroll, swipe, or use the arrows to pick
   one, then **Enter**.
2. You land straight in the configurator (no separate "showroom" step). Walk the stepped drawer:
   **1 Paint** → pick a colour → **2 Wheels** → pick one of the six stocked wheels (point out
   that these are real 3D rim files, not photos — rotate the camera to show it) → **3 Size** →
   **4 Finish** → pick a finish (Gold and Pure Bronze read best on camera; Liquid Metal and Hyper
   Black show the reflection work from `docs/CHECKPOINT.md`'s 2026-11-12 entry).
3. Use the camera chips (**Front / Side / Rear / Wheel / Top**) or the turntable button to show
   the car from a few angles.
4. Go to **Summary**. Show **Share summary** (a short code / link that reopens this exact build)
   and **Download PDF** (the two-page branded spec sheet — it asks for email + mobile first,
   which is the lead capture).
5. Optional: **Enquire** to show the lead form. *Use a throwaway address like
   `qa-test@forgedsa.com` if you actually submit it* — every real submission emails the owner
   (`.claude/skills/forgedsa-lead-email-automation/`).

### Part B — the admin view (~2 minutes)

6. Open **/admin** in a new tab, sign in (see §1 above).
7. Show **Enquiries**: the lead you just created (if you submitted one) appears here with its
   source (`pdf` or `enquiry`), ready to reply to or export.
8. Show one of the catalogue tabs (e.g. **Wheels**) — point out a price, a finish toggle, and
   that unticking *Visible in configurator* is how something is hidden without deleting it.

### What to skip for now

- **Dealer login (`/dealer`)** and **customer Google sign-in** are not live yet — both need
  one-time owner steps in the Supabase/Google Cloud dashboards that haven't been done (tracked in
  `.10x/status.md` under `presentation-ready` → "Open, owner only"). If you want either working
  before the real presentation:
  - Customer Google sign-in: `docs/ACCOUNTS.md` owner steps 1–4.
  - Dealer sign-in: `docs/DEALERS.md` "Owner steps" 3–4 (add the dealership + email in
    `/admin` → Dealers, then create that person's Supabase Auth user).
- Until either is done, the honest demo line is: "customer accounts and dealer logins are built
  and tested — they're switched on with a couple of dashboard clicks when you're ready for them."

## See also

- `docs/MAP.md` — how the whole repo fits together.
- `docs/CHECKPOINT.md` — most recent change log (why the rims look the way they do today).
- `docs/HANDOVER.md` — full client handover, including every manual test script.
- `.10x/status.md` — current open items, owner-only blockers.
