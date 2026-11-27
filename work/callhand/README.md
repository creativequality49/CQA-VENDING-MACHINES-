# Callhand

An AI receptionist for Australian trades. When the owner can't answer, Callhand picks up, finds out what the job is, takes down the caller's details, and texts the job to the owner so they can call back.

Version one does four things, and nothing else:

1. **Answers** calls forwarded to the business's Callhand number.
2. **Captures** the job: what it is, suburb, urgency, name and call-back number.
3. **Alerts** the owner with one text per call, sent from their Callhand number.
4. **Logs** every call in a phone-friendly dashboard with the transcript.

It never quotes prices, books jobs or promises a time. It tells every caller it is an AI.

## How a call works

```
Caller rings the business  ──(forwarded)──▶  Callhand number (Twilio)
                                                   │
                         POST /twilio/voice  (signed by Twilio)
                         - number → business
                         - busy-line and repeat-caller limits
                         - call recorded, short-lived token issued
                                                   │
                     Twilio ConversationRelay (speech ⇄ text)
                                                   │
                     wss /twilio/relay  (Twilio signature + token)
                         - conversation runs (OpenAI)
                         - job details saved as they're heard
                                                   │
             call ends: socket closes and/or POST /twilio/voice/complete
                         - call completed, outcome set
                         - owner texted at most once (database-enforced)
```

If OpenAI is down mid-call, the receptionist switches to a short scripted message-take, so the caller is never left hanging and the owner still gets the details.

## Project layout

```
server/            Node + Express API, Twilio webhooks, call socket
  calls/           conversation engine, prompt, call completion, Twilio helpers
  routes/          owner API (api.ts) and Twilio webhooks (twilio.ts)
shared/            code used by server and dashboard (phone formats, alert text, checklist)
src/               React dashboard
supabase/          database migration (tables, row-level security, functions)
scripts/           operator tools and the database test runner
tests/             unit/integration tests; tests/db has the database security tests
```

## Getting it live

You need accounts with Supabase, Twilio and OpenAI, and somewhere to host a Node server that supports WebSockets (Railway, Render, Fly.io or a VPS all work).

### 1. Supabase

1. Create a project.
2. In the SQL editor, run `supabase/migrations/0001_callhand.sql`.
3. Under Authentication → URL configuration, set the Site URL to your app's address (for example `https://app.callhand.com.au`) so confirmation and sign-in links come back to it.
4. Copy the project URL, anon key and service role key from Settings → API.

### 2. Twilio

1. Buy an Australian number with voice and SMS. Australian numbers need a regulatory bundle (business details and address) approved before purchase.
2. Set the number's voice webhook ("A call comes in") to `https://<your app>/twilio/voice`, method POST.
3. Make sure ConversationRelay is available on your account and region.
4. Copy the Account SID and Auth Token.

### 3. Configure and deploy

Copy `.env.example` to `.env` (or set these in your host) and fill everything in. `APP_URL` must be the public `https://` address, because Twilio signs requests against it. Generate `CALL_TOKEN_SECRET` with `openssl rand -hex 32`.

```bash
npm ci
npm run build      # builds the dashboard; needs the VITE_ variables set
npm start          # serves the dashboard, API, webhooks and call socket on PORT
```

On start the server logs `readyForCalls` and anything still missing.

### 4. Set up a business

1. Sign up in the dashboard and enter the business name.
2. Give the business its number (operator step, so nobody can claim someone else's number):
   ```bash
   npm run assign-number -- <business-id> 0255550101
   ```
   The business id is in the `businesses` table.
3. In Settings, add the owner's mobile and what the business does.
4. Use **Try it** to check how the receptionist handles a few calls.
5. Press **Start answering**. It stays locked until the checklist is complete.
6. The owner sets their mobile to forward calls to the Callhand number when busy, unanswered or unreachable (their carrier's call-forwarding settings).

## Development

```bash
npm install
cp .env.example .env     # fill in at least the Supabase values
npm run dev              # API on :3000, dashboard on :5173
```

To test real calls locally, expose port 3000 with a tunnel (for example ngrok), set `APP_URL` to the tunnel's https address, and point the Twilio number at it.

### Checks

```bash
npm run typecheck
npm test           # 48 unit and integration tests (calls, webhooks, socket, API)
npm run test:db    # 34 database security tests on a throwaway PostgreSQL
npm run build
```

`npm run test:db` needs PostgreSQL 15+ server binaries installed locally. It never touches a real Supabase project.

## Security model

- **Every table has row-level security.** A signed-in user only ever sees their own business. The database tests check cross-business reads and writes for every table.
- **The browser can change very little:** the owner's receptionist settings and the "done" mark on a call. Calls, captured details and alerts are written only by the server.
- **Twilio requests are verified.** Webhooks need a valid Twilio signature; the call socket needs both a Twilio signature and a signed token for that exact call, valid for 3 minutes.
- **Phone numbers are assigned by the operator**, so a business can't claim a number and receive another business's calls.
- **One text per call**, enforced by a unique constraint, however many times the call-end paths run.
- **Spend limits:** at most 5 simultaneous calls per business and 6 calls per caller per hour reach the AI; calls end after 30 turns or 12 minutes.
- Logs contain ids and outcome codes, never what callers said.

## Not built yet

- **Not tested against live Twilio, OpenAI or Supabase.** Everything is tested with mocks, a local PostgreSQL and a browser; the first real call is the next step.
- No booking, quoting, call recording, or texting the caller back.
- One business per account; staff can't be invited yet (the database supports staff members).
- Transcripts are kept indefinitely; there is no retention or deletion setting yet. They contain personal information, so a privacy policy and retention period are needed before launch under the Privacy Act.
- "Try it" sessions and their rate limit live in server memory, so they assume a single server instance.
- An owner could switch answering on directly through the Supabase API, skipping the checklist. Calls are still blocked if the server isn't ready; they'd just miss the owner's text if no mobile is set.
