---
name: design-md-generator
description: >
  Generate publication-quality DESIGN.md files from any website URL. Analyzes CSS, typography,
  colors, components, and layout to produce a complete design system reference that AI agents
  can use to reproduce the website's visual style. Use when the user wants to extract design
  tokens, generate DESIGN.md, analyze a website's design system, or reverse-engineer UI styles.
---

# Design MD Generator

## Overview

This skill generates a publication-quality DESIGN.md from a live website URL. The process has two distinct phases with a hard boundary between them:

**Phase 1 -- Deterministic Extraction (scripts)**
Node.js scripts crawl the site, extract computed styles, capture screenshots, and produce a structured `tokens.json` file. This phase is mechanical. Every value it produces is ground truth.

**Phase 2 -- Semantic Writing (Claude Code)**
You read the extraction data and screenshots, then write the DESIGN.md. Your job is semantic interpretation: assigning roles to colors, naming typography levels, describing atmosphere, writing do's/don'ts, and composing self-contained agent prompts.

**The cardinal rule:** ALL numerical values in the final DESIGN.md -- every hex code, every pixel value, every font-weight number, every shadow string, every border-radius -- MUST be copied verbatim from `tokens.json` or extraction output. You never estimate, round, normalize, or invent values. If a value is not in the extraction data, it does not appear in the DESIGN.md. This is the single most important constraint. Violating it produces phantom values (anti-pattern AP-01) that make the entire document unreliable.

**What you DO contribute:**
- Semantic role assignment (which color is "primary," which is "accent")
- Atmospheric descriptions (what the design feels like, its personality)
- Descriptive color names ("Ship Red" instead of "Red 1")
- Typography role mapping (which extracted size is "Display Hero" vs "Body")
- Do's and don'ts derived from observed patterns
- Self-contained agent prompts with all values inlined
- Structural observations (shadow-as-border philosophy, compression-as-identity)

**What you NEVER invent:**
- Hex values, px values, rem values, font-weight numbers
- Shadow strings, gradient definitions, border-radius values
- Breakpoint widths, spacing scale entries, transition durations
- Font family names, OpenType feature tags

---

## Prerequisites

- Node.js >= 18
- Project located at the `dmdg/` directory (this repo)
- Playwright with Chromium browser

**Auto-install if dependencies are missing:**

```bash
cd /path/to/dmdg && npm install && npx playwright install chromium
```

Verify readiness:

```bash
cd /path/to/dmdg && npx ts-node scripts/extract.ts --help
```

If `ts-node` is not found, install it: `npm install -D ts-node typescript`.

---

## Execution Mode

**FULL AUTO.** When this skill is invoked, execute Steps 1-21 without stopping for user confirmation. The only reasons to pause are:

1. Extraction fails after 2 retries → inform user with error
2. CAPTCHA detected → inform user to complete manually
3. Fatal error with no recovery path

Do NOT ask "should I proceed?" between steps. Do NOT present intermediate results. Run the entire pipeline and present the final output at the end.

---

## Step 1: Run Extraction

**Command:**

```bash
cd /path/to/dmdg && npx ts-node scripts/extract.ts <URL> --output output/<domain>/
```

Replace `<URL>` with the target website (e.g., `https://vercel.com`) and `<domain>` with the domain name (e.g., `vercel`).

**Expected time:** 30-60 seconds for a typical site. Sites with many pages or heavy JavaScript may take longer.

**Success criteria -- verify ALL of these before proceeding:**

1. `output/<domain>/tokens.json` exists and is non-empty
2. At least 3 screenshot files exist in `output/<domain>/screenshots/`
3. `output/<domain>/extraction-report.json` exists
4. The extraction report has no `fatal` errors (warnings are acceptable)

**Read the extraction report:**

```bash
cat output/<domain>/extraction-report.json
```

Check the `status` field. If `status` is `"success"` or `"partial"`, proceed. If `"failed"`, check `errors` for the cause.

**Failure handling:**

| Failure | Symptom | Fix |
|---------|---------|-----|
| Anti-bot protection | 403/429 status, empty page | Re-run with `--delay 5000 --stealth` flags if available; if not, wait 30 seconds and retry |
| Timeout | Script hangs or reports timeout | Re-run with `--timeout 60000` |
| CAPTCHA | Screenshot shows CAPTCHA challenge | Inform the user: "The site requires CAPTCHA verification. Please complete it manually, then I can retry extraction." |
| No CSS found | tokens.json has empty color/typography sections | The site may load styles dynamically; try adding `--wait-for css` |
| SSL error | Certificate validation failure | Try with `--ignore-ssl-errors` if the site is known-safe |

If the extraction fails after two retries, inform the user with the specific error and suggest alternative approaches (providing a URL to a different page, or manual CSS inspection).

---

## Step 2: Design System Boundary Check

Read the extraction report's `designBoundary` field:

