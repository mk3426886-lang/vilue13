# Vilue (فيليو)

Digital wallet & social finance web app — Arabic-first (RTL), with English support.
Built with HTML5, CSS3, and vanilla JavaScript on the frontend.

## Status

- ✅ Project structure, design system, logo, i18n (ar/en, RTL/LTR)
- ✅ Welcome, Login, Register, Verify, Home, Wallet, Profile, Settings pages
- ✅ Real backend only — Express + Supabase (Postgres) + JWT sessions.
  **There is no mock/demo mode.** The backend must be running and `.env`
  fully configured for any page beyond the welcome screen to work.
- ✅ Email verification codes sent via your own Gmail account (branded HTML email)
- ✅ **Real wallet**: deposit (Zain Cash / Super Qi, admin-reviewed), withdrawal
  (Zain Cash, held on request + self-cancel within 15 min + admin review),
  Vilue-to-Vilue transfer (instant, atomic). MasterCard is a clearly-labeled
  "coming soon" placeholder — it needs a real payment gateway merchant account.
- ✅ **Real 2FA**: when enabled in Settings, withdrawals and transfers require
  an emailed one-time code before they execute.
- ✅ **Real admin panel** (`/admin/dashboard/`): review pending deposits/
  withdrawals, view and suspend users. See "Creating an admin account" below.
- ✅ Username is English letters + numbers only, checked against a basic
  profanity denylist — enforced server-side, not just in the form.
- ⏳ Marketplace, Friends/Chat — not built yet.
- ⏳ Phone/WhatsApp verification — deferred; `backend/services/whatsapp.service.js`
  exists and is ready to wire in once that stage starts.

## Database setup — run in order

1. `backend/database/schema.sql` — base tables (fresh setup)
2. `backend/database/migration_02_admin_2fa.sql` — adds `is_admin` / `two_fa_enabled`
3. `backend/database/migration_03_remove_username.sql` — removes username, widens the public ID to 12 digits
4. `backend/database/migration_04_settings_owner_badges.sql` — adds owner/badge columns, `platform_settings` (fees/rates), `platform_wallet` (fee collection)
5. `backend/database/wallet_functions.sql` — base atomic deposit/withdraw/transfer functions
6. `backend/database/wallet_functions_v2.sql` — makes those functions fee-aware
7. `backend/database/migration_05_marketplace.sql` — adds `marketplace_products` / `marketplace_orders`, extends transaction types
8. `backend/database/marketplace_functions.sql` — atomic listing/review/purchase functions
9. `backend/database/migration_06_fee_types.sql` — lets every fee be a **%** or a **flat SLON amount**, adds `compute_fee()`
10. `backend/database/wallet_functions_v3.sql` — updates wallet functions to use `compute_fee()`
11. `backend/database/marketplace_functions_v2.sql` — updates `purchase_product()` to use `compute_fee()`
12. `backend/database/migration_07_single_session.sql` — adds single-device session tracking
13. `backend/database/migration_08_friends.sql` — adds `friend_requests` table + friend-request privacy toggle

Paste each into Supabase → SQL Editor → New snippet → Run, in that exact order.

