# App and repository map

Checked 17 November 2026 through the connected GitHub, Vercel, Supabase and Sites accounts.

## Existing GitHub repositories

| Repository | Role | Action |
| --- | --- | --- |
| `creativequality49/CQA-VENDING-MACHINES-` | Existing Next.js vending, marketplace, private vault, billing, automation and FanX routes | Upgrade this repository in place. |
| `creativequality49/FanXfantasy` | Named in Vercel's deployed `fanxfantasy-cqa` and `fanxfantasy-prototype` commit metadata | GitHub returns 404 with the current connection. Confirm access/existence before changing it. |
| `creativequality49/CQAtradibgb` | Empty repository in the connected inventory | No evidence it contains any of the six apps. |
| `creativequality49/SILLYTAV` and `creativequality49/Nass-works-Nass-works` | Other small repositories | No verified match to the screenshot apps. |
| `gpt-anywhere`, `stripe-cli`, `openpi`, `harmony`, `openapi`, `babel` | Upstream forks/tools | Keep separate from these app upgrades. |

The GitHub inventory contains ten accessible repositories. The FanX repository appears in deployment history, but is not in that accessible inventory. A deployment's recorded source name is not proof that its repository still exists or is accessible today.

## Exact screenshot apps

All six have independent source repositories in **ChatGPT Sites**, not verified matching GitHub repositories. Their recovered source commits match the saved published versions.

| App | Exact Sites publication | Saved version | Relationship to this GitHub repository |
| --- | --- | --- | --- |
| Machine Market | `machine-market-ai-kits.creativequality.chatgpt.site` | 2 | Separate Vinext app. Marketplace concept overlaps; source is different. |
| FanXFantasy Creator Studio | `fanxfantasy-studio.creativequality.chatgpt.site` | 1 | Separate Vinext studio prototype. This repository has different `/fanxfantasy` and `/creator-studio` routes. |
| CQA YouTube Auto Engine | `cqa-youtube-auto-engine.creativequality.chatgpt.site` | 1 | Separate Vinext dashboard prototype; no matching app found here. |
| CQA AI Website Builder | `cqa-ai-website-builder.creativequality.chatgpt.site` | 5 | Separate Vinext/D1 app; no matching app found here. |
| Learnify Australia | `luxlearner.creativequality.chatgpt.site` | 10 | Separate Vinext app with Supabase/Stripe integration code; no matching app found here. |
| CQA AI Vending Machines | `vending.cqa.company` | 17 | Separate Vinext/D1 source. Same business, different implementation from this Next.js repository. |

The Sites platform reports successful publication for those versions, and the current access policies are owner-only. Successful publication proves deployment, not payments, AI generation, authentication or fulfilment. Sites' source repositories can be maintained in place without inventing a new GitHub match or copying a private app into this public repository.

## Existing Vercel and Supabase connections

- GitHub deployment records associate this repository's audited commit `a8b7613d5643064fc237cd9cc96b193b8cecd539` with Vercel projects `cqa-vending-machines` and `v0-machine-page-generation`.
- Vercel records `fanxfantasy-cqa` and `fanxfantasy-prototype` as deployed from `creativequality49/FanXfantasy`, commit `21dee23cd7c901f2d4a1a67039c2fa7c7b9c04e3`. The latest `fanxfantasy-revenue-build` deployment is cancelled.
- `cqa-ai-creator-os` exists in Vercel, but its inspected deployment metadata did not identify a GitHub repository. Do not infer one from the project name.
- Supabase `fanxfantasy` is the project referenced by the production example in this repository. `CQA Launch Test` is the isolated project named in the preview configuration. Both reported healthy at inspection time. `CQA Trading` reported inactive and has no established relationship to these six apps.
- Notion contains business operations/planning pages; the inspected infrastructure document is not a deployment manifest or source repository.

## Upgrade boundaries

Use branches and reviewed pull requests in confirmed existing repositories. Keep checkout release holds, protected storage and entitlement checks intact. Do not infer that the six Sites apps are all shipped by this repository. Additional GitHub access is needed to inspect the historically referenced FanX repository. Real provider configuration and controlled end-to-end integration evidence are still required before calling any app fully operational.
