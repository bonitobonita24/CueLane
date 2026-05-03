# CueLane

## App Identity
Name:           CueLane
Tagline:        Smart Queue Management — organize, serve, and track every customer interaction.
Industry:       SaaS / Business Operations / Service Management
Primary users:  Business owners and branch managers (tenant admins), front-line employees (tellers/clerks), walk-in customers, and CueLane platform super-admins (Powerbyte IT Solutions staff).

## Problem Statement
Walk-in service centers — banks, government offices, clinics, telcos — suffer from disorganized queues, long wait times, and zero visibility into employee performance or service bottlenecks. Existing queue systems are either expensive SaaS with per-user fees, overly basic ticket dispensers with no analytics, or enterprise solutions requiring dedicated hardware and complex setup. CueLane is a multi-tenant SaaS queue management platform where any company can sign up, configure their branch, and start managing queues in minutes — running on any screen from a tablet to a wall-mounted TV — with a generous free tier and a premium tier for full white-label customization.

## Core User Flows

1. **Company signs up (Platform):** Business owner visits cuelane.powerbyte.app → lands on marketing landing page → clicks "Get Started Free" → creates account (email + password via Auth.js v5) → Cloudflare Turnstile widget verifies human (Managed mode) → enters company name, tagline, branch name → tenant workspace created with Free tier defaults → admin is redirected to their tenant admin panel. Error: duplicate email shows "Account already exists." Invalid company name (empty/too short) is rejected with inline validation. Turnstile failure shows "Verification failed. Please try again."

2. **Tenant admin resets password:** Admin clicks "Forgot Password" on login page → enters registered email → system sends password reset link via Resend → admin clicks link in email → enters new password → redirected to login. Error: unrecognized email shows generic "If this email exists, a reset link has been sent" (anti-enumeration). Expired or already-used reset link shows "This link has expired. Please request a new one."

3. **Tenant admin upgrades to Premium:** Admin logs in → Admin Panel → Tenant tab → clicks "Upgrade to Premium" → pricing modal shows Premium features + monthly price → clicks "Continue to Payment" → redirected to Xendit-hosted payment method linking page → completes payment setup (card, GCash, Maya, or other supported Philippine channels) → Xendit sends `recurring.plan.activated` webhook → CueLane flips tenant.tier to premium → all Premium features unlock immediately → admin sees confirmation banner "Your plan has been upgraded to Premium." Error: payment failure shows "Payment could not be processed. Please try a different method." Webhook failure retried via BullMQ exponential backoff (3 retries). If all retries fail → DLQ → admin notified via email to contact support.

4. **Tenant admin cancels Premium / plan lapses:** Admin → Tenant tab → clicks "Cancel Plan" → confirmation modal warns "You will keep Premium until [end of billing period], then revert to Free." → admin confirms → Xendit `recurring.plan.inactivated` webhook received → tenant flagged for downgrade at period end (downgradeAt timestamp set) → on period end: tier reverts to Free, Premium-only features hidden, usage limits enforced (windows/transactions/employees capped). Payment failure path: `recurring.cycle.failed` webhook received → grace period warning email sent → Xendit retries per its retry schedule → if all retries fail: `recurring.cycle.failed` final → tier reverts to Free → admin notified via email. Error: cancellation request failure shows "Could not cancel at this time. Please contact support."

5. **Customer takes a regular ticket (Kiosk):** Customer approaches kiosk screen → sees transaction grid immediately (no lane selection needed) → selects transaction type (e.g. Cash Deposit) → presses "Get Queue Number" → system issues ticket (e.g. 1-003) → thermal receipt prints automatically → screen shows ticket number + estimated wait + position → auto-resets to transaction grid after 5 seconds. Error: if no employees are logged in for that transaction, kiosk still issues ticket but estimated wait shows "Longer than usual."

6. **Customer takes a priority ticket (Kiosk):** Staff member assisting a PWD/senior/pregnant customer taps the small "⭐ Priority Lane" button in the bottom-right corner of the kiosk → screen shifts to priority mode (amber background, Priority Lane badge visible) → customer selects transaction → system issues priority ticket (P-001) → priority tickets are always called before regular tickets regardless of queue position → kiosk auto-resets to regular mode after issuance. Error: priority mode cannot be accidentally activated — button is intentionally small (10px font, 70% opacity, bottom-right corner).

7. **Employee serves a customer (Employee Station — desktop):** Employee logs in with PIN → Cloudflare Turnstile verifies human (Managed mode) → selects an available window (occupied windows show lock icon + occupant name) → sees Now Serving card + Up Next list (sorted: priority first, then FIFO) → presses "Call Next" → system picks the highest-priority waiting ticket matching employee's assigned transactions → notification bell chime (Web Audio API, 3-tone) + male voice announcement (SpeechSynthesis, rate 0.78, pitch 0.85) reads "Calling next. Ticket number one, zero zero three. Please proceed to Window 2." → employee serves customer → presses Complete → modal shows three options: ✅ Yes Complete (green), 🚫 No Show (red), Cancel. Error: if employee has no transactions assigned, login is blocked with "No transactions assigned. Contact admin." If no tickets waiting, Call Next is disabled. Turnstile failure blocks login with "Verification failed."

8. **Employee serves via mobile phone (Premium only):** Employee opens CueLane on phone browser (same domain) → logs in via touch-friendly number pad → Cloudflare Turnstile verifies human (Managed mode) → selects window → fixed bottom action bar shows Call Next / Done / Skip / Recall / Transfer → all actions trigger same bell + voice as desktop. Error: mobile module tab hidden entirely on Free tier. Turnstile failure blocks login.

9. **Employee skips and recalls a ticket:** Employee presses Skip → ticket moves to "skipped" status → Skipped Tickets panel appears showing all skipped tickets matching the employee's assigned transactions from any window → if employee is free: taps "📢 Recall" → ticket returns to serving + bell + voice fires → if employee is busy: taps "⚡ Priority Recall" → current ticket is auto-skipped, recalled ticket takes its place + bell + voice fires. Sound fires FIRST in click handler to maintain browser user-gesture chain for AudioContext/SpeechSynthesis.