If you're setting this up for the first time (skipping ahead), you can
instead run `backend/database/repair_all_in_one.sql` first (creates
everything up through #4 in one idempotent pass), then continue from #5.

**Storage buckets (both optional — everything works without them, images are just skipped):**
- `receipts` (private) — optional deposit receipt images
- `products` (**public**) — marketplace product photos; must be public since anyone browsing needs to see them

Create both once: Supabase Dashboard → Storage → New bucket.

## Identity model

There is no username. Every account gets a random **12-digit public ID**
at registration (shown on the profile page, used to log in alongside
email, and used as the recipient identifier for transfers). Users can
change their display **name** anytime from the profile page, but never
choose or see a "username."

## Admin hierarchy & verification badges

Three badge levels, shown as a small colored checkmark next to a name:
- 🟡 **Owner** (`verification_badge = 'owner'`) — the platform owner. Only
  set via direct SQL (see migration 04's bootstrap comment). Exactly one
  account should hold this.
- 🟣 **Admin** (`'admin'`) — staff accounts. Only the **owner** can promote
  a user to admin or demote one (`POST /admin/users/:id/promote-admin` /
  `demote-admin`, both `requireOwner`-gated on the backend regardless of
  what the UI shows).
- 🟢 **Verified** (`'verified'`) — a regular user's blue-check, grantable/
  revocable by **any** admin (`PATCH /admin/users/:id/verify`).

Any admin (owner or promoted) can edit platform fees/rates from the
**"الإعدادات والعمولات"** tab in `/admin/dashboard/` — withdrawal/transfer/
deposit fee %, the SLON↔IQD rate, USDT rate, and the marketplace fee
fields (ready for when the marketplace stage is built). Fees are applied
live by the Postgres functions in `wallet_functions_v2.sql`, and collected
fees accumulate in the platform wallet, visible at the top of the admin
dashboard.

## Creating an admin account

1. Register a normal account through the app first
2. In Supabase SQL Editor, run (owner — full hierarchy control):
   ```sql
   update users set is_admin = true, is_owner = true, verification_badge = 'owner'
     where email = 'your.email@example.com';
   ```
   Or, to create a plain admin (no owner powers) instead:
   ```sql
   update users set is_admin = true, verification_badge = 'admin'
     where email = 'staff.email@example.com';
   ```
3. **Log out and log back in** on that account (the admin/owner flags are
   embedded in the JWT at login time, so an existing session won't pick
   them up)
4. Open `/admin/dashboard/index.html` — this is a real, protected panel;
   the backend re-checks `isAdmin`/`isOwner` on every request regardless
   of the UI

## Running it locally

Because `i18n.js` fetches `/locales/*.json` with `fetch()`, opening `index.html`
directly from disk (`file://`) will fail (CORS). Serve the folder instead:

```bash
# from the /vilue folder
npx serve .
# or, with the VS Code "Live Server" extension: right-click index.html → Open with Live Server
```

Then open the printed local URL (e.g. `http://localhost:3000`).

## Structure

```
/vilue
├── index.html          # Welcome/landing screen
├── /css                # main, components, auth, responsive + per-feature stylesheets
├── /js                 # i18n, api (service layer), auth, app bootstrap + per-feature modules
├── /locales             # ar.json (default), en.json
├── /pages              # login, register, verify, home (dashboard placeholder), ...
├── /backend             # server, routes, controllers, services, middleware, database, utils
├── /admin               # admin panel sections
├── .env.example
└── .gitignore
```

## Backend — setup (Supabase + Gmail)

The backend is Node/Express, with Supabase (PostgreSQL) as the database.
Verification codes send through your own Gmail account. Registration is
**email + password only** in this stage — phone/WhatsApp comes later.

```bash
cd backend
npm install
cp ../.env.example ../.env    # then fill in the values below
npm run dev
```

**1) Supabase (database):**
1. Create a free project at supabase.com
2. Project Settings → API → copy the **Project URL** and **service_role key**
   into `.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   (service_role is secret — backend only, never the frontend)
3. Run the three SQL files in order — see "Database setup" above

**2) Gmail (email codes):**
1. Enable 2-Step Verification on the Gmail account you'll send from
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env`

**3) Run the frontend:**
The app requires the backend to be running — there is no mock mode.
With the backend up on port 4000, serve the frontend as described above
(Live Server or `npx serve .`) and the whole flow (register → check your
email for the code → verify → dashboard with your real balance) works
end-to-end.

WhatsApp/phone verification is deferred — `backend/services/whatsapp.service.js`
already exists (official Meta Cloud API, safe for production) and is ready
to wire into the auth flow once that stage starts.



- **No hard-coded UI text.** Every string comes from `/locales/*.json` via
  `data-i18n="path.to.key"` (or `data-i18n-placeholder` for inputs). Add new
  strings to both `ar.json` and `en.json`.