```bash
cat output/<domain>/extraction-report.json | grep -i boundary
```

The boundary determines output structure:

| Boundary Value | Meaning | Output Structure |
|----------------|---------|------------------|
| `unified` | Single coherent design system across all pages | One `DESIGN.md` file |
| `shared-foundation` | Common base tokens with product-specific overrides | Base `DESIGN.md` + per-product `DESIGN-<product>.md` files |
| `independent` | Distinct design systems on different sections | Separate `DESIGN.md` files per section |

**For `shared-foundation` or `independent`:**
Present the detected boundary to the user along with any anomalies listed in the report. Ask for confirmation before proceeding:

> "The extraction detected [boundary type]. The following sections appear to use different design tokens: [list]. Should I proceed with [recommended structure], or would you prefer a single unified file?"

Wait for user confirmation before continuing.

**For `unified`:** Proceed directly to Step 3.

---

## Step 3: Analyze Extracted Data

Read `tokens.json` and build a mental model of the design system:

```bash
cat output/<domain>/tokens.json
```

Report these metrics to the user:

1. **Color count**: Total distinct colors. Expect 15-50 for a well-designed system. Fewer than 8 suggests incomplete extraction. More than 80 suggests the extraction captured too many one-off values.
2. **Typography levels**: Count of distinct font-size/weight/line-height combinations. Expect 12-20.
3. **Component types**: List detected component categories (buttons, cards, inputs, navigation, badges, etc.).
4. **Framework detection**: What CSS framework was detected (Tailwind, Bootstrap, none, etc.).
5. **Dark mode status**: Whether dark mode tokens were extracted.
6. **Font families**: List all detected font families.

**If data seems insufficient** (fewer than 8 colors, fewer than 6 typography levels, or zero components):

> "The extraction captured limited data. This may produce a sparse DESIGN.md. Would you like me to add additional URLs for deeper extraction? For example, a pricing page, documentation page, or dashboard page often reveals more components."

If the user provides additional URLs, re-run extraction with the `--urls` flag or run sequential extractions and merge the output.

---

## Step 4: Review Screenshots

View ALL screenshots in this order:

1. Homepage -- desktop viewport
2. 2-3 additional pages -- desktop viewport
3. Homepage -- mobile viewport
4. Dark mode screenshots (if they exist)

For each screenshot, observe and mentally note:

- **Overall atmosphere**: What is the first impression? What emotion does the color/space balance create?
- **Color presence**: Which colors dominate? Which appear only as accents? Is the palette warm or cool?
- **Typography feel**: Are headlines heavy or light? Is text dense or airy? What is the tracking personality?
- **Whitespace**: Is spacing generous or tight? Is section separation done through space, color, or borders?
- **Component consistency**: Do buttons/cards/badges share a visual language? Are there outliers?
- **Special effects**: Gradients, shadows, glassmorphism, overlapping elements, decorative illustrations?

This step is critical for writing the atmosphere section. The screenshots shape your subjective interpretation. The tokens.json provides the values; the screenshots provide the feeling. You need both.

---

## Step 5: Generate Section 1 -- Visual Theme & Atmosphere

**Before writing, re-read ALL screenshots one more time.** This section is where writing quality matters most.

### Opening Sentence

Write ONE sentence that captures the design system's essence. This sentence must:

1. Be unique to this specific site -- swapping it onto a different site must feel wrong
2. Use a metaphor or precise framing, not parameter listing
3. Allow a reader who has never seen the site to form a correct mental image

**Structure pattern:** `[Subject]'s website is [unique framing] -- [elaboration with tension or contradiction]`

**Test:** Ask yourself "Could this sentence describe three other websites?" If yes, rewrite.

**Banned words** (never use in any descriptive prose throughout the entire document):
`clean`, `modern`, `sleek`, `professional`, `user-friendly`, `intuitive`, `elegant`, `beautiful`, `stunning`, `gorgeous`, `polished`, `refined`, `sophisticated`, `seamless`, `cutting-edge`, `state-of-the-art`, `next-generation`, `innovative`, `revolutionary`, `world-class`, `premium` (as vague adjective), `crisp`, `delightful`, `lovely`, `nice`, `simple` (without specifics).

The replacement rule: every banned word is a placeholder for a specific observation you have not yet made. Find the observation.

### Paragraphs 2-4: Layered Expansion

Each paragraph zooms into a different layer. Each MUST include at least two concrete values from tokens.json as inline evidence.

- **P2 -- Macro (Color and Space):** What does the overall canvas feel like? What is the dominant color relationship? Reference specific hex values for the primary background, text color, and brand/accent color.
- **P3 -- Meso (Typography Character):** What font defines the system? What makes its usage distinctive? Reference the font name, a specific weight, a specific size, and letter-spacing values.
- **P4 -- Micro (Unique Technique):** What single technical decision makes this system different from its peers? Name the technique, provide the exact CSS value, and explain the architectural reason.

