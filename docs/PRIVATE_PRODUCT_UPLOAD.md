# Private marketplace product files

Repair prepared 31 October 2026 for draft PR #23. It is not a production release
or evidence of a real payment-to-download test. Digital checkout stays blocked.

## Owner flow

1. In Owner Dashboard, create a digital-product offer.
2. Open **Private product files** and select an owned product by name.
3. Upload a PDF, ZIP, PNG, JPG or UTF-8 TXT file up to 4 MiB (shown as 4 MB).
4. A confirmed upload marks that product as attached and clears the file input.

There is no manual database ID to copy. An attached file cannot be replaced on
the same offer. Create a new offer for a new file so existing purchases keep
their intended asset. Duplicate form submissions send one upload request.

## Implementation and boundaries

`GET /api/owner/marketplace-asset` verifies the bearer token with Supabase
`auth.getUser`, requires a confirmed account and returns only that owner's
digital product IDs, names and attachment flags. Private storage keys and
fulfilment configuration are excluded from its response.

`POST` bounds multipart input before parsing, validates the actual file signature
or UTF-8 text, verifies business and machine ownership, refuses paid or already
attached offers, then writes a random business/offer-scoped object into existing
R2 storage. The metadata update is conditional on the previous JSONB snapshot,
so simultaneous requests cannot replace another successful attachment. Existing
delivery/support/refund fields are preserved. The R2 object is marked private,
non-cacheable and an attachment; the response contains no public or signed URL.

The old 15 MB server-upload limit exceeded Vercel's documented 4.5 MB request
limit. This route uses a 4 MiB file limit plus 64 KiB multipart allowance. Larger
assets require a separately reviewed direct-upload protocol that preserves
immutable objects; increasing this server limit alone does not make them work.

On storage or metadata failure the UI does not claim success. A successful R2
write followed by a failed/conflicting metadata save can leave an unreferenced
private object. It does not become a downloadable product. Inventory-based
orphan reconciliation remains a separate maintenance follow-up; this change
does not delete storage objects. No new migrations or permissions are included.

## Verification

The behavioural suite executes genuine transpiled route, validation, storage and
React page code, with external Supabase/R2 dependencies mocked. It covers normal
attachment, owner/tenant/machine isolation, immutable and paid offers, concurrent
updates, spoofed formats, exact file boundaries, malformed/chunked requests,
provider/storage/database failures, private object headers, session/picker states,
false-success responses, duplicate submission and confirmed UI clearing.

Run `npm run test:commerce` for commerce coverage, including the upload suite.
The coordination harness also runs all regression files, TypeScript, lint and
the production build. Visual browser QA, real R2 bucket privacy, deployed metadata
persistence and a genuine test-mode purchase/refund/download remain unverified.
Server-side signature checks are format checks, not malware scanning.

R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are referenced
only by the existing server storage helper. Their values are never required in
test reports. Before release, verify the selected bucket has no public access
and use authorised test owners and buyers to exercise the real integration.

References checked on 31 October 2026:
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Supabase verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase changelog](https://supabase.com/changelog.md)
