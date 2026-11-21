# Preview email-login redirect diagnosis

On 19 November 2026, the customer reported `localhost:3000` after opening the
email sign-in link. This is a confirmed provider URL-configuration fault,
not evidence that a phone can access the development server.

## Observed result

Safe GET verification probes used only an invalid synthetic token, did not
send emails, and did not follow the response redirect:

- Isolated Supabase `ndzmlywsuywkhgqdbzft` returned HTTP 303 to
  `http://localhost:3000` for both the immutable candidate Preview callback and
  the stable branch callback.
- Production Supabase `rjxiuukphwybujuclenn` preserved the canonical HTTPS
  confirmation callback.

Thus the isolated project's Auth Site URL falls back to localhost and its
redirect allowlist does not accept the tested hosted callback addresses.
The app already uses relative password-login/dashboard transitions and validates
callback destinations. Additional server-link guards now reject hosted localhost
configuration and require HTTPS for hosted links.

## Required provider correction (not yet applied)

In **CQA Launch Test → Authentication → URL Configuration**:

1. Set Site URL to the stable hosted Preview origin:
   `https://cqa-vending-machines-git-codex-local-set-65f071-creativequality.vercel.app`
2. Allow the stable branch callback and recovery paths, including their query
   strings, using Supabase's documented URL-pattern syntax:
   `https://cqa-vending-machines-git-codex-local-set-65f071-creativequality.vercel.app/auth/confirm**`
   `https://cqa-vending-machines-git-codex-local-set-65f071-creativequality.vercel.app/reset-password**`
3. Also allow `/auth/confirm**` and `/reset-password**` on the exact immutable
   candidate deployment origin being tested. It changes with each deployment;
   use the actual current Preview URL from PR #50, not an old candidate.
4. Preserve any deliberate local-development entries separately; do not use
   localhost as the fallback for hosted customers. Do not change Production
   settings as part of this isolated fix.
5. Repeat the invalid-token probe: Location must stay on the requested hosted
   callback, with an expired-token error. Then request a fresh real email and
   confirm it reaches the intended dashboard with a verified session.

The connector cannot edit Auth URL settings. The dashboard required sign-in,
and the secure sign-in request was declined. No remote Auth settings changed.
Source hardening alone does not fix that provider configuration. Old emails may
still point to the wrong address and should be replaced after the correction.

Reference: https://supabase.com/docs/guides/auth/redirect-urls

## Browser verification scope

`CQA_UI_BROWSER_EXECUTABLE=/usr/bin/chromium node scripts/verify-login-workspace-ui.mjs`
uses a local server and intercepted synthetic sessions with external requests
blocked. It verifies password-login and callback routing, token scrubbing,
desktop/mobile layout and constellation navigation/zoom/reset. It does not prove
real email delivery, provider allowlist settings or real customer authentication.