**Word count target:** 150-250 words for prose (excluding Key Characteristics list).

### Key Characteristics List

Write 8-12 bullet items using the em-dash format:

```
- [Design intent / what it achieves] -- [implementation parameters / how to do it with `css-value`]
```

Every item must have:
- A front half that describes the WHY (design intent, what it achieves visually)
- A back half that describes the WHAT (specific CSS values, font names, pixel measurements)
- At least one value in backticks

**Reference anti-patterns:** AP-02 (generic description), AP-13 (characteristics without values).

---

## Step 6: Generate Section 2 -- Color Palette & Roles

### Read the Color Role Taxonomy

Before assigning any roles, review the role definitions in `resources/color-role-taxonomy.md`. Follow the Role Assignment Priority order:

1. CSS variable name (strongest signal)
2. Framework convention
3. Usage frequency + context
4. Visual position on page
5. Color hue alone (weakest -- never use alone)

### Group Colors by Semantic Role

Organize extracted colors into `###` subsections based on their semantic role, NOT by hue. Common groupings:

- `### Primary`
- `### Accent Colors` or `### Workflow Colors`
- `### Interactive`
- `### Neutral Scale`
- `### Surface & Borders`
- `### Shadow Colors`
- `### Console / Code Colors` (if syntax highlighting colors exist)

Follow the recommended grouping order from the color role taxonomy.

### Write Color Entries

Format for each color:

```
- **Descriptive Name** (`#hexval`): Role description. Personality or usage note.
```

Rules:
- **Name descriptively**, not generically. Use brand-specific names or role-based names. Write "Ship Red" or "Action Default," never "Blue 1" or "Gray Light."
- **Hex values are always 6-digit lowercase.** Copy-paste from `tokens.json` `colorTokens`. Never round, adjust, or normalize.
- **Include CSS variable names** in backticks after the hex if the extraction captured them: `` `--hds-color-heading-solid` ``.
- **Each entry needs three components:** Identity (name + hex), Role (where it appears), Personality (one sentence about the visual quality or brand significance).
- **RGBA/HSLA values are acceptable** for shadows and semi-transparent colors.

### Minimum Requirements

- At least 8 colors documented across all groups
- Every color hex MUST exist in `tokens.json` `colorTokens` -- cross-reference before finalizing

### Dark Mode Overrides

If `tokens.json` contains dark mode data (check for `darkMode` or `darkTokens` fields):
- Add a `### Dark Mode Overrides` subsection
- Show changed tokens with their dark mode values
- Only document colors that CHANGE -- do not repeat colors that remain the same

**Reference anti-patterns:** AP-01 (phantom color), AP-03 (semantic misattribution), AP-11 (dark mode omission), AP-12 (vague names), AP-14 (terminology drift).

---

## Step 7: Generate Section 3 -- Typography Rules

### Font Family Subsection

List all detected font families with their full fallback stacks from `tokens.json`:

```
- **Primary**: `FontName`, with fallbacks: `fallback1, fallback2, fallback3`
- **Monospace**: `MonoFont`, with fallbacks: `fallback1, fallback2`
- **OpenType Features**: `"liga"` enabled globally; `"tnum"` for tabular numbers.
```

Note any OpenType features detected in the extraction.

### Hierarchy Table

Build a markdown table with these exact columns:

```
| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
```

Add a `Features` column between `Letter Spacing` and `Notes` if the site uses OpenType feature sets.

**Column rules:**
- **Role**: Title Case descriptive name. Map each extracted typography level to a semantic role: Display Hero, Section Heading, Sub-heading, Card Title, Body Large, Body, Body Small, Button, Caption, Code Body, Code Caption, Micro Badge, etc.
- **Font**: Family name only, no fallbacks.
- **Size**: `{px}px ({rem}rem)` format. Calculate rem as px/16, two decimal places.
- **Weight**: Numeric only. Never `bold`, `semibold`, `light`. Use `300`, `400`, `500`, `600`, `700`.
- **Line Height**: Unitless ratio (e.g., `1.50`). Add descriptor for extremes: `1.00 (tight)`, `1.80 (relaxed)`.
- **Letter Spacing**: Value in px or `normal`.
- **Notes**: Brief usage note. Mention `text-transform: uppercase` when applicable.

**Row count target:** 12-20 rows. Map ALL distinct typography levels from `tokens.json` `typographyLevels`.

### Principles Subsection

Write 3-5 bullet points explaining the typographic philosophy. Each principle has a **bold label** followed by a colon and explanation. Reference specific values from the typography data.

Look for:
- What is the weight strategy? (narrow range like 300-400-500, or broad range?)
- What is the tracking strategy? (progressive negative tracking at large sizes?)
- Are there OpenType features used systematically?
- What creates hierarchy -- weight, size, tracking, or a combination?
- Is there a monospace voice and what role does it play?