- **All backend calls go through `js/api.js`.** It currently runs in `mock`
  mode (`Vilue_API_CONFIG.MODE = 'mock'`), storing data in `localStorage` so
  the UI is fully testable today. Flip `MODE` to `'live'` once `/backend` is
  deployed — no other file needs to change.
- **Colors, spacing, radius, shadows** are all CSS variables in
  `css/main.css` — never hard-code a hex value in a component file.

## Turning this into an Android APK

Once the web app is further along, the standard path (no native rewrite) is:

1. `npm install -g @capacitor/cli @capacitor/core @capacitor/android`
2. `npx cap init Vilue com.vilue.app`
3. Point Capacitor's `webDir` at this project (or its built output)
4. `npx cap add android`
5. `npx cap open android` → build the signed `.apk` / `.aab` from Android Studio

This wraps the exact same web code — nothing gets rewritten for mobile.

## Currency

Internal currency is **SLON**. Display conversion: **5 SLON = 1 IQD**
(admin-editable — see "الإعدادات والعمولات" below).
USDT convert rate is also admin-editable from the same panel.

## Fees: percent or fixed SLON

Every fee (withdrawal, transfer, deposit, gift commission, marketplace
commission) can be set as either a **percentage** of the amount or a
**flat SLON amount** — pick the type per fee from the dropdown next to
each field in the admin dashboard's settings tab. The marketplace
listing fee is always a flat SLON amount (that's what the spec calls for).

## Single-device login

Each account can be logged in from **one device at a time** — whether
that's the website or (once built) the mobile app. The frontend
generates a random device ID once and stores it in `localStorage`
(`vilue_device_id`). Logging in again from the *same* device just
refreshes the session. Logging in from a *different* device immediately
ends the previous device's session — but that switch is only allowed
**once every 48 hours**; attempting a second switch inside that window
is blocked with a clear message showing when it's allowed again.

## Terms & Privacy

`pages/terms.html` and `pages/privacy.html` are real, written content
(not placeholders) covering the SLON currency, deposits/withdrawals,
marketplace, prohibited conduct, single-device login, and data handling.
Linked from the registration page's checkbox.

## Friends

`pages/friends.html` — add a friend by their 12-digit ID, accept/reject
incoming requests, see sent requests, and view/remove friends. A user
can turn off incoming friend requests entirely from Settings.

**Not included:** live chat/messaging between friends. The original
spec bundled "Messages" under Friends, but real-time chat needs its own
infrastructure (WebSockets, message storage, delivery state) — it's a
separate, larger feature and isn't part of this delivery.

- **Browsing** (`pages/marketplace.html`) is public — approved products
  show with no login required.
- **Selling** (`pages/sell.html`): a regular user pays the current listing
  fee (`platform_settings.marketplace_listing_fee_slon`, admin-editable)
  up front, and the listing sits as `pending_review` until an admin
  approves or rejects it. Rejecting **refunds the fee automatically**.
- **Admin listings**: from the admin dashboard's "المتجر" tab, an admin
  can publish a product directly — no fee, no review, published instantly
  (`seller_id` is null — it's a platform listing).
- **Buying** (`pages/product.html`) is instant and atomic: the buyer's
  balance is checked and deducted, the marketplace commission
  (`platform_settings.marketplace_commission_percent`) is skimmed to the
  platform wallet, and the rest credits the seller — all in one Postgres
  transaction via `purchase_product()`.
- Every fee/rate above is live-editable from **الإعدادات والعمولات** in
  the admin dashboard — no code changes needed to adjust pricing.

## Status — what's still not built


Friends/Chat and native gifting are not part of this delivery. Everything
else from the original spec (auth, wallet with real deposit/withdraw/
transfer, admin panel with fee control and verification hierarchy, and
the marketplace) is real and wired end-to-end.

## What's new in this update

- **Copy-ID button** on the profile page
- **Mandatory referral system**: every new registration must enter an
  existing user's 12-digit ID as a referral code (the very first account
  ever created is exempt — nobody exists yet to refer them). No rewards
  yet — just tracking. Your profile shows how many people used your ID.
- **Admin**: ban (with reason + optional duration, auto-lifts when it
  expires), permanent delete (frees the email for re-registration),
  edit any user's ID (including their own — old IDs aren't reserved),
  a full account-details view (balance, recent transactions, listings,
  friend count), a "رجوع للتطبيق" back button next to logout