10. **Employee transfers a ticket:** Employee presses Transfer → modal shows all other windows with: employee name, their assigned transactions (matching ones highlighted with color + "✓ Can handle this" badge), busy/available status → optional "↩ Return after done" toggle (Premium only) → employee picks destination → ticket immediately set to serving at target window. If Return After Done enabled: when destination window completes the ticket, it auto-returns to the origin window as serving (not completed) with bell + voice. No Show at destination clears the returnTo flag — no auto-return for abandoned tickets.

11. **Admin manages system:** Admin logs in with PIN (default: 0000) → Cloudflare Turnstile verifies human (Managed mode) → lands on Dashboard tab → 8 sub-tabs available: 📊 Dashboard (daily/monthly/yearly toggle, 8 KPI cards, completion/no-show rate bars, hourly traffic bar chart, per-transaction breakdown with progress bars, per-window cards, employee performance with 4 timing metrics + per-transaction breakdown, searchable ticket log with 🔍 filter), 👤 Users (add/remove with PIN + role + transaction assignment toggles, "Edit Transactions" per user), 🧾 Transactions (add with icon picker 16 options + color picker 12 options + name + avg time), 🪟 Windows (add/remove name-only locations), 📺 Media (two video modes + ad system), 🖨 Printer (receipt template editor with 10 variables + 6 formatting tags, live preview, margin/paper/auto-cut controls, test print), 🎨 Theme (Premium: 8 presets + custom color pickers with live preview), 🏢 Tenant (tier toggle, company profile, feature matrix, usage meters, upgrade/cancel plan). Error: invalid admin PIN rejected. Free tier: Media/Theme tabs hidden, limits enforced (4 windows, 6 transactions, 10 employees).

