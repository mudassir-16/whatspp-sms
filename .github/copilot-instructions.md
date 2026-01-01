# Copilot / AI Agent Instructions

Purpose: Short, actionable guidance to help an AI coding agent be productive in this repository.

## Big picture
- Next.js (app router) Blood Donor platform with an Admin panel.
- Multi-channel notifications: Email (nodemailer / EmailJS), SMS (Twilio), WhatsApp (whatsapp-web.js using QR auth).
- Firebase client (`lib/firebase.ts`) handles Auth + Firestore collections: `admins`, `donors`, `emergencyNotifications`.
- Server APIs live under `app/api/*` (Next.js Route Handlers). WhatsApp routes must run with `runtime = "nodejs"` (often `dynamic = "force-dynamic"`).

## Key files (fast map)
- `lib/whatsapp-service.ts` — WhatsApp lifecycle, dynamic imports, QR gen, `globalThis.whatsappState`, send & bulk logic.
- `lib/whatsapp-notifications.ts` — message templates for emergencies.
- `lib/twilio-service.ts` & `lib/email-service.ts` — SMS/Email helpers, normalization, and bulk helpers.
- `app/api/send-whatsapp/route.ts`, `app/api/send-sms/route.ts`, `app/api/send-email/route.ts` — server-side entry points.
- Admin UI: `app/admin/whatsapp/page.tsx`, `app/admin/login/page.tsx`, `components/admin-login-form.tsx`.

## Project conventions & common pitfalls
- Do NOT import server-only packages into client code. Use server guards (`if (typeof window !== 'undefined') throw`) or move logic to `app/api/*`.
- Use dynamic imports for heavy/native deps (see `loadWhatsAppDependencies()` in `whatsapp-service.ts`).
- Build error tip: "Can't resolve 'fs'" / "Can't resolve 'net'" → you probably imported a native module in a client bundle.
- Preserve `globalThis.whatsappState` when changing lifecycle code so hot-reloads and admin polling remain compatible.
- Phone parsing defaults to India (+91). Check `lib/twilio-service.ts` and `lib/whatsapp-service.ts` when changing normalization.
- Bulk sending behavior:
  - WhatsApp: sequential sends with ~2s delay to avoid rate limits.
  - Twilio: parallel sends via `Promise.all` (watch rate limits when scaling).

## Environment & runtime notes
- Important env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NEXT_PUBLIC_EMAILJS_*`, `PUPPETEER_EXECUTABLE_PATH`, `NEXT_PUBLIC_ADMIN_EMAIL`.
- Node >= 20 required (see `package.json` engines).

## Dev / debug commands
- Dev server: `npm run dev`
- Build: `npm run build` | Start: `npm run start` | Lint: `npm run lint`
- Helpful scripts: `setup-firebase.js`, `setup-admin.js`, `check-admins.js`, `test-email.js`.
- WhatsApp debug flow: open `/admin/login`, click **Initialize WhatsApp** (UI polls `/api/send-whatsapp` and server prints QR). Inspect `globalAny.whatsappState` for errors.

## Deployment & persistence
- WhatsApp persistence requires a filesystem for `.wwebjs_auth` (see `WHATSAPP_SETUP.md` and Dockerfile). Vercel/Netlify aren’t suitable unless you provide persistence (Render or Docker volume recommended).

## How to add/change a notification channel
1. Add a server-guarded helper in `lib/` (follow existing patterns).
2. Expose a Route Handler at `app/api/<channel>/route.ts` (use `runtime='nodejs'` if it uses native modules).
3. Add UI under `app/admin/*` if admin control is needed.
4. Reuse `sendEmergencyNotifications()` style for batching and respect throttling.

## Quick API examples
- GET `/api/send-whatsapp` → status & QR info
- POST `/api/send-sms` { to, body }
- POST `/api/send-whatsapp` { phoneNumber, message } or { recipients: [{ phoneNumber, message }, ...] }

---
If any section is unclear or you'd like short code snippets/checklists for PRs, tell me which area to expand and I'll iterate. ✅
