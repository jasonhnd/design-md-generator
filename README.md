# Design MD Generator

[![Version](https://img.shields.io/badge/version-0.0.3-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-50%20passed-brightgreen.svg)]()
[![Stitch Compatible](https://img.shields.io/badge/Google%20Stitch-compatible-orange.svg)]()

Extract design systems from any website. Drop a `DESIGN.md` into your project, tell your AI agent "build me a page that looks like this," and get UI that actually matches.

**Works with:** Claude Code · Cursor · GitHub Copilot · OpenAI Codex · Gemini CLI · Windsurf · Google Stitch

## Why This Exists

AI agents hallucinate design values. They invent colors, guess font sizes, and approximate shadows. This tool extracts the real values from the live site — every hex code, every font weight, every shadow — and puts them in a format any AI agent can read.

Every value is verified: pixel-level fidelity proofs compare the extracted palette against the original site.

| Site | Color Coverage | Palette Size |
|------|---------------|--------------|
| Stripe | 99.9% | 76 colors |
| Vercel | 98.6% | 41 colors |
| Linear | 100.0% | 40 colors |
| Supabase | 100.0% | 17 colors |
| Notion | 100.0% | 27 colors |

## Quick Start

### Use with Any AI Agent

Clone this repo into your project. Your AI agent will automatically read the instructions file for its platform:

```bash
# The repo includes entry points for every major AI agent:
#   CLAUDE.md      → Claude Code
#   .cursorrules   → Cursor
#   AGENTS.md      → OpenAI Codex CLI
#   GEMINI.md      → Gemini CLI
#   .windsurfrules → Windsurf
#   .github/copilot-instructions.md → GitHub Copilot
```

### Install as Claude Code Skill

```bash
/install-skill https://github.com/jasonhnd/design-md-generator
```

### Extract Design Tokens

```bash
npm install
npx playwright install chromium

# Extract from any URL
npx ts-node scripts/extract.ts https://stripe.com

# Generate report (includes fidelity proof if available)
npx ts-node scripts/report-gen.ts output/stripe.com/tokens.json output/stripe.com/ DESIGN.md
```

## How It Works

**Phase 1 — Deterministic Extraction** (TypeScript + Playwright)

Crawls the site, collects every computed style, CSS variable, font, shadow, and interaction state. OKLCH delta-E clustering reduces raw color data into perceptually distinct tokens. Multi-page dark mode detection. SPA/CSS-in-JS support via `--wait-for css`. Every value comes from the actual DOM.

**Phase 2 — Semantic Writing** (AI Agent)

Reads the extracted `tokens.json` and generates a DESIGN.md following the [Google Stitch 9-section format](https://stitch.withgoogle.com/docs/design-md/format/). Atmospheric descriptions, color role assignments, component documentation, do's/don'ts, and self-contained agent prompts. All numerical values constrained to extraction data — zero hallucination.

**Phase 3 — Verification**

Pixel-level fidelity proof captures the live site, excludes image/media regions, and measures OKLCH color distance against the extracted palette. Quality validation checks for phantom colors, format consistency, and section completeness.

## CLI Options

```
npx ts-node scripts/extract.ts <url> [options]

  --output <dir>         Output directory (default: output/<domain>/)
  --concurrency <n>      Playwright concurrency (default: 5)
  --max-pages <n>        Max pages to crawl (default: 20)
  --extra-urls <file>    Additional URLs to crawl (one per line)
  --wait-for <strategy>  Wait strategy: networkidle | css | selector:<css>
  --merge-with <path>    Merge into existing tokens.json (incremental)
  --no-dark-mode         Skip dark mode detection
  --no-interaction       Skip interaction states (faster)
  --verbose              Detailed logging
```

### Post-Extraction

```bash
npx ts-node scripts/preview-gen.ts <tokens.json> [output-dir]    # Visual preview
npx ts-node scripts/report-gen.ts <tokens.json> [dir] [DESIGN.md] # Full report
npx ts-node scripts/proof.ts <url> <tokens.json> [output-dir]     # Fidelity proof
npx ts-node scripts/validate.ts <DESIGN.md> <tokens.json>         # Validation
npm test                                                           # 50 tests
```

## Output

```
output/<domain>/
  tokens.json              Design tokens (input for DESIGN.md generation)
  report.html              Quality report + fidelity proof + DESIGN.md viewer
  preview.html             Visual token preview
  extraction-report.json   Metadata and diagnostics
  screenshots/             5-viewport screenshots + dark mode
```

## What Gets Extracted

| Category | Details |
|----------|---------|
| Colors | OKLCH delta-E clustered, tagged by usage (text/bg/border/shadow/gradient/icon) |
| Typography | Full hierarchy with letter-spacing, OpenType features, sample texts |
| Components | Buttons, cards, inputs, nav, badges, heroes — with variant detection |
| Interactions | Hover, focus, focus-visible, active, disabled states |
| Shadows | Parenthesis-aware classification (elevation/border-shadow/inset/ring/complex) |
| Dark Mode | Multi-page detection, CSS variable light/dark diff |
| Layout | Content width, grid columns, spacing scale, alignment |
| Framework | Tailwind, Radix, shadcn, Material, Chakra detection |
| Motion | Duration tiers, timing functions, keyframe animations |
| Accessibility | Focus indicators, contrast ratios, touch targets |

## Architecture

```
scripts/           18 TypeScript modules — extraction pipeline
resources/         6 reference docs — format spec, style guide, checklists
examples/          Gold standard outputs (Stripe, Vercel, Linear, Supabase)
SKILL.md           Full 21-step specification (40KB)
AGENTS.md          Codex CLI entry point
CLAUDE.md          Claude Code entry point
GEMINI.md          Gemini CLI entry point
.cursorrules       Cursor entry point
.windsurfrules     Windsurf entry point
.github/copilot-instructions.md   Copilot entry point
```

## vs. Curated Template Libraries

| | Curated Templates | This Tool |
|---|---|---|
| Coverage | ~70 fixed brands | Any URL |
| Accuracy | Human-written, no ground truth | Pixel-verified (ΔE<12) |
| Non-English sites | No | Yes (Japanese, Chinese, Korean...) |
| Your own product | Not possible | Any URL you own |
| Freshness | Snapshot (may be stale) | Live extraction |
| Interaction states | No | Hover, focus, active, disabled |
| Dark mode | Manual | Auto-detected + CSS variable diff |

## Disclaimer

Generated DESIGN.md files are extracted from publicly accessible CSS values and are not official design system documentation. Colors, fonts, and spacing may not be 100% accurate. Commercial fonts require separate licensing.

## License

MIT