**Reference anti-patterns:** AP-06 (format inconsistency), AP-07 (missing monospace/code font).

---

## Step 8: Generate Section 4 -- Component Stylings

### Identify Component Groups

Read `tokens.json` `components` section. Create `###` subsections for each component type present. Common groups:

- `### Buttons`
- `### Cards & Containers`
- `### Badges / Tags / Pills`
- `### Inputs & Forms`
- `### Navigation`
- `### Image Treatment`
- `### Distinctive Components` (for site-specific components not in standard taxonomy)

### Document Each Component Variant

For each variant, use a `**Bold Variant Name**` heading followed by a property list:

```
**Primary Dark**
- Background: `#171717`
- Text: `#ffffff`
- Padding: 8px 16px (vertical horizontal)
- Radius: 6px
- Font: 16px FontName weight 400, `"ss01"`
- Shadow: `rgba(0,0,0,0.08) 0px 0px 0px 1px`
- Hover: background shifts to `#4434d4`
- Focus: `2px solid var(--ds-focus-color)` outline
- Transition: `background-color 150ms ease`
- Use: Primary CTA ("Start Deploying", "Get Started")
```

Rules:
- All CSS values in backticks
- Include states: Hover, Focus, Active, Disabled -- whichever were observed in the extraction data
- Include transition values if extracted
- The `Use:` line describes where the component appears on the actual site
- Group related variants under the same `###` subsection

### Look for Distinctive Components

Scan the screenshots for components unique to this site that do not fit standard categories: workflow pipelines, metric cards, trust bars/logo grids, command palettes, pricing tables, comparison grids, etc. Document these under `### Distinctive Components`.

**Reference anti-patterns:** AP-04 (missing interaction states), AP-17 (wrong component classification).

---

## Step 9: Generate Section 5 -- Layout Principles

### Spacing System

From `tokens.json` `layoutPatterns` or `spacingScale`:
- State the base unit (typically 4px or 8px)
- List the full spacing scale as a comma-separated series
- Note any notable gaps or patterns in the scale

### Grid & Container

- Max content width from extraction data
- Hero layout pattern (centered single-column, split, etc.)
- Feature section column counts (2-column, 3-column, etc.)
- Notable full-width vs contained patterns

### Whitespace Philosophy

Write 2-3 **bold-labeled** bullet points describing the site's spatial character. Each MUST reference specific pixel values from the extraction data:

```
- **Gallery emptiness**: Massive vertical padding between sections (80px-120px+). The white space IS the design.
```

### Border Radius Scale

List radius tokens from smallest to largest, extracted from `tokens.json`:

```
- Micro (2px): Inline code snippets
- Standard (6px): Buttons, functional elements
- Full Pill (9999px): Badges, status pills
```

**Reference anti-patterns:** AP-19 (layout without numbers).

---

## Step 10: Generate Section 6 -- Depth & Elevation

### Shadow Scale Table

Build a table from `tokens.json` `shadowTokens`:

```
| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | Page background, text blocks |
| Ring (Level 1) | `rgba(0,0,0,0.08) 0px 0px 0px 1px` | Shadow-as-border for most elements |
```

Include 4-6 levels from flat to highest elevation.

**Classify each shadow correctly:**
- Zero-blur, zero-offset shadows (e.g., `0 0 0 1px`) are BORDER shadows, not elevation shadows. Classify them as "Ring" or "Border" level, not as elevation.
- Only shadows with non-zero blur or offset belong in elevation levels.

### Shadow Philosophy Paragraph

Write 50-100 words describing the system's approach to depth. This paragraph must:

1. Name the principle (chromatic depth, shadow-as-border, luminance stepping, flat, etc.)
2. Contrast with the conventional approach
3. Explain the architectural benefit
4. Provide 1-2 specific RGBA values as evidence

### Decorative Depth (optional subsection)

If the site uses gradients, section borders, background color shifts, or other non-shadow depth techniques, document them here.

**Reference anti-patterns:** AP-10 (shadow-border confusion).

---

## Step 11: Generate Section 6.5 -- Motion & Transitions (Optional)

**Include this section ONLY if** `tokens.json` contains a non-null `motionSystem` field with actual motion data.

**If no motion data exists, skip this section entirely.** Do not generate placeholder content.

When present, include:

### Duration Scale
Table of timing tokens:
```
| Name | Duration | Use |
|------|----------|-----|
| Fast | 150ms | Hover state changes |
| Normal | 300ms | Panel reveals, tabs |
```

### Timing Functions
Document easing curves with CSS values:
```
- **Primary easing**: `cubic-bezier(0.16, 1, 0.3, 1)` -- aggressive ease-out for snappy interactions
```

### Keyframe Animations
Named animations with descriptions, only if observed in the extraction data.

---

