# Design MD Generator

Generate publication-quality `DESIGN.md` files from any website URL. Reverse-engineers CSS, typography, colors, components, and layout into a structured design system reference that AI agents can consume to faithfully reproduce a site's visual style.

**Key differentiator:** Zero-hallucination architecture. Deterministic extraction produces ground-truth data; the AI writing layer can only reference values that actually exist on the site.

## Fidelity Proof

Every extraction is verifiable. The proof tool captures the original site, compares it against the extracted palette pixel-by-pixel using OKLCH perceptual color distance, and reports coverage:

| Site | Color Coverage | Palette Size |
|------|---------------|--------------|
| Stripe | 99.9% | 76 colors |
| Vercel | 98.6% | 41 colors |
| Linear | 100.0% | 40 colors |
| Supabase | 100.0% | 17 colors |

## How It Works

**Two-phase workflow:**

1. **Deterministic extraction** (TypeScript + Playwright) -- Crawls the site, collects every computed style, CSS variable, font, shadow, and interaction state. Statistical clustering via OKLCH delta-E reduces raw data into structured design tokens. Every value comes from the actual DOM.

2. **Semantic writing** (Claude Code skill) -- Reads the extracted `tokens.json` and screenshots, then generates a DESIGN.md with atmospheric descriptions, color role assignments, component documentation, do's/don'ts, and self-contained agent prompts. All numerical values are constrained to extraction data.

## Quick Start

```bash
# Install dependencies
npm install
npx playwright install chromium

# Extract design tokens from a website
npx ts-node scripts/extract.ts https://stripe.com

# Generate human-readable report
npx ts-node scripts/report-gen.ts output/stripe.com/tokens.json

# Run fidelity proof (compares extraction against live site)
npx ts-node scripts/proof.ts https://stripe.com output/stripe.com/tokens.json

# Validate a generated DESIGN.md against extraction data
npx ts-node scripts/validate.ts output/stripe.com/DESIGN.md output/stripe.com/tokens.json
```

## CLI Options

### Extraction

```
npx ts-node scripts/extract.ts <url1> [url2] ...

Options:
  --output <dir>         Output directory (default: output/<domain>/)
  --concurrency <n>      Playwright concurrency (default: 5)
  --max-pages <n>        Max pages to crawl (default: 20)
  --extra-urls <file>    File with additional URLs to crawl (one per line)
  --wait-for <strategy>  Page load wait strategy:
                           networkidle  Wait for network idle (default)
                           css          Poll until CSS variables stabilize (for SPA/CSS-in-JS)
                           selector:<s> Wait for a specific CSS selector to appear
  --merge-with <path>    Merge results into an existing tokens.json (incremental extraction)
  --no-dark-mode         Skip dark mode detection
  --no-interaction       Skip interaction state capture (faster extraction)
  --verbose              Detailed logging
```

### Post-Extraction Tools

```bash
# Visual token preview (colors, typography, shadows, components)
npx ts-node scripts/preview-gen.ts <tokens.json> [output-dir]

# Full report with quality score and validation (human-readable)
npx ts-node scripts/report-gen.ts <tokens.json> [output-dir] [DESIGN.md]

# Fidelity proof (pixel-level color coverage against live site)
npx ts-node scripts/proof.ts <url> <tokens.json> [output-dir]

# DESIGN.md validation (phantom colors, format, section completeness)
npx ts-node scripts/validate.ts <DESIGN.md> <tokens.json>
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Output

```
output/<domain>/
  tokens.json              Design tokens (main input for DESIGN.md generation)
  extraction-report.json   Extraction metadata, warnings, and diagnostics
  raw-data.json            Per-page element statistics
  preview.html             Visual token preview for human review
  report.html              Quality report with validation score
  proof.html               Fidelity proof with side-by-side comparison
  screenshots/
    homepage-1920.png      Full-page screenshots at 5 viewports
    homepage-1440.png
    homepage-768.png
    homepage-375.png
    homepage-320.png
    dark/                  Dark mode screenshots (if detected)
