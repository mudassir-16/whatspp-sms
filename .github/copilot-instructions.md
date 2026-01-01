# Copilot / AI Agent Instructions

Purpose: Short, actionable guide to help an AI coding agent be productive in this repository.

## Big picture
- Next.js app (app router) that powers a Blood Donor platform with an Admin panel.
- Multi-channel notifications: Email (Gmail SMTP / EmailJS), SMS (Twilio), WhatsApp (whatsapp-web.js with QR auth).
- Firebase (client-side config in `lib/firebase.ts`) is used for Auth and Firestore (collections: `admins`, `donors`, `emergencyNotifications`).
- Server APIs live under `app/api/*` (Next.js Route Handlers). WhatsApp routes explicitly set `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

## Key files & responsibilities (quick map)
- lib/
  - `whatsapp-service.ts` — core WhatsApp client handling, dynamic imports, global state, QR generation, init/logout, message send & bulk sending.
  - `whatsapp-notifications.ts` — message formatting for emergencies (see this for sample templates).
  - `twilio-service.ts` — Twilio client + phone formatting rules and bulk SMS helper.
  - `email-service.ts` — EmailJS (browser) + API fallback; `sendEmergencyNotifications()` helper.
  - `firebase.ts` — Firebase client initialization (note: config is present in source).
- app/api/
  - `send-whatsapp/route.ts` — POST/GET/PATCH/DELETE to control/init/send (server-only, dynamic); returns status + QR when needed.
  - `send-sms/route.ts` — server-side Twilio SMS POST endpoint.
  - `send-email/route.ts` — nodemailer/Gmail SMTP endpoint with robust error messages.
- app/admin/
  - `whatsapp/page.tsx` — Admin UI for initializing, viewing QR, and broadcasting; polls `/api/send-whatsapp` frequently while waiting for QR.
  - `login/page.tsx` & `components/admin-login-form.tsx` — Firebase-based admin auth; `admins` Firestore doc must exist to grant admin privileges.

## Project-specific conventions & patterns
- Server-only modules protect against client bundling using: if (typeof window !== 'undefined') throw new Error(...).
- Heavy or native deps are imported dynamically to avoid Next.js bundling issues (see `whatsapp-service.ts` loadWhatsAppDependencies()).
- **Common build failure**: Turbopack can fail with "Can't resolve 'fs'" or "Can't resolve 'net'" when a server-only package (e.g., `twilio`, `whatsapp-web.js`, `nodemailer`) is accidentally imported into a client component. Fix pattern: remove the import from the client and call a server API route (e.g., `/api/send-sms/broadcast` or `/api/send-whatsapp`) which imports the server-only package.
- Persistent state across hot-reloads uses `globalThis` (e.g. `globalAny.whatsappState`). This is intentional — keep global state usage when modifying lifecycle logic.
- WhatsApp initialization sometimes runs in background (initialize with `waitForReady=false`) — admin UI expects this behaviour to show QR quickly.
- Phone number normalization defaults to India (+91) in both Twilio and WhatsApp services; phone parsing logic is in `lib/twilio-service.ts` and `lib/whatsapp-service.ts`.
- Bulk sending throttling:
  - WhatsApp: sequential loop with 2s delay to avoid rate limiting (`sendBulkWhatsAppMessages`).
  - Twilio: `sendEmergencySMS` uses Promise.all (parallel) — watch for rate limits if scaling.

## Environment variables (important)
- Required/used in code (examples):
  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (Twilio)
  - GMAIL_USER, GMAIL_APP_PASSWORD (nodemailer SMTP)
  - NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, NEXT_PUBLIC_EMAILJS_PUBLIC_KEY (EmailJS fallback)
  - PUPPETEER_EXECUTABLE_PATH (optional) — used when launching headless chrome for whatsapp-web.js
  - NEXT_PUBLIC_ADMIN_EMAIL / ADMIN_EMAIL — admin notification email (used as bcc in `send-email`)
- Node version: declared in `package.json` engines (>=20.0.0)

## Dev / build / test commands
- Development: npm run dev (starts Next.js dev server)
- Build: npm run build
- Start (prod): npm run start
- Lint: npm run lint
- There are no unit tests or CI configured — add tests under `__tests__` if needed and a test script in package.json.

## Deployment notes
- Dockerfile present and README/WHATSAPP_SETUP.md provides Render.com-specific guidance for WhatsApp persistence (mount a disk for `.wwebjs_auth`).
- Vercel and Netlify config exist but WhatsApp persistence requires a persistent filesystem (Render or Docker with volume).

## How to make safe changes (examples)
- Add a new notification channel: follow existing pattern
  1. Add service helper under `lib/` with server-only guard if it depends on native modules.
 2. Expose server APIs under `app/api/<channel>/route.ts` (mark runtime=nodejs if necessary).
 3. Wire UI in `app/admin/*` for initialization/status and add admin controls.
 4. Reuse `sendEmergencyNotifications()` pattern for batching and observe throttling concerns.

- Debugging WhatsApp flow (common task):
  1. Run `npm run dev` and open `/admin/login` (admin account required in `admins` collection).
  2. Click "Initialize WhatsApp" → check server console for QR (also visible in UI via `/api/send-whatsapp`).
  3. If failing, inspect `globalAny.whatsappState.initializationError` in logs and restart server.
  4. For production persistence, ensure `.wwebjs_auth` directory is mounted (see WHATSAPP_SETUP.md).

## Code authoring hints for AI agents
- Prefer to change behaviour in `lib/*` service modules for notification logic; UI changes belong in `app/admin/` or `components/`.
- Keep server-only code in Route Handlers or `lib` modules that guard against client bundling.
- When adding imports of large/native modules, use dynamic imports (see `loadWhatsAppDependencies()` pattern).
- When modifying state lifecycle of WhatsApp client, preserve `globalThis.whatsappState` semantics to remain compatible with hot reloading and admin UI polling.

## Quick snippets to reference
- Check WhatsApp status (server): `GET /api/send-whatsapp` → returns `{ status: getWhatsAppStatus() }`.
- Send single SMS (server): POST `/api/send-sms` with body `{ to: "+919999999999", body: "message" }`.
- Send single WhatsApp: POST `/api/send-whatsapp` with `{ phoneNumber, message }`.
- Send bulk WhatsApp: POST `/api/send-whatsapp` with `{ recipients: [{ phoneNumber, message }, ...] }`.

---
If anything here is unclear or you want more detail about a specific area (auth, WhatsApp lifecycle, or bulk-sending logic), tell me which section to expand or give an example task and I will iterate. ✅