## Step 12: Generate Section 7 -- Do's and Don'ts

This section is where most DESIGN.md files fail. Apply extreme rigor.

### Do's (8-12 items)

Each item format:
```
- Action to take -- why it matters, with specific `css-value` or token reference
```

**Quality test for each Do:** Does this give a reader an implementation shortcut? After reading it, can they write correct CSS faster? If the Do is something any competent developer would do anyway (e.g., "Use consistent spacing"), it fails. Replace with a specific instruction that includes actual values.

### Don'ts (8-12 items)

Same format. Each Don't MUST have three components:
1. What not to do (the specific action to avoid)
2. Why it is wrong IN THIS SYSTEM (not in general)
3. What to do instead (with at least one specific value)

**Quality test for each Don't:** Would this surprise a competent developer who knows CSS but does not know this specific system? If a Don't is obvious (e.g., "Don't use too many colors"), it fails. Good Don'ts are counter-intuitive: they warn about things someone would naturally do that are WRONG in this particular system.

Examples of counter-intuitive Don'ts:
- "Don't use weight 600-700 for headlines -- weight 300 is the brand voice" (surprises because most systems use heavy headline weights)
- "Don't use traditional CSS border on cards -- use the shadow-border technique" (surprises because borders are the default approach)
- "Don't skip the inner `#fafafa` ring in card shadows -- it's the glow that makes the system work" (surprises because the inner ring seems decorative)

**Reference anti-patterns:** AP-08 (meaningless don'ts), AP-15 (do's without specifics).

---

## Step 13: Generate Section 8 -- Responsive Behavior

### Breakpoints Table

From `tokens.json` `breakpoints`:

```
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single column, reduced heading sizes |
| Tablet | 640-1024px | 2-column grids begin |
| Desktop | 1024-1280px | Full layout |
| Large Desktop | >1280px | Centered with generous margins |
```

4-7 rows covering mobile through large desktop. Use ranges or inequalities for the Width column.

### Touch Targets

3-5 bullet points on mobile interaction sizing:
- Button padding values at mobile
- Link spacing and tap target sizing
- Minimum interactive element dimensions

### Collapsing Strategy

6-10 bullet points describing how specific components adapt. Use the arrow format:

```
- Hero headline: 48px display -> 32px on mobile, tracking proportionally relaxed
- Feature cards: 3-column -> 2-column -> single column stacked
```

### Image Behavior

3-5 bullet points on responsive image handling:
- Border treatment at small sizes
- Aspect ratio preservation
- Shadow/radius behavior across breakpoints

---

## Step 14: Generate Section 9 -- Agent Prompt Guide

### Quick Color Reference

A flat bullet list of 8-12 colors with their roles and hex values. No grouping, no personality notes -- fast lookup only:

