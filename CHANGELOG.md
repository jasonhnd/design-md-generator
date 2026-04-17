# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2] - 2026-04-17

### Added

- **Test infrastructure** -- Vitest setup with 50 tests covering color clustering, shadow classification, validation scoring, token merging, and shadow layer splitting.
- **Multi-page dark mode detection** -- Extraction now tries all crawled pages for dark mode instead of only the homepage. Stops at the first page where dark mode is found and records the detection source URL.
- **SPA wait strategy** (`--wait-for`) -- Three modes for page load detection:
  - `networkidle` (default, existing behavior)
  - `css` -- Polls until CSS variables and stylesheets stabilize (for CSS-in-JS / SPA hydration)
  - `selector:<css>` -- Waits for a specific CSS selector to appear
- **Incremental extraction** (`--merge-with`) -- Merge new extraction results into an existing `tokens.json`. Colors are matched via OKLCH delta-E < 3; typography, shadows, and radius tokens merge by exact key match. Frequencies are combined.
- **Preview generator** (`preview-gen.ts`) -- Generates `preview.html` from `tokens.json` showing color swatches, typography scale, button/input/card components, and shadow system. All values sourced exclusively from extracted tokens.
- **Report generator** (`report-gen.ts`) -- Generates `report.html` with quality score ring, validation details (pass/fail/warn), color palette with usage roles, typography preview, shadow and radius visualization, component summary table, dark mode variable diff, and embedded DESIGN.md content.
- **Fidelity proof** (`proof.ts`) -- Captures the live original site via Playwright, samples 2,000 pixels, computes OKLCH delta-E against the extracted palette, and generates `proof.html` with coverage percentage, side-by-side comparison, and unmatched color groups. Verified results: Stripe 99.9%, Vercel 98.6%, Linear 100%, Supabase 100%.
- **Standalone CLI** (`cli.ts`) -- Entry point for `npx design-md-gen <url>`. Runs the extraction pipeline and prints next-step instructions.
- **Google Fonts injection** in report.html when `googleFontsLinks` are present in tokens. Proprietary fonts noted with fallback comment.
- **Dark mode section** in report.html showing detection method, source URL, and CSS variable light/dark comparison table.

### Fixed

- **Shadow classification bug** -- `classifyShadow()` incorrectly split on commas inside `rgba()`/`hsla()`, causing virtually all real-world shadows to be classified as `complex-stack`. Replaced naive `split(',')` with parenthesis-aware `splitShadowLayers()`. This was a critical production data bug affecting every extraction.
- **Font name false positive** -- `checkUnknownFonts()` in validate.ts flagged camelCase CSS property names (e.g. `borderColor`, `backgroundColor`) as unknown fonts. Added exclusion filter for camelCase identifiers.
- **SKILL.md outdated references** -- Updated `--wait-for-css` (removed) to `--wait-for css` (current syntax) in troubleshooting tables.

### Changed

- Exported pure utility functions from `cluster.ts` for testability: `parseColor`, `parsePxValue`, `rgbaToHex`, `wcagContrast`, `deltaE`, `classifyShadow`, `splitShadowLayers`, `mergeTokenSets`.
- Updated README with complete CLI documentation, architecture overview, fidelity proof results, and comparison with awesome-design-md.
- Regenerated `preview.html`, `report.html`, and `proof.html` for all four example sites (Stripe, Vercel, Linear, Supabase).

## [0.0.1] - 2026-04-05

### Added

- Initial release with 14-module TypeScript extraction pipeline.
- Playwright-based crawler with stealth mode, cookie banner dismissal, and 5-viewport screenshots.
- OKLCH delta-E color clustering via culori library.
- Typography, shadow, radius, and component token aggregation.
- Dark mode detection (media query, class toggle, data attribute, toggle button).
- Framework detection (Tailwind CSS, Radix UI, shadcn/ui, Material UI, Chakra UI).
- Icon library detection, motion extraction, accessibility token extraction.
- Design boundary detection for multi-design-system sites.
- Output validation with phantom color detection, format checking, and section completeness.
- SKILL.md for Claude Code integration (21-step generation workflow).
- 6 resource files: format spec, writing style guide, quality checklist, color role taxonomy, component taxonomy, anti-pattern catalog.
- 4 gold standard examples: Stripe, Vercel, Linear, Supabase.