- **Brute-force lockout**: 5 failed logins locks the account for 15 minutes
- **Forgot password**: real email-based reset flow
  (`pages/forgot-password.html` → `pages/reset-password.html`)
- **Real notifications**: auto-sent on deposit/withdrawal approval or
  rejection, transfers received, marketplace sales, and gifts — plus
  admins can broadcast to everyone or message one user from the "الإشعارات" tab
- **Admin-editable news ticker & promo banner** (text + uploaded image),
  shown live on the home screen
- **Support messages**: users send a message from Settings → "الدعم";
  admins view and reply from the admin dashboard's "الدعم" tab (their
  reply arrives as a notification). This is a message system, not a
  live chat — no real-time infrastructure is included.
- **Friend chat + gifts**: `pages/chat.html` — polling-based (refreshes
  every few seconds, not instant push) messaging between accepted
  friends, with the spec's default gift catalog (rose/roses/balloon/
  heart/airplane/world cup). Gift value splits via the configurable
  gift commission.
- **Marketplace auto-delivery**: a listing can be marked "digital" with
  delivery content (a code, link, etc.) that's revealed to the buyer
  immediately after purchase — no manual fulfillment needed.
- Email OTP messages now note to check the spam folder.

## Database setup (updated)

Everything above requires new tables/columns/functions. **Just re-run
`backend/database/COMPLETE_SETUP.sql` in full** — it's idempotent, so
running it again after this update brings any existing database up to
date without duplicating anything.

## What's new — tasks, avatar upload, transaction details

- **Profile picture**: tap your avatar on the profile page to upload a
  new photo (needs a public `avatars` Storage bucket — same setup as
  the `products` bucket)
- **Transaction details**: tap any row in the wallet page to see full
  details (method, phone/sender name, admin notes, cancel deadline, etc.)
- **"المهام" (Tasks)** — Telegram channel-join campaigns:
  - Any user can publish a task: pay a reward (≥40 SLON) per member who
    joins their Telegram channel and stays, for a target of 1,000–100,000
    joins. The full budget (reward × target) is reserved from their
    wallet immediately; admin approval is required before it goes live.
  - Cancel anytime — refunds whatever's left unused.
  - A member who leaves the channel after being rewarded loses that
    reward back out of their wallet (never refunded to the task creator).
  - Commission is admin-configurable (% or flat SLON) from
    "الإعدادات والعمولات" → "عمولة مهام تليكرام".

### Telegram bot setup (required for tasks to actually work)

This can't be done from inside the app — it's on Telegram's side:

1. Message **@BotFather** on Telegram → `/newbot` → follow the prompts
   → copy the token it gives you into `.env` as `TELEGRAM_BOT_TOKEN`
2. Set `TELEGRAM_BOT_USERNAME` in `.env` to the bot's `@username`
3. Set `TELEGRAM_WEBHOOK_SECRET` in `.env` to any random string you make up
4. **Deploy the backend first** (Telegram needs a real public HTTPS URL —
   `localhost` will not work)
5. Register the webhook by visiting this URL once in your browser
   (replace both placeholders):
   ```
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-backend.com/api/v1/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>
   ```
6. For **every channel** that will host a task, add the bot as an
   **admin** of that channel (Telegram only sends join/leave events for
   chats the bot administers)

Users link their own Telegram account from `pages/tasks.html` — it
generates a 6-digit code and asks them to send `/start <code>` to the
bot; the bot confirms the link automatically.

## Database setup (updated again)

Re-run `backend/database/COMPLETE_SETUP.sql` in full — it now includes
the tasks tables/functions, avatar/Telegram columns, and is still fully
idempotent.
