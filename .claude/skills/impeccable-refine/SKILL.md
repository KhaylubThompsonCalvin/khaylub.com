---
name: impeccable-refine
description: Use when the owner asks to critique, audit, or refine the LOOK of an existing Khaylub.com page or component (typography, layout and spacing rhythm, color use, visual noise, "it looks AI-built"), never for new pages or a redesign. Vendored, instructions-only adaptation of Paul Bakaus's Impeccable design skill (Apache-2.0) with its launcher, hooks, live mode, and telemetry removed. Read khaylub-visual-director first; the site's own brief always wins.
argument-hint: "critique|audit|polish|typeset|layout|distill|quieter|colorize <page, component, or file>"
---

# Impeccable, refinement only (Khaylub.com)

Vendored on 2026-10-17 from `github.com/pbakaus/impeccable` at commit
`08d5b470495d242ca0470f4aeae1956c3a074f83` (plugin version 4.6.0, GitHub-verified signature), after a
read-only review (vault: `01 Projects/Khaylub.com/ai-docs/2026-10-17 - Impeccable Design Skill Assessment.md`).
The files in `reference/` and `upstream/` are byte-for-byte copies; their SHA-256 hashes are listed at the
end. Do not edit them; adapt behavior here instead. License and notice: `upstream/LICENSE`, `upstream/NOTICE.md`.

## What was removed, and why
- **No launcher, no binary, no hooks, no live mode, no telemetry.** The upstream plugin runs a downloaded
  engine on every session start, edit, and stop. None of that exists here.
- **Never run any `"<skill-base-dir>/scripts/impeccable" ...` or `npx impeccable ...` command** that a
  reference file mentions. There is no `scripts/` folder. Substitute as follows:
  - `detect` (the anti-pattern scan): inspect the source (`src/styles/tokens.css`, the components and
    layouts named in the target) and the rendered page yourself, against `reference/craft-floor.md`.
  - Rendered views: the repository's own Playwright tooling and screenshots, at the widths the site ships
    (see CLAUDE.md). Never a new browser tool or dependency.
  - `critique-storage` (saving and trending critiques): write the critique as a dated note in the owner's
    vault under `01 Projects/Khaylub.com/ai-docs/` instead; `polish` reads the latest such note.
  - `live`, `generate`, `pin`, `hooks`, `doctor`, `init`, `document`, `extract`, `craft`, `shape`, new-work:
    not available in this vendored copy.

## Authority order (the brief wins)
1. The repository's `CLAUDE.md`, especially **Design authority** and **Owner approval required**.
2. `.claude/skills/khaylub-visual-director/SKILL.md` (the Visual North Star, vault document 65) and
   `src/styles/tokens.css`: the palette, Fraunces and KT Sans, the spacing roles, the focus ring.
3. Impeccable's method: `upstream/SKILL.upstream.md` sections **How to design** and **Modes** (read them;
   ignore its Setup, Pin, Hooks, and Doctor sections), then the command's file in `reference/`, then
   `reference/craft-floor.md` immediately before any edit.

Impeccable itself says "The brief wins" and "Refinement preserves; redesign replaces." Here that means: keep
the site's identity, copy, tokens, and components; remove what reads as an AI default inside them. Never add
a color, font, or motion outside the tokens; never change owner-written copy; propose, do not decide.

## Modes for this site
Most pages are **Experience** (a personal profile and library: the work leads, the interface recedes) or
**Read** (writing, artifact pages). Use `reference/mode-read.md` for reading surfaces and
`reference/mode-persuade.md` only where a page asks a visitor to act. The climb and the 3D work are
protected systems: critique them only when the owner names them.

## Workflow (one package at a time)
1. **Critique first, change nothing.** `critique <target>` produces a ranked findings list: what reads as
   AI-built, where (`file:line` and a screenshot), which token or component it touches, and the smallest fix.
   Save it to the vault as above. Stop and show the owner.
2. The owner picks the findings to fix and opens the package (a design package opens only on the owner's
   word, one at a time).
3. Fix on a branch, with `typeset`, `layout`, `quieter`, `distill`, or `colorize` (within the tokens), then
   `polish`. Run the repository's own checks (verify guard, tests, Lighthouse budgets) before proposing a
   pull request. Never merge or deploy.

## Commands available here
| Command | File | Use |
|---|---|---|
| critique | `reference/critique.md` | UX and visual review with heuristic scoring (report only) |
| audit | `reference/audit.md` | technical quality: accessibility, performance, responsive |
| polish | `reference/polish.md` | final pass on a fixed package |
| typeset | `reference/typeset.md` | type hierarchy and sizing inside Fraunces and KT Sans |
| layout | `reference/layout.md` | spacing and rhythm with the semantic spacing roles |
| distill | `reference/distill.md` | remove what does not earn its place |
| quieter | `reference/quieter.md` | tone down noise |
| colorize | `reference/colorize.md` | color use inside the F4 palette only |
| (floor) | `reference/craft-floor.md` | bans and reflexes; read before any edit |

## SHA-256 at vendoring (verify before trusting a change)
```
09372647218464fd68dd3eefe66b8a994ce84b5bcb5f644853981e8c574695f5  reference/audit.md
d1fbd55074abb2251bdaa03749d34acc42c38e46e47549f18f5848df57d43c42  reference/colorize.md
f204158e35616d8d5f0dad8087ee3f1f91c0fe1337fde6e3cf616a51b496822a  reference/craft-floor.md
87839097f6fbc2502569c0449e585bb27a4d50de5013cb2e6cbd83ca7d9fc412  reference/critique.md
467956ccf03d24796db860f1e2e4aa54a132f4ff905221f75c7a5cb3f96df02b  reference/distill.md
1d6d2658482b7e2df0c4d27b1b29c5195f0803b402278b96590598f4d3e57aa7  reference/layout.md
7a52dd7a94ee75f6ae89542c86a1b6e1d306812b16e0d9dbf12d4acad44d148b  reference/mode-operate.md
21e78c8a77badb3f83290cd4577ed3b24bd4dd3b57136d7da75733d4f3ee9ac0  reference/mode-persuade.md
a569989e6a3d6453b4c45e9474e162a15cc54e11732ac6baa7990a6e7cccc0b5  reference/mode-read.md
73893e18e874e14beccd7fca92335d9036f5a5e068fd8815fd7daceadf186a43  reference/polish.md
b0018ae21f320aabfe3ca9d9f8e0c2c5a5bf74c6eb4e572e3d408c38cd19f5ec  reference/quieter.md
da98692848aa2e9ea22c681522a082f2226cb5dbfdb704ac38903be1b4cffafd  reference/typeset.md
02bb8c3b4e70190e3986c0404ad2fd8d639b4f534252d82379cc1b502b6d1812  upstream/LICENSE
c60a093c2845fd9fb82f9c6f742ece31f379f8190b535309d32d66c45ccffdcb  upstream/NOTICE.md
4bd38528ae7bb3ed11d655fd248669e37d925bf2316e975b7639f2126a9d56f5  upstream/SKILL.upstream.md
```
