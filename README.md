# Design MD Generator

![License](https://img.shields.io/badge/License-Apache%202.0-blue) ![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-green) ![skills.sh](https://img.shields.io/badge/skills.sh-Compatible-yellow) ![version](https://img.shields.io/badge/version-1.1.0-purple)

Generate publication-quality `DESIGN.md` files from any website URL. Analyzes CSS, typography, colors, components, and layout to produce a complete design system reference that AI agents can use to reproduce a website's visual style.

## How It Works

**Two-phase workflow:**

1. **Deterministic extraction** (scripts) -- Playwright crawls the site, collects every computed style, CSS variable, font, shadow, and interaction state. Statistical clustering reduces raw data into structured design tokens. Zero hallucination -- every value comes from the actual DOM.

2. **Semantic writing** (Claude Code) -- Reads the extracted `tokens.json` and screenshots, then generates a DESIGN.md with atmospheric descriptions, color role assignments, component documentation, do's/don'ts, and self-contained agent prompts. Values are constrained to extraction data only.

## Quick Start

```bash
# Install dependencies
npm install
npx playwright install chromium

# Extract design tokens from a website
npx ts-node scripts/extract.ts https://vercel.com

# Validate a generated DESIGN.md
npx ts-node scripts/validate.ts output/vercel.com/DESIGN.md output/vercel.com/tokens.json
```

## CLI Options

```
npx ts-node scripts/extract.ts <url1> [url2] ...
  --output <dir>         Output directory (default: output/<domain>/)
  --concurrency <n>      Playwright concurrency (default: 5)
  --max-pages <n>        Max pages to crawl (default: 20)
  --extra-urls <file>    File with additional URLs (one per line)
  --no-dark-mode         Skip dark mode detection
  --no-interaction       Skip interaction state capture (faster)
  --verbose              Detailed logging
```

## Output

```
output/<domain>/
  tokens.json              # Structured design tokens (main input for DESIGN.md generation)
  extraction-report.json   # Extraction metadata and diagnostics
  raw-data.json            # Summary statistics
  screenshots/
    homepage-1920.png      # Full-page screenshots at 5 viewports
    homepage-1440.png
    homepage-768.png
    homepage-375.png
    homepage-320.png
    dark/                  # Dark mode screenshots (if supported)
```

## What Gets Extracted

| Category | Details |
|----------|---------|
| Colors | All computed colors clustered via OKLCH delta-E, tagged by usage (text/bg/border/shadow/gradient/icon) |
| Typography | Font families, size/weight/line-height levels, letter-spacing, OpenType features |
| Components | Buttons, cards, inputs, navigation, badges, heroes, footers with variant detection |
| Interactions | Hover, focus, focus-visible, active, disabled states for all interactive elements |
| Shadows | Classified as border-shadow, elevation, inset, ring, or complex-stack |
| Layout | Max content width, grid columns, section spacing, content alignment |
| Dark Mode | Detection via media query, class toggle, data attribute, or toggle button |
| Framework | Tailwind CSS, Radix UI, shadcn/ui, Material UI, Chakra UI, and more |
| Icons | Library detection (Lucide, Heroicons, etc.), size scale, stroke width |
| Motion | Duration tiers, timing functions, keyframe animations |
| Accessibility | Focus indicators, contrast ratios, touch targets, minimum font sizes |

## Using as a Claude Code Skill

This project includes `SKILL.md` which can be used as a Claude Code skill. When invoked, Claude Code will:

1. Run the extraction script on the target URL
2. Analyze the resulting tokens and screenshots
3. Generate a publication-quality DESIGN.md following the format specification
4. Validate the output against the extraction data
5. Generate a preview.html for visual verification

## Examples

The `examples/` directory contains gold standard outputs:

| Site | Style | Key Features |
|------|-------|-------------|
| Vercel | Minimal monochrome | Shadow-as-border, Geist font, 3-color workflow accents |
| Linear | Dark-mode tool | Purple accent, luminance stacking, info-dense UI |

## Project Structure

```
scripts/         # TypeScript extraction pipeline (14 modules)
resources/       # Format specs, writing guides, quality checklists
examples/        # Gold standard input/output pairs
output/          # Runtime extraction results (gitignored)
SKILL.md         # Claude Code skill instructions
```

## Acknowledgements

The core conceptual workflow, semantic token format, and foundational methodology of this tool were inspired by and derived from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Special thanks to the VoltAgent team for their pioneering research in AI-friendly design system documentation.

## Disclaimer

Generated DESIGN.md files are extracted from publicly accessible CSS values and are not official design system documentation. Colors, fonts, and spacing may not be 100% accurate. Commercial fonts detected during extraction require separate licensing.

## License

Apache 2.0