```

## What Gets Extracted

| Category | Details |
|----------|---------|
| Colors | All computed colors clustered via OKLCH delta-E, tagged by usage context (text, background, border, shadow, gradient, icon) |
| Typography | Font families, full size/weight/line-height hierarchy, letter-spacing, OpenType features, sample texts |
| Components | Buttons, cards, inputs, navigation, badges, heroes, footers -- with variant detection (primary, secondary, ghost, destructive) |
| Interactions | Hover, focus, focus-visible, active, disabled states for all interactive elements |
| Shadows | Classified as border-shadow, elevation, inset, ring, or complex-stack (parenthesis-aware parsing) |
| Radius | Border radius tokens with frequency and typical element mapping |
| Layout | Max content width, grid column counts, section spacing, content alignment pattern |
| Dark Mode | Multi-page detection via media query, class toggle, data attribute, or toggle button. CSS variable light/dark diff |
| Framework | Tailwind CSS, Radix UI, shadcn/ui, Material UI, Chakra UI detection |
| Icons | Library detection (Lucide, Heroicons, etc.), size scale, stroke width |
| Motion | Duration tiers, timing functions, keyframe animations |
| Accessibility | Focus indicators, contrast ratios, touch targets, minimum font sizes |

## Architecture

```
scripts/
  extract.ts               Main pipeline orchestrator and CLI
  cli.ts                   Standalone CLI entry point
  crawl.ts                 Playwright page crawler with SPA support
  dom-collector.ts         Computed style collection from every DOM element
  css-analyzer.ts          CSS parsing for media queries and keyframes
  cluster.ts               OKLCH color clustering, typography/shadow/radius aggregation
  dark-mode-detect.ts      Multi-page dark mode detection with fallback
  interaction-capture.ts   Hover/focus/active state capture
  framework-detect.ts      UI framework identification
  icon-detect.ts           Icon library detection
  motion-extract.ts        Animation and transition extraction
  a11y-extract.ts          Accessibility token extraction
  design-boundary-detect.ts  Multi-design-system detection
  validate.ts              Output quality validation (phantom colors, format, completeness)
  preview-gen.ts           Visual token preview generator
  report-gen.ts            Human-readable quality report generator
  proof.ts                 Fidelity proof (pixel-level color coverage)
  types.ts                 Shared type definitions

resources/
  design-md-format.md      9-section output format specification
  writing-style-guide.md   Publication-quality writing standards and banned words
  quality-checklist.md     40+ verification items across 5 categories
  color-role-taxonomy.md   19 semantic color roles with identification signals
  component-taxonomy.md    15+ component types with DOM signals and required properties
  anti-patterns.md         20 cataloged anti-patterns with detection methods

examples/
  stripe/                  Gold standard: Stripe (fintech, light theme, custom variable font)
  vercel/                  Gold standard: Vercel (monochrome, shadow-as-border, Geist)
  linear/                  Gold standard: Linear (dark theme, purple accent, dense UI)
  supabase/                Gold standard: Supabase (dark theme, green accent, developer tool)
```

## Using as a Claude Code Skill

This project includes `SKILL.md` which works as a Claude Code skill. When invoked:

1. Runs the extraction pipeline on the target URL
2. Analyzes the resulting tokens.json and screenshots
3. Generates a publication-quality DESIGN.md following the 9-section format spec
4. Validates the output against extraction data (target score: 95+)
5. Generates preview.html for visual verification

Install: `/install-skill https://github.com/jasonhnd/design-md-generator`

## vs. awesome-design-md

[awesome-design-md](https://github.com/VoltAgent/awesome-design-md) provides pre-made DESIGN.md templates for 66 known brands. This project generates custom DESIGN.md files from any URL. They are complementary:

| | awesome-design-md | design-md-generator |
|---|---|---|
| Approach | Curated templates | Automated extraction |
| Coverage | 66 fixed brands | Any URL |
| Accuracy | Human-written (no ground truth) | Zero-hallucination (every value from DOM) |
| Verifiable | No | Yes (proof.html with pixel-level coverage) |

## Disclaimer

Generated DESIGN.md files are extracted from publicly accessible CSS values and are not official design system documentation. Colors, fonts, and spacing may not be 100% accurate. Commercial fonts detected during extraction require separate licensing.

## License

MIT