12. **Big Display shows queue status (TV/Monitor):** 16:9 aspect-ratio-locked display with black letterboxing → dark themed with fluid viewport-relative sizing (clamp/vmin/vw) → header shows company name (Premium) or "CueLane — Powered by Powerbyte IT Solutions" (Free) + live clock → video panel operates in one of two modes: **Playlist mode** (YouTube links + uploaded media auto-looping) or **YouTube LIVE mode** (single live stream). **Free tier: every 5 minutes, the video panel interrupts to play a system advertisement from CueLane/Powerbyte (managed by Super Admin). Ads play in chronological order, then resume the tenant's content. Non-negotiable.** Premium Playlist mode: no ad interruptions. Premium LIVE mode: tenant's own custom ads play every 5 minutes instead of system ads. → 2×2 Now Serving grid with gold (#FCD34D) window names, large white ticket numbers with pulse-glow animation on new calls, transaction type underneath → full-width Up Next panel grouped by transaction (priority tickets shown with ⭐ badge + amber tint, sorted first), 5 visible + overflow → Total Waiting bar (color-coded green/amber/red) → scrolling ticker (Free: includes "Powered by Powerbyte IT Solutions"). Error: if no videos in playlist, shows "No video playing" placeholder. If system ad fails to load, skip to next ad in rotation.

13. **Super Admin manages platform (CueLane internal):** Powerbyte staff logs in at /superadmin (email/password via Auth.js v5) → Cloudflare Turnstile verifies human → tenant directory with all registered companies → toggle Free/Premium per tenant (manual override) → suspend/reactivate accounts → manage system ads (upload/reorder/enable/disable) → view platform-wide analytics (total tickets processed, active tenants, usage per tier).

## Modules + Features

### Big Display Screen (🖥)
- **Video source mode selector** (Admin → Media): tenant chooses one of two modes for the video panel:
  - **Mode A — Playlist:** Videos loop in playlist order. Mix of YouTube embeds and locally uploaded MP4/AVI/MKV/WebM/MOV files. Auto-advances on video end, loops back to first after last.
  - **Mode B — YouTube LIVE:** A single YouTube live stream URL plays continuously (e.g. news channel, ambient stream, company live feed).
- **System Ads (Free tier — non-negotiable):** Every 5 minutes, regardless of what is currently playing (playlist or LIVE), the video panel interrupts and plays a system advertisement. System ads are uploaded and managed by CueLane Super Admin (Powerbyte staff) via /superadmin. Ads play in chronological sortOrder (oldest first, then loop). After the ad finishes, the previous video/stream resumes. Free tier tenants cannot skip, disable, or hide system ads.
- **Custom Tenant Ads (Premium — LIVE mode only):** Premium tenants using YouTube LIVE mode can upload their own ad media files or YouTube links. These tenant-owned ads interrupt the live stream every 5 minutes. In Playlist mode, premium tenants have no ad interruptions at all.
- **Media limits by tier:**
  - Max video file upload size: Free = 300MB per file. Premium = 800MB per file.
  - Max saved video files (uploaded to storage): Free = 1 file. Premium = 5 files.
  - Max playlist items (uploaded files + YouTube links combined): Free = 3 items. Premium = 10 items.
- Now Serving grid: 2×2 for 4 windows, gold (#FCD34D) window names, white ticket numbers with fluid clamp sizing (24px–64px), pulse-glow animation on new calls, transaction type label underneath
- Up Next panel: Full-width by transaction type, priority tickets with ⭐ badge + amber tint sorted first, 5 visible + overflow count
- Total Waiting bar: Color-coded (green ≤5, amber 6-10, red 11+), served-today counter
- Scrolling ticker: Custom text from Admin, infinite loop. Free tier appends "Powered by Powerbyte IT Solutions"
- 16:9 aspect ratio lock: `aspect-ratio: 16/9` with `max-height: 100vh; max-width: 100vw`, black letterbox centering
- Fluid sizing: all text uses clamp(), spacing uses vmin/vw/%, readable from 3+ meters
- Real-time sync: WebSocket connection per tenant via Valkey pub/sub — display updates immediately on ticket call, complete, skip, transfer
- Branding: Free = "CueLane — Powered by Powerbyte IT Solutions"; Premium = company name + custom tagline

### Customer Kiosk (🎫)
- Default view: Transaction selection grid shown immediately (no lane selection step)
- Transaction cards: 2-column grid with emoji icon, name, color, avg wait time, waiting count, color-coded count badges
- Priority Lane: Small subtle button (10px, 70% opacity) fixed bottom-right — taps to activate priority mode (amber background, ⭐ badge, "PWD • Senior Citizen • Pregnant • Special Needs" subtitle)
- Ticket issuance: Regular tickets: {serviceNumber}-{3digitSeq} (e.g. 1-003). Priority: P-{3digitSeq} (e.g. P-001). Separate numbering sequences.
- Auto-print: Thermal receipt prints on confirmation via hidden iframe with @page sizing
- Auto-reset: Returns to regular transaction grid after 5 seconds
- Real-time sync: WebSocket connection per tenant — waiting counts and avg wait times update live
- Branding: Free shows CueLane + Powerbyte subtitle; Premium shows company name

### Employee Station (👤 — Desktop)
- Two-step login: PIN entry → Cloudflare Turnstile → window selection (occupied windows locked with 🔒 + occupant name)
- Now Serving card: Large ticket number (56px), transaction type + icon/color, time-since-called, transfer/return badges
- Action buttons: Call Next (priority-first routing + bell + voice), Complete (3-option modal: ✅ Done / 🚫 No Show / Cancel), Skip, Recall (re-announces current), Transfer (modal with transaction matching + Return After Done toggle)
- Skipped Tickets panel: All skipped tickets matching employee's transactions from any window, 📢 Recall (when free) or ⚡ Priority Recall (when busy, auto-skips current)
- Up Next queue: Sorted priority-first then FIFO, ticket number + transaction + time waiting
- Stats sidebar: Done / Skip / No Show / Transfer counters
- Recent Activity log: Timestamped entries with status icons
- Voice: Web Audio API 3-tone chime + SpeechSynthesis male voice (rate 0.78, pitch 0.85), reads ticket number as words
- Real-time sync: WebSocket connection per tenant — queue state reflects all employee actions instantly across all devices

### Mobile Employee (📱 — Premium only)
- Number pad PIN login: 3×4 grid with large tap targets, bullet-dot masking, backspace key
- Cloudflare Turnstile on login
- Window selection: Full-width stacked cards with occupancy status
- Now Serving card: 56px ticket number, transfer/return badges
- Fixed bottom action bar: Call Next / ✅ Done / ⏭ Skip / 🔁 Recall / ↗ Transfer
- Full-screen views: Complete (3-button stack), Transfer (with Return After Done toggle + transaction matching), Skipped Tickets (tap to recall)
- Mobile optimizations: WebkitTapHighlightColor transparent, 48px+ touch targets, backdrop-blur bottom bar, 100px bottom padding
- Real-time sync: WebSocket connection — same state as desktop Employee Station

### Admin Panel (⚙️)
- PIN-protected access (default: 0000) + Cloudflare Turnstile
- 📊 Dashboard: Daily/Monthly/Yearly toggle, 8 KPI cards (Issued, Completed, Waiting, Serving, No Shows, Skipped, Transferred, Avg Wait), completion + no-show rate bars, hourly traffic chart, per-transaction breakdown, per-window cards, employee performance (4 timing metrics: avg service time, fastest, slowest, avg idle between calls + per-transaction breakdown), searchable ticket log with 🔍 filter
- 👤 Users: CRUD with name/PIN/role/transaction assignment. Edit Transactions button per user with checkbox toggles. Free tier: max 10 employees (warning + disabled button at limit)
- 🧾 Transactions: Icon picker (16), color picker (12), name, avg time, assigned employee count. Free tier: max 6 (warning at limit)
- 🪟 Windows: Name-only locations, description explains login-time selection. Free tier: max 4 (warning at limit)
- 📺 Media: Two video source modes selectable:
  - **Mode A — Playlist:** Ticker text editor. YouTube URL input (title + live toggle). Local video upload (MP4/AVI/MKV/WebM/MOV, blob URLs). Unified playlist with YOUTUBE/LOCAL source badges, #position numbers, ↑↓ reorder, Play/Remove. Blob URLs revoked on removal. Free: max 3 playlist items, max 1 uploaded file (300MB). Premium: max 10 playlist items, max 5 uploaded files (800MB).
  - **Mode B — YouTube LIVE:** Single YouTube live stream URL input. Premium tenants can also add custom tenant ads (uploaded files or YouTube links) that interrupt the live stream every 5 minutes as branded commercial breaks.
  - **System Ads (Free tier):** Cannot be disabled. Tenant admin sees notice: "System ads are active on Free tier. Upgrade to Premium to remove."
  - **Custom Tenant Ads (Premium — LIVE mode only):** Upload media or add YouTube links as tenant-owned ads. These replace system ads every 5 minutes during LIVE streams.
- 🖨 Printer: Printing ON/OFF toggle, business name + tagline fields, paper width (58mm/80mm), margins (top/bottom/left/right mm), auto-cut toggle, receipt template editor (10 variables: ticket_number, transaction_name, transaction_icon, business_name, tagline, date, time, waiting_count, est_wait, queue_position; 6 formatting tags: center, right, bold, large, small, line), live preview, 🖨 Test Print button, click-to-copy variable cards, reset to default. Free tier: default template enforced, Powerbyte footer appended.
- 🎨 Theme (Premium only): 8 presets (Indigo, Ocean Blue, Emerald Green, Rose Red, Amber Gold, Deep Violet, Teal, Corporate Slate) + Custom mode. 9 color pickers (primary, primaryDark, primaryLight, primaryBorder, primaryGlow, gold, displayBg1/2/3). Live preview (light UI + dark display side-by-side). Reset to default.
- 🏢 Tenant: Tier toggle shown as current plan card (Free/Premium). Upgrade to Premium button (Free) → triggers Xendit payment flow. Cancel Plan button (Premium) → confirmation modal → Xendit cancellation. Company name + tagline editor (locked on Free). Non-negotiable branding notice for Free. Feature availability matrix (15 features). Current usage meters with progress bars (employees/transactions/windows vs. limits).

### Platform Super Admin (CueLane internal — /superadmin)
- Auth.js v5 email/password login + Cloudflare Turnstile
- Tenant directory: all registered companies with tier, status, creation date
- Tier management: toggle Free/Premium per tenant (manual override of Xendit state)
- Account suspension/reactivation
- Platform-wide analytics: total tickets processed, active tenants, usage per tier
- **System Ads Manager:** Upload and manage advertisement media files (video MP4/WebM, image PNG/JPG) that automatically play on ALL Free tier tenant Big Displays every 5 minutes. Ads play in chronological sortOrder. Super Admin can: add new ads (upload file or YouTube link + title + duration), reorder ads, enable/disable individual ads, remove ads, preview ad rotation. Ads stored globally in MinIO/S3 under `system-ads/` prefix.

### Platform Landing Page (/)
- Public marketing page: hero section with product tagline + sign-up CTA, feature highlights for each module, Free vs Premium pricing table (feature comparison matrix + monthly price), testimonials placeholder, footer with links
- Sign-up form: company name, email, password, Cloudflare Turnstile → creates tenant + redirects to admin panel
- Login link for existing tenant admins

## Subscription Tiers

### Free Tier
- Big Display (standard theme, CueLane branding enforced)
- Big Display video: Playlist mode (max 3 items, max 1 uploaded file at 300MB) or YouTube LIVE mode
- **System ads: mandatory — every 5 minutes, CueLane/Powerbyte system ads interrupt the video panel. Cannot be disabled, skipped, or hidden.**
- Customer Kiosk (regular + priority lane)
- Employee Station (desktop only)
- Admin: Dashboard (basic KPIs), Users (max 10), Transactions (max 6), Windows (max 4), Media (with limits), Printer (default template, Powerbyte footer enforced)
- **Non-negotiable branding:** "CueLane — Powered by Powerbyte IT Solutions" on Display header, ticker, Kiosk header, receipt footer, Employee Station
- No mobile employee calling
- No custom theme
- No receipt template customization
- No Transfer Return After Done
- No advanced reports (employee timing metrics)
- No custom tenant ads

### Premium Tier
- Everything in Free, plus:
- Full white-label: all CueLane branding replaced with company name + tagline
- "Powered by Powerbyte IT Solutions" removed from all surfaces
- **System ads removed — no Powerbyte ads on Premium tier displays**
- Big Display video: Playlist mode (max 10 items, max 5 uploaded files at 800MB) or YouTube LIVE mode
- **Custom tenant ads (LIVE mode only):** tenant can upload their own ad media or YouTube links that play every 5 minutes during live streams
- Custom theme colors (8 presets + full custom)
- Mobile Employee module
- Advanced Dashboard (employee performance timing, per-transaction breakdown, hourly chart)
- Full receipt template customization
- Transfer with Return After Done
- Unlimited windows, transactions, employees

## Roles + Permissions

| Role | Scope | Can do | Cannot do |
|------|-------|--------|-----------|
| **Customer** | Public | Select transaction at kiosk, receive ticket, view Big Display | Cannot access Employee Station, Admin, Mobile, or any backend function. Cannot cancel ticket. Cannot activate priority mode (staff-assisted only). |
| **Employee** | Tenant | Log in with PIN, select window, call/complete/skip/noshow/recall/transfer tickets, view own stats and queue, use mobile calling (Premium) | Cannot access Admin Panel. Cannot manage users/transactions/windows. Cannot view other employees' performance. Cannot assign transactions to themselves. Cannot change tier or branding. |
| **Tenant Admin** | Tenant | Full Admin Panel: manage users + transactions + windows + media + printer + theme + tenant settings, view all reports and employee performance, upgrade/cancel subscription via Xendit | Cannot serve customers from Admin (must use Employee Station). Cannot access other tenants' data. Cannot manually override their own tier (must use payment flow or contact support). |
| **Super Admin** | Global | View all tenants, toggle tiers (manual override), suspend/reactivate accounts, view platform analytics, manage system ads | Does not access individual tenant queue operations. Cannot see employee PINs. Cannot modify tenant queue data. |

## Data Entities

**Tenant:** id, companyName, tagline, logoUrl (nullable), tier (free | premium), createdAt, status (active | suspended), settings (JSON: theme, printerConfig, tickerText, businessName, videoMode — "playlist" | "live", liveStreamUrl — YouTube live URL for LIVE mode)

**Service (Transaction Type):** id, tenantId, name, icon (emoji from 16 options), color (hex from 12 options), avgTime (minutes)

**Window:** id, tenantId, name

**User:** id, tenantId, name, role (employee | admin), pin (string, 4-6 digits), services (array of serviceIds the employee can handle)

**Ticket:** id (format: P-NNN for priority, {serviceNumber}-NNN for regular), tenantId, serviceId, status (waiting | serving | completed | skipped | noshow), windowId (nullable), createdAt (timestamp), calledAt (timestamp, nullable), completedAt (timestamp, nullable), servedBy (userId, nullable), priority (boolean), transferred (boolean), transferredFrom (windowId, nullable), returnTo (windowId, nullable — set during transfer with Return After Done), returnedFromTransfer (boolean)

**SessionMap:** tenantId + userId → windowId (tracks which employee is at which window, in-memory via Valkey)

**Playlist Entry:** id, tenantId, type (youtube | local), title, videoId (YouTube), storageKey (local), fileName, fileSize, fileExt, isLive (YouTube), sortOrder

**System Ad (global — managed by Super Admin):** id, type (youtube | uploaded), title, videoId (YouTube, nullable), storageKey (uploaded, nullable), fileName, fileSize, duration (seconds — admin-entered estimate; YouTube ad duration determined on playback via iframe API `onStateChange` event), enabled (boolean), sortOrder (integer), createdAt. Stored under global `system-ads/` prefix. Plays on ALL Free tier Big Displays every 5 minutes in chronological sortOrder.

**Tenant Ad (per-tenant — Premium only, LIVE mode only):** id, tenantId, type (youtube | uploaded), title, videoId (YouTube, nullable), storageKey (uploaded, nullable), fileName, fileSize, duration (seconds — admin-entered estimate; YouTube ad duration determined on playback via iframe API `onStateChange` event), sortOrder (integer), createdAt. Plays every 5 minutes during YouTube LIVE mode on Premium tenant Big Displays.

**Subscription:** id, tenantId, tier (free | premium), startDate, endDate (nullable for free), downgradeAt (timestamp, nullable — set when cancellation confirmed; system reverts tier to free on this date), paymentStatus (active | past_due | cancelled | free), xenditPlanId (nullable — Xendit recurring plan ID for Premium tenants), xenditCustomerId (nullable — Xendit customer ID linked to payment method)

**PasswordResetToken:** id, userId, token (hashed), expiresAt, usedAt (nullable)

## Integrations
- **Web Audio API**: Browser-native — generates notification bell chimes (3-tone sine wave, no external files)
- **SpeechSynthesis API**: Browser-native — male English voice announcements at rate 0.78, pitch 0.85
- **YouTube Embed API**: iframe embed for Big Display entertainment (no API key required)
- **Valkey pub/sub**: Real-time WebSocket state sync across all connected devices per tenant (Big Display, Kiosk, Employee Stations, Mobile). All ticket state changes propagate instantly via tenant-scoped channels.
- **Xendit** (production): Payment gateway for Premium tier subscription billing. BSP-regulated, Philippines-first. Supports cards (Visa/Mastercard/JCB), e-wallets (GCash, Maya, GrabPay), online banking (BDO, BPI, Metrobank, UnionBank), over-the-counter (7-Eleven, Cebuana), QR Ph. Subscription billing uses Xendit Subscriptions API: create recurring plan → redirect customer to Xendit-hosted payment method linking page → receive `recurring.plan.activated` webhook → Xendit auto-deducts monthly → receive `recurring.cycle.succeeded` / `recurring.cycle.failed` / `recurring.plan.inactivated` webhooks. No card data stored in CueLane — PCI compliance handled entirely by Xendit. Auth: Basic Auth with secret API key. Node.js SDK: `xendit-node`. Docs: https://docs.xendit.co/apidocs
- **Resend / SMTP** (production): transactional emails — welcome, tier change confirmation, payment failure warning, password reset link, DLQ failure alert
- **Cloudflare Turnstile**: Human verification on all authentication forms. Free tier from Cloudflare. Widget type: Managed. Applied to: tenant signup, tenant admin login, employee PIN login (desktop + mobile), admin PIN login, super-admin login. NOT applied to: Customer Kiosk (shared touchscreen), Big Display (view-only). Docs: https://developers.cloudflare.com/turnstile/

## File Uploads
File types:           Video (MP4, AVI, MKV, WebM, MOV) for Big Display media and tenant/system ads. Images (PNG, JPG, SVG) for tenant logos.
Max video size:       Free tier: 300MB per file. Premium tier: 800MB per file.
Max image size:       5MB per file (logos).
Max saved video files: Free tier: 1 file. Premium tier: 5 files.
Max playlist items:   Free tier: 3 items (uploaded + YouTube links combined). Premium tier: 10 items.
Store originals:      Yes — original files stored in MinIO (dev) / S3 (prod), keyed by tenantId/filename.
Image variants:       Logo: generate 64px, 128px, 256px thumbnails on upload for Display/Kiosk/receipt use.
Video processing:     No server-side transcoding — browser plays original via HTML5 `<video>`. Accept only web-compatible formats.
System ads storage:   Global `system-ads/` prefix in MinIO/S3 — not per-tenant. Managed by Super Admin only.

## Background Jobs
Queue: `email`       — trigger: tenant signup, tier change, payment failure, password reset → sends transactional email via Resend/SMTP
Queue: `reports`     — trigger: admin requests report export (future) or scheduled daily summary → generates report data
Queue: `webhooks`    — trigger: Xendit webhook received → processes subscription lifecycle events (recurring.plan.activated, recurring.plan.inactivated, recurring.cycle.succeeded, recurring.cycle.failed, recurring.cycle.retrying)
Retry strategy:      Exponential backoff, 3 retries max
DLQ:                 After 3 failures, move to dead-letter queue. Log-only — no auto-retry from DLQ. Admin notified via email.

## Realtime Features
Protocol:            WebSocket via Valkey pub/sub (BullMQ not used for real-time — Valkey pub/sub handles it directly)
Channel scope:       Per-tenant channels — tenant:{tenantId}:queue. No cross-tenant data on any channel.
Subscribers:         Big Display, Customer Kiosk, Employee Station (desktop), Mobile Employee — all subscribe on connect
Publishers:          Employee Station and Mobile Employee publish on: Call Next, Complete, Skip, Recall, Transfer, No Show
Events propagated:   ticket.called, ticket.completed, ticket.skipped, ticket.noshow, ticket.transferred, ticket.recalled
Fallback:            No polling fallback — WebSocket required. If connection drops, client reconnects automatically with exponential backoff.

## Reporting & Dashboards
KPIs:             Tickets Issued, Completed, Waiting Now, Serving Now, No Shows, Skipped, Transferred, Avg Wait Time
Chart types:      Hourly traffic bar chart (Premium), completion/no-show rate progress bars, per-transaction breakdown progress bars
Employee metrics: Avg Service Time, Fastest, Slowest, Avg Idle Time between calls, per-transaction count × avg time (Premium only)
Grouping:         Per-window cards, per-transaction cards, per-employee cards
Time filters:     Daily (today), Monthly (current month), Yearly (current year)
Ticket log:       Searchable by ticket number, sortable by date, 50 records per page
Export formats:   None in v1 (view-only dashboard). PDF/CSV export planned for v2.

## Deployment Config
Environments: dev / staging / prod
Hosting:      VPS Cloud Server (Docker Compose mono-server for all environments)
Dev mode:     MODE A — WSL2 native (only supported mode — pre-locked)
Docker Hub:   enabled — hub_repo: bonitobonita24/cuelane
Docker tags:  GitHub Actions pushes :latest, :staging-latest, and :sha-{hash} on every push to main.

## Mobile Needs

**Native mobile app:** None — web only. Mobile Employee module is a responsive web app accessed via phone browser on same domain.
Platform:           Web (responsive) — no native iOS/Android app. No app store distribution.
Offline-first:      No (requires real-time WebSocket connection to server for queue state sync)
Push notifications: No (not in v1)
Native features:    None — no camera, GPS, biometrics, or device APIs used. Pure browser-based.
Deep linking:       No — accessed via standard URL (/{tenant}/mobile). No custom URL schemes or universal links.
**Auth mode (web mobile — Mobile Employee module):** session — employee re-enters PIN on every page open. No persistent cookie, no "remember me" option. Matches desktop Employee Station behavior. Rationale: (1) PIN auth is per-request (no session cookie at all — see Security Requirements CSRF section), (2) keeps desktop and mobile consistent so employees don't need to learn two login patterns, (3) shared/lost phones are a concrete risk in walk-in branch environments — a persistent cookie would let anyone with the unlocked phone clock actions against the employee's account. Turnstile fires on every login. No idle-timeout logic needed — the absence of a persistent session is the timeout.

**Per-page mobile strategy (auto-classified in Step 8b, reviewed by user):**

| # | Page | Strategy | Notes |
|---|------|----------|-------|
| 1 | Landing Page (/) | Mobile First | Customer-facing, public URL |
| 2 | Login (/login) | Mobile First | Access from anywhere |
| 3 | Forgot Password (/forgot-password) | Mobile First | Access from anywhere |
| 4 | Big Display (/{tenant}/display) | Mobile Ready | 16:9 TV/monitor, wall-mounted — never used on phones |
| 5 | Customer Kiosk (/{tenant}/kiosk) | Mobile First | Customer-facing touchscreen, tablet-primary |
| 6 | Employee Station (/{tenant}/employee) | Mobile Ready | Desktop workstation, data-dense dashboard |
| 7 | Mobile Employee (/{tenant}/mobile) | Mobile First | Explicitly designed for phone browsers, touch-optimized |
| 8 | Admin Panel — Dashboard (/{tenant}/admin → Dashboard) | Mobile Ready | Data tables, 8 KPI cards, charts, desk work |
| 9 | Admin Panel — Users (/{tenant}/admin → Users) | Mobile Ready | CRUD table, desk work |
| 10 | Admin Panel — Transactions (/{tenant}/admin → Transactions) | Mobile Ready | Config panel, infrequent access |
| 11 | Admin Panel — Windows (/{tenant}/admin → Windows) | Mobile Ready | Config panel, infrequent access |
| 12 | Admin Panel — Media (/{tenant}/admin → Media) | Mobile Ready | Video upload + playlist management, desk work |
| 13 | Admin Panel — Printer (/{tenant}/admin → Printer) | Mobile Ready | Receipt template editor, desk work |
| 14 | Admin Panel — Theme (/{tenant}/admin → Theme) | Mobile Ready | Color pickers + preview, desk work |
| 15 | Admin Panel — Tenant (/{tenant}/admin → Tenant) | Mobile Ready | Settings/subscription, infrequent access |
| 16 | Super Admin Login (/superadmin/login) | Mobile First | Public auth page — matches /login and /forgot-password pattern. Powerbyte staff may need to log in from phone (on-call, travel, troubleshooting). Single form (email + password + Turnstile) — no reason to desktop-first. |
| 17 | Super Admin Dashboard (/superadmin) | Mobile Ready | Internal tool, data-dense, Powerbyte staff at desks |

**Phase 4 implementation guidance (for Claude Code):**
- **Mobile First pages:** Design mobile layout first (375px baseline), progressively enhance for tablet (768px) and desktop (1024px+). Touch targets ≥44×44px minimum. Minimize cognitive load per screen. Simplified column counts. Single-column forms when viewport <768px.
- **Mobile Ready pages:** Design desktop layout first (1280px+ baseline), gracefully degrade to tablet (768px) and mobile (375px). Use shadcn/ui responsive patterns: horizontal scroll for wide tables, collapsible sidebars, drawer-based navigation on narrow viewports. Full functionality must remain accessible at all breakpoints.
- **BOTH strategies use shadcn/ui components** — the difference is breakpoint priority and initial design focus, NEVER the component library. Do not replace shadcn/ui with mobile-specific alternatives.
- **Tailwind breakpoint convention:** `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px). Mobile First pages use base + `md:` enhancements. Mobile Ready pages use base + `max-md:` fallbacks or conditional rendering.

## Non-functional Requirements
Performance:    <200ms API response at 100 concurrent users per tenant. Voice/audio within 100ms of user gesture. WebSocket event propagation <500ms end-to-end.
Uptime:         99.5% SLA for production.
Data retention: Ticket records kept 1 year. Configurable archival per tenant.
Compliance:     Privacy by design — no customer PII collected at kiosk. Employee data (name + PIN) scoped to tenant. DICT RA 10175 awareness (Philippines). No GDPR personal data from customers.

## Tenancy Model
multi
Subdirectory routing: cuelane.powerbyte.app/{tenant}/ (production) or localhost:PORT/{tenant}/ (dev)
Shared global data: subscription tier definitions, platform super-admin accounts, CueLane branding assets, default theme presets, system ads (global `system-ads/` storage)
DB isolation: shared PostgreSQL database with tenant_id column on all tables. Row-level security enforced via L6 Prisma extension ($allOperations). Tenant middleware cross-checks URL slug against session.
DB isolation exception: none — no payroll/banking/medical data requiring separate schema.
Feature gating: enforced at API + UI level based on tenant.tier (free | premium). Free tier limits: 4 windows, 6 transactions, 10 employees. Premium: unlimited.

## User-Facing URLs
/                           Platform landing page (marketing + sign up)
/login                      Tenant admin login
/forgot-password            Password reset request form
/{tenant}/display           Big Display for tenant (public, 16:9 TV/monitor)
/{tenant}/kiosk             Customer Kiosk for tenant (public, touch screen)
/{tenant}/employee          Employee Station for tenant (PIN protected, desktop)
/{tenant}/mobile            Mobile Employee for tenant (PIN protected, Premium only, phone)
/{tenant}/admin             Admin Panel for tenant (admin PIN protected)
/superadmin/login           CueLane platform super admin login (Powerbyte staff — public auth page)
/superadmin                 CueLane platform super admin dashboard (Powerbyte staff only — authenticated)

## Access Control
Public routes:    / (landing), /login, /forgot-password, /superadmin/login, /{tenant}/display, /{tenant}/kiosk
Protected routes: /{tenant}/employee (employee PIN + Turnstile + window selection), /{tenant}/mobile (employee PIN + Turnstile, Premium only)
Admin-only:       /{tenant}/admin (admin PIN + Turnstile)
Super-admin:      /superadmin (CueLane staff credentials — Auth.js v5 email/password + Turnstile on /superadmin/login, separate cookie namespace from tenant auth; unauthenticated access to any /superadmin/* route redirects to /superadmin/login)

## Data Sensitivity
PII stored:       Yes — tenant admin email (registration), employee names + PINs (per-tenant). No customer PII collected.
Financial data:   Yes — subscription billing via Xendit (PCI handled entirely by Xendit — no card numbers stored in CueLane DB. Xendit Philippines Inc regulated by BSP.)
Health data:      No
Audit required:   tenant.create, tenant.tier_change, tenant.suspend, ticket.status changes (waiting→serving→completed/skipped/noshow), ticket.transfer events, ticket.returnTo set/cleared, employee login/logout, admin config changes (user/transaction/window CRUD, theme change, printer config change, media mode change), subscription.create, subscription.change, subscription.cancel, subscription.payment_failed, system_ad.create, system_ad.delete, system_ad.enable/disable, tenant_ad.create, tenant_ad.delete, password_reset.requested, password_reset.completed
GDPR/compliance:  Tenant data export on request. Tenant data deletion on account closure (all tenant-scoped records purged). Employee data scoped to tenant — standard employment data handling. No customer data to export/delete (anonymous walk-ins).

## Security Requirements
Rate limiting:    public: 30/min | PIN attempts: 10/min with lockout after 5 failures | api: 120/min | upload: 20/min | password reset: 5/hour per email
CORS origins:     dev: localhost:* | staging: https://cuelane-staging.powerbyte.app | prod: https://cuelane.powerbyte.app
Security layers:  L3 RBAC + L5 AuditLog + L6 Prisma guardrails ($allOperations) always active.
                  L1 (tenant isolation middleware) + L2 (tenant-scoped session) + L4 (feature gate middleware) active for multi-tenant.
Tenant isolation: Every API call validates tenantId from session against URL slug. Prisma extension enforces tenant_id on all queries. Auth errors do not reveal whether accounts or tenants exist (anti-enumeration). Superadmin operations use separate router + dedicated Prisma client. File downloads verify tenantId matches storage path prefix. Cron jobs iterate over tenants explicitly — no unscoped queries.
CSRF protection:  tRPC + SameSite=Lax cookies are inherently CSRF-resistant. Admin/super-admin sessions use SameSite=Lax (Auth.js v5 default). Employee PIN auth is per-request (no session cookie) — no CSRF vector. Route Handlers and Server Actions prohibited for app logic — all mutations go through tRPC middleware.
Session invalidation: On role change or tenant reassignment, all existing sessions for the affected user are invalidated immediately.
Xendit webhook security: x-callback-token header verified on all incoming Xendit webhooks. Token stored server-only in CREDENTIALS.md + .env.{env}.
Human verification (Cloudflare Turnstile):
  Applied to:     Tenant signup, tenant admin login, employee PIN login (desktop + mobile), admin PIN login, super-admin login.
  NOT applied to: Customer Kiosk (shared touchscreen — CAPTCHA blocks legitimate use). Big Display (view-only, no input).
  Widget type:    Managed — auto-decides whether to show checkbox. Most humans pass without interaction.
  Token:          `cf-turnstile-response` field submitted with form. Max 2048 chars. Valid 300 seconds. Single-use.
  Verification:   Server POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Check `success: true`. On failure: "Verification failed. Please try again." — do not reveal whether failure was Turnstile or credentials (anti-enumeration).
  Rate limit:     No separate Turnstile-verify rate limit by design. Turnstile verification runs server-side through tRPC and inherits the `api: 120/min` ceiling. Every Turnstile-gated entry point already has a tighter upstream limit: public forms (signup/login) → `public: 30/min`, PIN entry → `PIN attempts: 10/min with lockout after 5 failures`, password reset → `5/hour per email`. An attacker cannot reach Turnstile verify without first hitting one of those tighter gates.
  Dev/test keys:
    Always-pass sitekey:   `1x00000000000000000000AA`
    Always-pass secret:    `1x0000000000000000000000000000000AA`
  CSP:            Add `https://challenges.cloudflare.com` to `script-src` and `frame-src`.

## Environments Needed
dev / stage / prod

## Domain / Base URL Expectations
Dev:     http://localhost:[port assigned by Phase 3 — do not specify a number here]
Stage:   https://cuelane-staging.powerbyte.app
Prod:    https://cuelane.powerbyte.app

## Infrastructure Notes
Default: all services run in Docker Compose — mono-server for dev/staging/prod.
Docker Hub publishing: enabled — hub_repo: bonitobonita24/cuelane
Docker tags: GitHub Actions pushes :latest, :staging-latest, and :sha-{hash} on every push to main.
pgAdmin: included on all environments — credentials auto-generated by Phase 3
CREDENTIALS.md: generated by Phase 3 — master credentials list for all envs, strictly gitignored. First admin: username `webmaster`, password in CREDENTIALS.md. All service passwords: 22-char minimum (openssl generated).
Security: HTTP headers + rate limiter + DOMPurify sanitizer scaffolded by Phase 4 — always-on defaults
Spec stress-test: Phase 2.7 runs automatically before Phase 3 — catches PRODUCT.md gaps early
Production services: Next.js app + PostgreSQL + Valkey (pub/sub + BullMQ) + MinIO (dev) / S3 (prod) for tenant media
Real-time sync: WebSocket connections per tenant via Valkey pub/sub for multi-device state sync (Big Display, Kiosks, Employee Stations, Mobile reflect same queue instantly)
Komodo deployment:
  Staging: auto_update: true — Komodo polls Docker Hub for new :staging-latest digests. Auto-redeploys on change.
  Production: auto_update: false — human clicks Deploy in Komodo UI after verifying staging.
  Docker Hub is the handoff point. GitHub Actions never contacts Komodo directly.
  Same compose YAML in both Stacks — COMPOSE_PROJECT_NAME namespaces all services. Staging and prod never share postgres, valkey, or minio even on the same server.
Traefik reverse proxy:
  Staging and prod app services routed via Traefik labels for automatic HTTPS routing. App service no longer exposes host ports — Traefik routes via Docker internal network.
  Dev compose unchanged (direct port mapping via Docker Desktop).
  Locked decision: TRAEFIK_NETWORK=proxy. .env.staging/.env.prod: TRAEFIK_NETWORK=proxy and APP_DOMAIN env vars set to staging/prod domains.
Xendit webhook handler: subscription lifecycle (recurring.plan.activated, recurring.plan.inactivated, recurring.cycle.succeeded, recurring.cycle.failed). Webhook URL configured in Xendit Dashboard per environment. Webhook verification via x-callback-token header.
Xendit credentials: XENDIT_SECRET_KEY in CREDENTIALS.md and .env.{env} (server-only). XENDIT_WEBHOOK_VERIFICATION_TOKEN in CREDENTIALS.md and .env.{env} (server-only). XENDIT_PUBLIC_KEY in .env.{env} (public). Dev/test: use Xendit test mode API keys. Node.js SDK: `xendit-node`.
Cloudflare Turnstile credentials: TURNSTILE_SITE_KEY in .env.{env} (public). TURNSTILE_SECRET_KEY in CREDENTIALS.md and .env.{env} (server-only). Dev: use Cloudflare dummy always-pass keys.
AWS path when ready: RDS, S3, ElastiCache, SES — update .env.{env} only, zero code changes.

## Tech Stack Preferences
Frontend framework:        Next.js
API style:                 tRPC
ORM / DB layer:            Prisma
Auth provider:             Auth.js v5 (tenant admin: email/password; employee: PIN-based custom credentials within tenant scope; super-admin: email/password separate)
Auth strategy:             authjs
Primary database:          PostgreSQL
Cache / queue:             Valkey + BullMQ (real-time pub/sub for multi-device WebSocket sync + background jobs: email sending, subscription webhooks, report generation)
File storage:              MinIO (dev) / S3 or R2 (prod) — tenant media uploads (logos, local videos, tenant ads) + system ads (global prefix)
UI component library:      shadcn/ui + Tailwind CSS (locked — no alternatives)
Chart library:             shadcn/ui Chart (Recharts) — Admin Dashboard: hourly traffic bar chart, completion/no-show rate progress bars, per-transaction breakdown progress bars
Map library:               none — no maps in CueLane
Complex UI components:     none — no Kanban/Gantt/Editor/Dropzone needed
Icon set:                  lucide-react (shadcn/ui default — no other icon libraries)
Mobile UI library:         none — responsive web

## Design Identity
Brand feel:         professional/enterprise SaaS
Target aesthetic:   Dark cinematic Big Display (deep navy/slate gradients, customizable via theme system). Clean white admin/employee/kiosk interfaces with theme accent colors. Corporate Slate default theme (#475569/#334155). Gold (#FCD34D) for Now Serving window names. Green/amber/red for status indicators throughout. DM Sans + Space Mono + Outfit font system.
Industry category:  SaaS / Business Operations / Service Management
Dark mode required: yes — Big Display always dark themed (display BG colors from theme). Employee Station and Admin Panel use light theme. Kiosk uses light theme (amber background when priority mode active).
Key constraint:     Big Display must be readable from 3+ meters on wall-mounted TV. All display text uses clamp() for fluid scaling across any resolution. 16:9 aspect ratio locked with black letterboxing on non-16:9 screens. Free tier enforces "CueLane — Powered by Powerbyte IT Solutions" branding on all customer-facing surfaces — non-negotiable.
Theming approach:   shadcn/ui CSS variables (--primary, --secondary, etc.) — customized in globals.css. CueLane extends with 9 custom theme tokens (primary, primaryDark, primaryLight, primaryBorder, primaryGlow, gold, displayBg1/2/3) applied via theme presets + custom color pickers. Reference: https://ui.shadcn.com/docs/theming · Dark mode: https://ui.shadcn.com/docs/dark-mode

## Out of Scope
- No native mobile app (iOS/Android) — responsive web only
- No SMS or push notifications to customers
- No customer account system or login (anonymous walk-ins only)
- No multi-branch centralized dashboard for a single tenant (one branch = one tenant instance)
- No public-facing REST/GraphQL API for third-party integrations
- No multi-language / i18n support (English only in v1)
- No print/export for dashboard reports (view-only in v1)
- No video calling or virtual queue (in-person walk-in only)
- No appointment scheduling or booking (walk-in only)
- No custom domain per tenant (subdirectory routing only: cuelane.powerbyte.app/{tenant}/)
- No annual billing plan (monthly only for v1)
- No dark mode for admin/employee/kiosk interfaces (dark theme is Big Display only)
- No queue priority rules beyond PWD/Senior/Pregnant (no VIP tiers, no paid priority)
- No polling fallback for real-time — WebSocket required
- No PDF/CSV dashboard export in v1
