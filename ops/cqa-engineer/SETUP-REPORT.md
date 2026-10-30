# CQA Website Engineer — setup and test report

Prepared 30 October 2026. Overall status: **PARTIALLY WORKING**.
The engineer controls and repository checks work locally. The daily task is
enabled. Its first unattended repair is not yet observed, and GitHub Actions
cannot start because of an account billing lock. CQA launch stays **NOT READY**.

| Component | Status and evidence |
|---|---|
| Agent specification | Completed: [AGENT.md](AGENT.md), mission, workflow, gates, recovery, costs and operating guide. |
| Persistent state and lease controls | Completed: state.json/state.mjs. A real conditional GitHub write succeeded, a deliberately stale write was rejected with HTTP 409, and the setup lease was released. |
| Engineer control tests | Completed: 10/10, independently rerun by release reviewer. Covers failure, retry, response filtering, duplicate/expired/invalid leases and exact-SHA release evidence. |
| Existing main + engineer changes | Passed locally: all 18 check groups, TypeScript, lint and Next production build on Node 24.22.1. App base 2b975ae6f7c79c36493c4f72245d4d661c6c44c9, with the new engineer files uncommitted during those checks. |
| Existing PR #23 checkout | Passed locally: all 18 check groups, TypeScript, lint and production build at e1f12406b52789854521ebf389df28680ceb44d3, using the separate coordination harness. No application code was edited there. |
| Public site health | Passed: homepage, /machines, /pricing, /login, /api/health, observed 2026-10-30T06:07:00Z. Health component enums were all ok. This establishes reachability/configuration only. |
| Remote GitHub CI | BLOCKED: new engineer run 41013101785 was created but its job did not start. GitHub check annotations explicitly report an account billing lock. PR #23 run 40713410404 also reports failure; its logs were unavailable. Local success does not overwrite either result. |
| Vercel preview | Passed: the cqa-vending-machines Vercel check reports success on engineer commit 73e96933ce76dc74a5f5c50b7c3b1479dd06947a. Production was not promoted. |
| Schedule | Completed: CQA Website Engineer task created and enabled, daily morning around 08:00 Australia/Adelaide, flexible timing, starting 31 October 2026. First scheduled execution is still unverified. |
| True payment-to-download test | Not completed: authorised test-mode Stripe/Supabase/private-storage flow and isolation/refund evidence still required. |
| Production release | Not approved or performed. PR #23 remains draft/open/unmerged. |

Lint completed with 19 existing warnings on main (image optimisation and hook
dependencies), zero errors. Tests use mocked dependencies; no live charge,
refund, migration or customer message was made. Report metadata now resolves
commit identity from the tested checkout, separately from the harness checkout.

The existing Next.js/Vercel/Supabase/Stripe repository was retained. GitHub and
Vercel reads succeeded. Public health executed against the real domain.
The task uses connected tools and the ChatGPT runtime; no new hosted model API,
server subscription or copied production secrets were introduced.

The new workflow uses pinned checkout/setup-node revisions, Node 24, bounded
execution, contents-read permission and no deploy/write/provider-secret step.
It runs checks on branch/PR changes. The daily ChatGPT task provides repair
orchestration. Before that workflow is merged into main, a repair branch uses
its own available CI and the cross-checkout local harness; no CI is assumed.

Operate/pause: use the named CQA Website Engineer task in ChatGPT Tasks. Preserve
its ID when editing/pause/resuming. Resume after a failure by following the exact
access or test blocker in its latest run; it rereads state and reconciles old
branches before new changes. Roll back this setup by pausing the task and closing
the engineer PR if unmerged, or reverting the reviewed setup commit if merged.
No website release is needed to run the scheduled orchestration.

GitHub Actions blocker: the owner must review [GitHub billing](https://github.com/settings/billing).
The observed check annotation says the job was not started because the account
is locked due to a billing issue. No payment or billing change was made here.
The engineer can continue local tests and branch repairs while that is resolved.

Cost: no new API key or subscription is required by this implementation.
ChatGPT Tasks, GitHub Actions and Vercel preview use remain subject to existing
account allowances; actual incremental cost is unverified. No resources were
purchased. See AGENT.md for the ranked failure guide and launch evidence gates.

Next highest-value task: reconcile PR #23 and implement the missing private
owner upload and account-bound buyer library, keeping digital checkout held
until genuine payment-to-download, revocation and two-account tests pass.
