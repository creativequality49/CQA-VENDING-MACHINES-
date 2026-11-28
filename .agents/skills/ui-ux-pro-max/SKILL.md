---
name: ui-ux-pro-max
description: CQA UI/UX design workflow using pinned UI UX Pro Max upstream guidance.
---

Read `docs/design/cqa-design-system.md` first. Install the pinned upstream payload using `node scripts/install-ui-ux-pro-max.mjs` after reviewing the upstream code and data provenance. The installer places the upstream skill in `.agents/skills/ui-ux-pro-max-upstream/`; read its SKILL.md and use its local Python search scripts. Do not run unreviewed upstream code or pass secrets/customer data to design tools. If installation is unavailable, report that limitation and apply CQA design rules manually. Never change checkout, authorization or fulfillment logic for visual polish.