```
- Primary CTA: Name (`#hexval`)
- Background: Name (`#hexval`)
- Heading text: Name (`#hexval`)
```

### Example Component Prompts

Write 5-6 self-contained prompt strings. Each prompt is 100-200 words and MUST be a complete instruction that an AI agent can execute WITHOUT referencing any other section of the DESIGN.md.

**Self-containment checklist for each prompt:**
- Font family name included
- Font size, weight, line-height, letter-spacing all specified
- All colors as hex values (never "the primary color")
- Padding, radius, shadow values included for containers
- OpenType features included if the system uses them
- State variations (hover color, focus ring) where relevant

Format each prompt as a quoted string inside a bullet.

**Cover these component types at minimum:**
1. Hero section
2. Card component
3. Badge/pill
4. Navigation
5. One system-specific component (workflow pipeline, dark section, command palette, etc.)

### Iteration Guide

6-8 numbered steps. Each step is a concise directive with at least one concrete value. These steps tell someone implementing this design system what to do FIRST, SECOND, THIRD:

```
1. Always use shadow-as-border instead of CSS border -- `0px 0px 0px 1px rgba(0,0,0,0.08)` is the foundation
2. Letter-spacing scales with font size: -2.4px at 48px, -1.28px at 32px, normal at 14px
```

**Reference anti-patterns:** AP-09 (non-self-contained prompts).

---

## Step 15: Self-Audit

After generating all sections, perform a systematic self-audit.

### Numerical Accuracy Checks (from quality-checklist.md)

- [ ] **[NA-01]** Cross-reference EVERY hex value in the document against `tokens.json`. Any hex not in the source is a phantom -- remove or replace it.
- [ ] **[NA-04]** All hex values are 6-digit lowercase. Search for uppercase hex or 3-digit shorthand.
- [ ] **[NA-05]** All font-weight values are numeric. Search for `bold`, `normal`, `light`, `medium`, `semibold`.
- [ ] **[NA-07]** All shadow strings are verbatim from extraction. Character-by-character comparison.
- [ ] **[NA-08]** All border-radius values come from extracted data.

### Semantic Correctness Checks

- [ ] **[SC-01]** Color roles match actual usage, not just hue similarity.
- [ ] **[SC-02]** Typography roles match typical HTML element usage.
- [ ] **[SC-05]** Shadow type classification is correct -- zero-blur shadows are borders, not elevation.

### Completeness Checks

- [ ] **[CP-01]** All 9 core sections present (6.5 only if motion data exists).
- [ ] **[CP-02]** Minimum 8 colors documented.
- [ ] **[CP-03]** Typography table has 12+ rows.
- [ ] **[CP-04]** At least 3 component types documented.
- [ ] **[CP-05]** Hover/focus states documented for interactive components.
- [ ] **[CP-12]** Agent prompt guide has 5+ examples.

### Description Quality Checks

- [ ] **[DQ-01]** Zero banned words in descriptive prose.
- [ ] **[DQ-02]** Opening sentence is differentiating.
- [ ] **[DQ-07]** At least 3 Don'ts that would surprise a reader.
- [ ] **[DQ-08]** All agent prompts are self-contained.
- [ ] **[DQ-09]** No transition filler phrases ("Let's look at...", "In this section...").

### Anti-Pattern Checks

Read through the full anti-pattern catalog and verify:

- [ ] **AP-01** No phantom colors (every hex traceable to source)
- [ ] **AP-02** No generic descriptions (no banned adjectives without supporting values)
- [ ] **AP-03** Semantic roles match usage frequency, not hue assumptions
- [ ] **AP-04** Interactive elements have hover + focus states
- [ ] **AP-06** Consistent format (lowercase hex, numeric weights, px units)
- [ ] **AP-08** Every Don't includes a measurable threshold
- [ ] **AP-09** Agent prompts are self-contained with inline values
- [ ] **AP-10** Zero-blur box-shadows separated from elevation shadows
- [ ] **AP-12** Color names encode function, not just hue + index
- [ ] **AP-14** One canonical name per token, consistent across all sections
- [ ] **AP-16** Prose after tables adds context, not repetition
- [ ] **AP-20** Detected CSS framework named and mapped to output values

Fix any violations found before proceeding.

---

## Step 16: Publication Quality Gate

Run these three final tests. If any test fails, revise the relevant section before proceeding.

### Test 1: Differentiation

Remove the site name from the DESIGN.md mentally. Read the atmosphere section. Can you still identify which site this describes? If the description could apply to three or more other tech sites, rewrite it with more specific observations, unique metaphors, and site-specific values.

### Test 2: Actionability

Pick 3 random items from the Do's and Don'ts section. For each, ask: "Is this self-contained and executable? Could someone write correct CSS from this single bullet point alone?" If any item requires looking up values elsewhere in the document, revise it to include those values inline.

### Test 3: Self-Containment

Pick 1 agent prompt at random. Imagine copying ONLY that prompt into a fresh AI chat with no other context. Would the AI produce a component that visually matches the original site? If the prompt references "the primary color" or "standard spacing" without values, it fails. Revise to include all values inline.

---

## Step 17: Run Validation Script

**Command:**

```bash
cd /path/to/dmdg && npx ts-node scripts/validate.ts output/<domain>/DESIGN.md output/<domain>/tokens.json
```

The validation script checks:
- Structural completeness (all required sections present)
- Hex value traceability (all hex values exist in tokens.json)
- Format consistency (lowercase hex, numeric weights)
- Minimum counts (colors, typography rows, components, prompts)
- Anti-pattern detection (banned words, non-self-contained prompts)

**Read the validation output.** Fix any failures or warnings. Re-run until the score is >= 95.

If specific failures cannot be resolved (e.g., a value the validator flags as phantom but you intentionally derived from an RGBA conversion), document the exception in a comment at the top of the DESIGN.md.

---

## Step 18: Generate preview.html

Create an HTML file that demonstrates all design tokens visually. This file serves two purposes: visual verification against the original site, and a standalone reference for the design system.

### File Structure

The preview.html has two major sections:

**Demo Section** -- Shows the design system in action:
- Hero section with headline, subtitle, and CTA buttons
- Feature cards in a grid layout
- Navigation bar mock
- Badge/pill examples
- Footer section

**Reference Section** -- Exhaustive token display:
- Color palette swatches with hex labels
- Typography scale with every level rendered at its actual size/weight
- Component showcase (every button variant, card variant, badge variant)
- Spacing scale visualization
- Shadow/depth scale visualization
- Border radius scale visualization

### Styling Rules

- Style the preview using ONLY values from the DESIGN.md -- the preview is a test of the document's completeness
- Use the exact font families documented (link Google Fonts or note if the font is proprietary)
- If the font is proprietary/custom (e.g., Geist, sohne-var), use the closest available fallback and note it in a comment at the top of the HTML
- Apply the exact shadow values, border-radius values, and spacing values from the DESIGN.md
- Include the documented hover/focus states via CSS `:hover` and `:focus-visible` rules

### Dark Mode Preview

If the DESIGN.md includes dark mode overrides, generate a separate `preview-dark.html` that applies the dark mode token values. Alternatively, include a toggle in the main preview.html that switches between light and dark using CSS custom properties.

---

## Step 19: Visual Regression Check

Open preview.html in a browser or preview tool. Compare visually against the original site screenshots from Step 4.

Check these aspects:
- **Colors match**: Do the background, text, and accent colors feel right?
- **Typography feels right**: Do the headlines have the correct weight and tracking personality?
- **Shadows/depth correct**: Do card shadows match the depth feel of the original?
- **Component shapes match**: Do button radii, card radii, and badge shapes match?
- **Spacing feels right**: Does the overall density and whitespace match?

If there is a significant visual deviation:
1. Identify the specific mismatch (e.g., "card shadow too heavy" or "headline tracking too loose")
2. Trace the issue to a specific value in the DESIGN.md
3. Cross-reference against tokens.json to verify the value is correct
4. If the DESIGN.md value is wrong, fix it
5. Regenerate the affected section of preview.html
6. Re-check

Minor deviations due to proprietary fonts or dynamic content are acceptable. Document them in the README.

---

## Step 20: Generate README.md

Create a README.md in the output directory with:

### Content

1. **One-line description**: "Design system reference for [SiteName], extracted from public CSS."
2. **Disclaimer**: "This is not an official design system. Colors, fonts, and spacing were extracted from publicly accessible CSS and may not be 100% accurate. This document is intended for reference and educational purposes."
3. **File listing**: List all generated files with one-line descriptions.
4. **Usage instructions**: How to use the DESIGN.md with AI tools (copy a prompt from Section 9, paste into an AI chat).
5. **Commercial font notice**: If the site uses proprietary fonts (e.g., Geist, sohne-var, Inter Variable), note that the fonts are not included and must be obtained separately. Provide the font source URL if known.
6. **Generation metadata**:
   - Source URL
   - Generation date
   - Pages analyzed
   - Framework detected
   - Generator version

---

## Step 21: Final Output

**Auto-generate all deliverables:**

```bash
# Preview
cd /path/to/dmdg && npx ts-node scripts/preview-gen.ts output/<domain>/tokens.json output/<domain>/

