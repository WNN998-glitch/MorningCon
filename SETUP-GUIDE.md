# Morning Report — Setup Guide

A web app for collecting morning report cases (hospital number, chief complaint,
HPI, exam, investigations, diagnosis, management, photos) from your phone, and
presenting them — fullscreen slideshow or PowerPoint export — from any computer
with internet. No Claude account needed to use it day-to-day.

You only need to do this setup once. Total time: about 10–15 minutes.

---

## Step 1 — Create your Supabase project (free)

1. Go to https://supabase.com and sign up / log in.
2. Click **New Project**. Pick any name (e.g. "morning-report"), set a database
   password (save it somewhere — you likely won't need it again, but keep it),
   pick the region closest to you, and create the project. Wait ~1 minute for it
   to finish provisioning.

## Step 2 — Create the database table

1. In your new Supabase project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase-setup.sql` (included alongside this guide), copy
   everything in it, and paste it into the SQL editor.
4. Click **Run**. You should see "Success. No rows returned."

This creates one table called `cases`, and locks it down so that only your own
logged-in account can ever read or write your own rows — even though the
website itself will be public.

## Step 3 — Get your API keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. You'll need two values from this page:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

Keep this tab open, you'll paste these into `config.js` next.

## Step 4 — Plug your keys into the app

1. Open the `dist` folder (included in this download).
2. Open `config.js` in it using Notepad (right-click → Open with → Notepad).
3. Replace `REPLACE_WITH_YOUR_SUPABASE_URL` with your Project URL, and
   `REPLACE_WITH_YOUR_SUPABASE_ANON_KEY` with your anon public key. Keep the
   quotation marks around each value.
4. Save the file (Ctrl+S), keeping it as `config.js`.

## Step 5 — Deploy the site (no Git, no command line)

1. Go to https://app.netlify.com/drop in your browser.
2. Drag the entire `dist` folder onto the page.
3. Within a few seconds you'll get a live URL like
   `https://random-name-12345.netlify.app`. That's your morning report app.
4. (Optional) Click "Claim your site" / sign up for a free Netlify account so
   the URL doesn't expire and so you can rename it to something memorable.

## Step 6 — Create your account in the app

1. Open your new URL.
2. Click "Create one" under the sign-in form, enter your email and a password.
3. You're in. Add a test case to confirm everything's wired up correctly.

**Recommended hardening step:** once you've confirmed your one account works,
go to Supabase → **Authentication** → **Providers** → **Email**, and turn off
public sign-ups so no one else can create an account on your site. (Optional,
but a good idea since hospital data is involved.)

---

## Using it day to day

- **On your phone:** open your URL, sign in, use "+ Add Case" as patients come
  through. Add photos straight from the camera.
- **On the presenting computer (with internet):** open the same URL, sign in
  once, go to "Present" → "Start Presentation" for a fullscreen slideshow with
  an automatic summary slide, or "Export PowerPoint" if you need an actual
  .pptx file for that room's setup.
- Everything is stored in your Supabase database — it'll be there on whichever
  device you sign in from.

## If you ever want to update the app

If you ask me (Claude) to change something later, I'll hand you a new `dist`
folder. Repeat Step 5 (drag it onto Netlify Drop using the same site, or
re-drag onto your existing Netlify site's "Deploys" tab to update it in place)
— `config.js` only needs to be edited again if your Supabase project changes.

## A note on patient data

Hospital numbers are patient identifiers. This setup keeps your data in a
database only you can access (via row-level security), but it's still outside
your hospital's own network. Check your institution's policy on storing
patient identifiers in external tools before using this with real cases — if
needed, substitute your service's internal case number instead of the actual
hospital number.
