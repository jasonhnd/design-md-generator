# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3] - 2026-04-17

### Added

- **Universal AI agent support** — Entry point files for every major platform:
  - `AGENTS.md` for OpenAI Codex CLI
  - `CLAUDE.md` for Claude Code
  - `GEMINI.md` for Gemini CLI
  - `.cursorrules` for Cursor
  - `.windsurfrules` for Windsurf/Codeium
  - `.github/copilot-instructions.md` for GitHub Copilot
- **npm publish readiness** — `tsc` build to `dist/`, compiled `bin` entry, `.npmignore`, `prepublishOnly` hook. Package name: `design-md-gen`.
- **Report + proof merged into single page** — `report.html` now includes fidelity proof (side-by-side comparison, coverage score) when `proof-data.json` is available. No separate `proof.html` needed.
- **DESIGN.md action buttons** — Report shows "Download MD File" and "Copy All Content" buttons above the embedded full text.
- **Scoring methodology explained inline** — Both quality score and fidelity measurement include "How this is calculated" sections in the report.
- **Color palette split** — Report separates Brand Colors (chromatic) from Structural Colors (achromatic grays) for clearer presentation.
- **Image region exclusion in fidelity proof** — Proof now detects `<img>`, `<video>`, `<svg>`, and `background-image` elements and excludes their pixel regions from color coverage sampling. Measures CSS-rendered areas only.

### Fixed

- **Preview all-black on dark sites** — `inferBackground` and `inferTextColor` now select by luminance (lightest bg, darkest text) instead of first-match, preventing black-on-black rendering on dark-dominant sites.
- **Proof page was dark themed** — Changed proof.html to light background for readability.

### Changed

- Package renamed from `design-md-generator` to `design-md-gen` for shorter CLI command.
- README rewritten: leads with value proposition, adds version/license badges, documents all AI platform entry points.

## [0.0.2] - 2026-04-17

### Added

- **Test infrastructure** — Vitest with 50 tests covering color clustering, shadow classification, validation scoring, token merging, and shadow layer splitting.
- **Multi-page dark mode detection** — Tries all crawled pages instead of only homepage. Stops at first detection, records source URL.
- **SPA wait strategy** (`--wait-for`) — `networkidle` (default), `css` (polls until CSS variables stabilize), `selector:<css>` (waits for selector).
- **Incremental extraction** (`--merge-with`) — Merge into existing `tokens.json` via OKLCH delta-E color matching.
- **Preview generator** (`preview-gen.ts`) — Visual token preview from `tokens.json`.
- **Report generator** (`report-gen.ts`) — Quality report with validation score, color palette, typography preview, component summary.
- **Fidelity proof** (`proof.ts`) — Pixel-level color coverage against live site. Results: Stripe 99.9%, Vercel 98.6%, Linear 100%, Supabase 100%.
- **Standalone CLI** (`cli.ts`) — Entry point for `npx design-md-gen <url>`.

### Fixed

- **Shadow classification bug** — `classifyShadow()` split on commas inside `rgba()`, misclassifying all real-world shadows. Fixed with parenthesis-aware `splitShadowLayers()`.
- **Font name false positive** — `checkUnknownFonts()` flagged camelCase CSS properties as unknown fonts.
- **SKILL.md outdated references** — `--wait-for-css` updated to `--wait-for css`.

## [0.0.1] - 2026-04-05

### Added

- Initial release with 14-module TypeScript extraction pipeline.
- Playwright crawler with stealth mode, cookie banner dismissal, 5-viewport screenshots.
- OKLCH delta-E color clustering via culori.
- Typography, shadow, radius, and component token aggregation.
- Dark mode detection (media query, class toggle, data attribute, toggle button).
- Framework detection (Tailwind CSS, Radix UI, shadcn/ui, Material UI, Chakra UI).
- Output validation with phantom color detection, format checking, section completeness.
- SKILL.md for Claude Code (21-step workflow).
- 6 resource files (format spec, writing guide, quality checklist, color taxonomy, component taxonomy, anti-patterns).
- 4 gold standard examples (Stripe, Vercel, Linear, Supabase).