# Report (includes validation + proof data if available)
cd /path/to/dmdg && npx ts-node scripts/report-gen.ts output/<domain>/tokens.json output/<domain>/ output/<domain>/DESIGN.md

# Fidelity proof (captures live site, compares pixel-level)
cd /path/to/dmdg && npx ts-node scripts/proof.ts <URL> output/<domain>/tokens.json output/<domain>/

# Re-generate report with proof data embedded
cd /path/to/dmdg && npx ts-node scripts/report-gen.ts output/<domain>/tokens.json output/<domain>/ output/<domain>/DESIGN.md
```

**Then open the report for the user:**

```bash
open output/<domain>/report.html
```

Confirm all files are present:

| File | Required | Description |
|------|----------|-------------|
| `DESIGN.md` | Yes | The complete design system document |
| `tokens.json` | Yes | Extracted design tokens |
| `report.html` | Yes | Quality report + fidelity proof + DESIGN.md viewer |
| `preview.html` | Yes | Visual token preview |
| `screenshots/` | Yes | Site screenshots at 5 viewports |

Display a summary to the user:

```
✅ Generation complete for [SiteName].

Quality: [score]/100 | Fidelity: [coverage]%
Colors: [N] | Typography: [N] levels | Components: [N] types

Key characteristics:
- [2-3 most distinctive design traits]

