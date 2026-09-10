# Khaylub.com V2

The second version of khaylub.com: a static profile and public library built with Astro, with the original 3D climb kept as an opt-in cinematic island.

This repository holds V2 only. Version 1 lives in `khaylub-portfolio`, frozen at tag `v1.0.0-3d-experiment`, and is never modified from here.

## Rules that hold in every branch

- Production khaylub.com is not touched until the rehearsed cutover phase.
- No Render service, DNS, or hosting setting is created or changed from this repository before the owner approves it.
- No credentials are read, stored, or committed. `.env*` files are ignored.
- Public content only. Private systems, finances, school records, health, family, and client internals never enter `content/`.
- No em dashes in public copy. AI is never listed as a skill.

## Run

```
npm ci
npm run build
npm run preview
```

Planning documents live in the owner's vault under `01 Projects/Khaylub.com/docs/V2/` (documents 00 to 32). This code follows document 32, the Phase 9 implementation plan.

## License

Code: MIT (see `LICENSE`). Content under `content/` and media under `public/`: all rights reserved unless a file's provenance record says otherwise.