📄 report.html opened in browser.
📋 DESIGN.md ready — copy from report or use directly.
```

---

## User Interaction Points

**Default: NONE.** Run Steps 1-21 autonomously without stopping.

Only pause if:
- Extraction fails after 2 retries (Step 1)
- CAPTCHA blocks access (Step 1)
- Validation score < 60 (Step 17) — show failures, auto-fix, re-validate

Do NOT ask "should I continue?" between sections. Do NOT show intermediate tokens.json contents. The user wants the finished DESIGN.md, not a play-by-play.

---

## Error Handling Reference

| Error | Detection | Response |
|-------|-----------|----------|
| Anti-bot protection | 403/429 status, empty page content | Wait 5 seconds, retry with stealth mode if available. After 2 failures, inform user. |
| Page timeout | Script timeout or partial load | Increase timeout to 60s and retry. If still failing, try with `--no-javascript` for CSS-only extraction. |
| CORS-blocked CSS | External stylesheets return empty | Note in DESIGN.md limitations section. Proceed with whatever CSS was accessible. |
| Insufficient data | < 8 colors or < 6 typography levels | Suggest user provide additional page URLs for deeper extraction. |
| Dark mode incomplete | Some dark mode tokens missing | Document what is available. Add a note: "Dark mode extraction was partial. Values below represent observed overrides only." |
| CAPTCHA | Screenshot shows challenge page | Inform user. Skip that page. Proceed with data from other pages. |
| Proprietary fonts | Font files blocked or DRM-protected | Document the font family name and known fallbacks. Note in README that the font must be obtained separately. |
| Dynamic styles | Styles loaded via JavaScript after render | Re-run extraction with `--wait-for css` (polls until CSS variables stabilize). Some runtime-injected styles may not be capturable. |

---

## Multi-Product Output

When `designBoundary` is `shared-foundation`:

### Base DESIGN.md

Contains ONLY tokens shared across all products/sections:
- Common color palette (shared backgrounds, text colors, borders)
- Shared typography (font families, base scale)
- Common component styles (if any)
- Shared layout constraints (max-width, base spacing)

### Product DESIGN.md Files

Each product file (`DESIGN-<product>.md`):
- Opens with: `> Extends [Base DESIGN.md](./DESIGN.md). Only overrides and additions are documented below.`
- Documents ONLY tokens that differ from or add to the base
- Uses the same section numbering (skip sections with no overrides)
- References base values by name when showing what changed: "Primary shifts from Base Blue (`#2563eb`) to Product Purple (`#7c3aed`)"

### Consistency Rules

- Terminology MUST be consistent across all files. If the base calls a color "Action Default," every product file uses "Action Default" (not "Primary Blue" in one and "CTA Color" in another).
- Section structure is identical across all files.
- Cross-file references use relative markdown links.

---

## File Header Format

Every generated DESIGN.md begins with exactly three HTML comment lines:

```
<!-- Generated: YYYY-MM-DD | Source: https://example.com | Pages: N | Framework: name|none -->
<!-- This is not the official design system. Colors, fonts, and spacing may not be 100% accurate. -->
<!-- Generated by design-md-generator (https://github.com/jasonhnd/design-md-generator) -->
```

Followed by a blank line and:

```
# Design System: SiteName
```

---

## Global Formatting Rules

These rules apply across ALL sections of the DESIGN.md:

### Values
- **Hex colors**: Always 6-digit lowercase (`#533afd`, never `#533AFD` or `#53a`)
- **Font weights**: Always numeric (`300`, `400`, `500`, `600`, `700`). Never `light`, `regular`, `medium`, `semibold`, `bold`
- **Sizes**: Primary unit is `px` with rem equivalent: `48px (3.00rem)`. Two decimal places for rem.
- **CSS values**: Always in backticks: `rgba(0,0,0,0.08)`, `#171717`, `"ss01"`, `box-shadow`
- **Font names**: Always in backticks: `Geist`, `sohne-var`, `SourceCodePro`
- **CSS property names**: Always in backticks: `font-feature-settings`, `letter-spacing`

### Text
- **Em-dash** (`--` in markdown source) separates description from technical detail in bullet items
- **No consecutive blank lines.** Maximum one blank line between elements.
- **Section headings** (`##`) preceded by exactly one blank line
- **Subsection headings** (`###`) preceded by exactly one blank line
- No transition phrases: never write "Let's look at...", "In this section, we'll explore...", "Now let's move on to...", "As we can see...", "It's worth noting..."

### Structure
- Sections numbered with period: `## 1.`, `## 2.`, through `## 9.`
- Section 6.5 uses `## 6.5.`
- No table of contents
- No YAML front-matter beyond the three HTML comment lines
- File ends with a newline

### Tables
- Standard markdown pipe syntax
- Header row followed by separator row with dashes
- Empty cells use a single dash (`-`) or are left blank

### Overall Length
- Target: 250-400 lines total
- Under 250 indicates missing detail
- Over 400 indicates redundancy -- tighten prose and remove restatements

---

## Writing Quality Reference

When writing any prose in the DESIGN.md, follow these principles:

**Voice:** Write like a senior design systems engineer explaining a system to a peer who will implement it tomorrow. The reader already knows CSS, typography, and color theory. Never explain fundamentals.

**Density:** Every sentence must carry at least one piece of information that would change how someone implements the design. If a sentence could be deleted without losing implementation guidance, delete it.

**Value embedding:** Values must be woven into prose, not listed as standalone facts. "The aggressive negative letter-spacing (-2.4px at display sizes) creates text that feels minified for production" -- not "Letter spacing: -2.4px."

**Paragraph density:** Each prose paragraph should contain 2-4 concrete values. Zero values = opinion. One value = observation. Two to four values = documentation.

**No restating tables:** If a value appears in a table, do not repeat it in adjacent prose unless the prose adds NEW information (rationale, relationship to another value, historical context).

**Deletion test:** Read every sentence. Ask "If I delete this, does the reader lose implementation-relevant information?" If no, delete it.
