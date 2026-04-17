import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens, ColorToken, TypographyLevel, ShadowToken, RadiusToken } from './types';
import { validateDesignMd, type ValidationResult } from './validate';

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function topColors(tokens: ColorToken[], n: number): ColorToken[] {
  return tokens.filter((c) => c.rgba[3] > 0.1).slice(0, n);
}

function inferBg(tokens: ColorToken[]): string {
  return tokens.find((c) => c.usedAs.bgColor > 0 && c.frequency > 10)?.hex ?? '#ffffff';
}

function inferText(tokens: ColorToken[]): string {
  return tokens.find((c) => c.usedAs.textColor > 0 && c.frequency > 10)?.hex ?? '#1a1a1a';
}

function inferPrimary(tokens: ColorToken[]): string {
  for (const c of tokens) {
    const [r, g, b] = c.rgba;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 30 && c.frequency > 5) return c.hex;
  }
  return '#6b5ce7';
}

function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e';
  if (score >= 80) return '#eab308';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 95) return 'Excellent';
  if (score >= 80) return 'Pass';
  return 'Needs Work';
}

function colorRole(c: ColorToken): string {
  const roles: string[] = [];
  if (c.usedAs.bgColor > 0) roles.push('bg');
  if (c.usedAs.textColor > 0) roles.push('text');
  if (c.usedAs.borderColor > 0) roles.push('border');
  if (c.usedAs.shadowColor > 0) roles.push('shadow');
  if (c.usedAs.gradientColor > 0) roles.push('gradient');
  if (c.usedAs.iconColor > 0) roles.push('icon');
  return roles.join(', ') || '—';
}

function contrastOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? '#000000' : '#ffffff';
}

// ─── Report HTML ────────────────────────────────────────────────────────────

function generateReportHtml(
  tokens: DesignTokens,
  validation: ValidationResult | null,
  designMdContent: string | null,
): string {
  const colors = topColors(tokens.colorTokens, 30);
  const typo = tokens.typographyLevels.slice(0, 12);
  const shadows = tokens.shadowTokens.slice(0, 8);
  const radii = tokens.radiusTokens.slice(0, 8);
  const source = tokens.meta?.sourceUrls?.[0] ?? 'Unknown';
  const primary = inferPrimary(colors);
  const bg = inferBg(colors);
  const text = inferText(colors);
  const fontFamily = typo[0]?.fontFamily ?? 'system-ui';

  const score = validation?.score ?? null;
  const checksPassed = validation?.passed?.length ?? 0;
  const totalChecks = checksPassed + (validation?.failures?.length ?? 0) + (validation?.warnings?.length ?? 0);

  // Build Google Fonts link from tokens if available
  const googleFontsLinks: string[] = (tokens.fontInfo as { googleFontsLinks?: string[] })?.googleFontsLinks ?? [];
  const uniqueFamilies = [...new Set(typo.map((t) => t.fontFamily))].filter((f) => f !== 'system-ui');
  // Generate a fallback Google Fonts link for common fonts
  const googleFontsTag = googleFontsLinks.length > 0
    ? googleFontsLinks.map((l) => `<link rel="stylesheet" href="${esc(l)}">`).join('\n')
    : uniqueFamilies.length > 0
      ? `<!-- Note: ${uniqueFamilies.join(', ')} may be proprietary. Typography preview uses system fallback. -->`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Extraction Report — ${esc(source)}</title>
${googleFontsTag}
<style>
  :root {
    --bg: #fafafa;
    --surface: #ffffff;
    --text: #1a1a2e;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --primary: ${primary};
    --radius: 10px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    font-size: 15px;
  }

  /* ── Header ─────────────────────────────────── */
  .report-header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
    padding: 3rem 2rem 2.5rem;
  }
  .report-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  .report-header .subtitle {
    opacity: 0.7;
    font-size: 0.9rem;
  }
  .report-header .meta-row {
    display: flex;
    gap: 2rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  .meta-chip {
    background: rgba(255,255,255,0.1);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }
  .meta-chip strong { display: block; font-size: 1.1rem; }

  /* ── Layout ─────────────────────────────────── */
  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }

  /* ── Cards ──────────────────────────────────── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .card h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .card h2 .icon { font-size: 1.2rem; }

  /* ── Score Ring ─────────────────────────────── */
  .score-ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    margin: 0 auto 1rem;
    position: relative;
  }
  .score-ring::before {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: var(--surface);
  }
  .score-num { position: relative; font-size: 2rem; font-weight: 800; }
  .score-label { position: relative; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── Validation Items ──────────────────────── */
  .check-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--border);
  }
  .check-item:last-child { border-bottom: none; }
  .badge { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px; }
  .badge--pass { background: #dcfce7; color: #166534; }
  .badge--fail { background: #fef2f2; color: #991b1b; }
  .badge--warn { background: #fefce8; color: #854d0e; }

  /* ── Color Swatches ────────────────────────── */
  .color-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .swatch {
    width: 80px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    font-size: 0.65rem;
    text-align: center;
  }
  .swatch__color { height: 48px; display: flex; align-items: flex-end; justify-content: center; padding: 0.2rem; font-family: monospace; font-weight: 600; }
  .swatch__meta { padding: 0.3rem; color: var(--text-muted); }

  /* ── Typography Scale ──────────────────────── */
  .typo-row {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }
  .typo-row:last-child { border-bottom: none; }
  .typo-sample { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .typo-spec { font-size: 0.7rem; color: var(--text-muted); font-family: monospace; white-space: nowrap; }

  /* ── Shadow & Radius ───────────────────────── */
  .shadow-row { display: flex; flex-wrap: wrap; gap: 1rem; }
  .shadow-demo {
    width: 100px;
    height: 64px;
    background: var(--surface);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-family: monospace;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .radius-row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .radius-demo {
    width: 56px;
    height: 56px;
    background: var(--primary);
    opacity: 0.2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    color: var(--text);
  }

  /* ── Component Summary ─────────────────────── */
  .comp-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .comp-table th { text-align: left; font-weight: 600; padding: 0.5rem; border-bottom: 2px solid var(--border); }
  .comp-table td { padding: 0.5rem; border-bottom: 1px solid var(--border); }
  .comp-table td:last-child { text-align: right; color: var(--text-muted); }

  /* ── DESIGN.md Preview ─────────────────────── */
  .md-preview {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2rem;
    font-family: 'Georgia', serif;
    font-size: 0.9rem;
    line-height: 1.8;
    max-height: 600px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* ── Footer ────────────────────────────────── */
  .report-footer {
    text-align: center;
    padding: 2rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
</head>
<body>

<!-- ═══════════════ HEADER ═══════════════ -->
<header class="report-header">
  <h1>Design Extraction Report</h1>
  <div class="subtitle">${esc(source)}</div>
  <div class="meta-row">
    <div class="meta-chip">
      <strong>${tokens.colorTokens.length}</strong> Colors
    </div>
    <div class="meta-chip">
      <strong>${tokens.typographyLevels.length}</strong> Type Levels
    </div>
    <div class="meta-chip">
      <strong>${tokens.shadowTokens.length}</strong> Shadows
    </div>
    <div class="meta-chip">
      <strong>${tokens.meta?.totalPages ?? '?'}</strong> Pages
    </div>
    <div class="meta-chip">
      <strong>${tokens.meta?.totalElements ?? '?'}</strong> Elements
    </div>
  </div>
</header>

<div class="container">

<!-- ═══════════════ VALIDATION ═══════════════ -->
${score !== null ? `
<div class="grid-2">
  <div class="card">
    <h2><span class="icon">📊</span> Quality Score</h2>
    <div class="score-ring" style="background: conic-gradient(${scoreColor(score)} ${score * 3.6}deg, var(--border) 0deg);">
      <span class="score-num" style="color:${scoreColor(score)}">${score}</span>
      <span class="score-label">${scoreLabel(score)}</span>
    </div>
    <p style="text-align:center;font-size:0.8rem;color:var(--text-muted);">${checksPassed}/${totalChecks} checks passed</p>
  </div>
  <div class="card">
    <h2><span class="icon">✅</span> Validation Details</h2>
    ${validation!.passed.map((p) => `<div class="check-item"><span class="badge badge--pass">PASS</span> ${esc(p)}</div>`).join('\n')}
    ${validation!.failures.map((f) => `<div class="check-item"><span class="badge badge--fail">FAIL</span> ${esc(f.type)}: ${esc(f.message)}</div>`).join('\n')}
    ${validation!.warnings.map((w) => `<div class="check-item"><span class="badge badge--warn">WARN</span> ${esc(w.type)}: ${esc(w.message)}</div>`).join('\n')}
  </div>
</div>
` : ''}

<!-- ═══════════════ COLOR PALETTE ═══════════════ -->
<div class="card">
  <h2><span class="icon">🎨</span> Color Palette (top ${colors.length})</h2>
  <div class="color-grid">
${colors.map((c) => `    <div class="swatch">
      <div class="swatch__color" style="background:${c.hex};color:${contrastOnColor(c.hex)}">${c.hex}</div>
      <div class="swatch__meta">${colorRole(c)}<br>×${c.frequency}</div>
    </div>`).join('\n')}
  </div>
</div>

<!-- ═══════════════ TYPOGRAPHY ═══════════════ -->
<div class="card">
  <h2><span class="icon">🔤</span> Typography Scale</h2>
${typo.map((t) => `  <div class="typo-row">
    <span class="typo-sample" style="font-family:'${esc(t.fontFamily)}',system-ui;font-size:min(${t.fontSize},2rem);font-weight:${t.fontWeight};line-height:${t.lineHeight}">The quick brown fox jumps</span>
    <span class="typo-spec">${esc(t.fontFamily)} ${t.fontSize} w${t.fontWeight}</span>
  </div>`).join('\n')}
</div>

<div class="grid-2">
<!-- ═══════════════ SHADOWS ═══════════════ -->
${shadows.length > 0 ? `
<div class="card">
  <h2><span class="icon">🌑</span> Shadows (${shadows.length})</h2>
  <div class="shadow-row">
${shadows.map((s) => `    <div class="shadow-demo" style="box-shadow:${esc(s.value)}">${esc(s.type)}</div>`).join('\n')}
  </div>
</div>` : ''}

<!-- ═══════════════ RADIUS ═══════════════ -->
${radii.length > 0 ? `
<div class="card">
  <h2><span class="icon">◼️</span> Border Radius (${radii.length})</h2>
  <div class="radius-row">
${radii.map((r) => `    <div class="radius-demo" style="border-radius:${r.value}">${r.value}</div>`).join('\n')}
  </div>
</div>` : ''}
</div>

<!-- ═══════════════ COMPONENTS ═══════════════ -->
${tokens.components && tokens.components.length > 0 ? `
<div class="card">
  <h2><span class="icon">🧩</span> Components Detected</h2>
  <table class="comp-table">
    <thead><tr><th>Type</th><th>Variants</th><th>Total Count</th></tr></thead>
    <tbody>
${tokens.components.map((cg: { type: string; variants: { name: string; count: number }[] }) => {
  const total = cg.variants.reduce((s: number, v: { count: number }) => s + v.count, 0);
  return `      <tr><td>${esc(cg.type)}</td><td>${cg.variants.map((v: { name: string }) => v.name).join(', ')}</td><td>${total}</td></tr>`;
}).join('\n')}
    </tbody>
  </table>
</div>` : ''}

<!-- ═══════════════ DARK MODE ═══════════════ -->
${(tokens as unknown as Record<string, unknown>).darkMode && ((tokens as unknown as Record<string, unknown>).darkMode as { supported: boolean }).supported ? (() => {
  const dm = (tokens as unknown as Record<string, unknown>).darkMode as { supported: boolean; detectionMethod: string; variableDiff: { name: string; lightValue: string; darkValue: string }[]; detectionSource?: string };
  return `
<div class="card">
  <h2><span class="icon">🌙</span> Dark Mode</h2>
  <p style="margin-bottom:1rem;">Detected via <strong>${esc(dm.detectionMethod)}</strong>${dm.detectionSource ? ` on ${esc(dm.detectionSource)}` : ''}</p>
  ${dm.variableDiff.length > 0 ? `
  <table class="comp-table">
    <thead><tr><th>Variable</th><th>Light</th><th>Dark</th></tr></thead>
    <tbody>
${dm.variableDiff.slice(0, 20).map((v) => `      <tr>
        <td style="font-family:monospace;font-size:0.8rem">${esc(v.name)}</td>
        <td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:4px;background:${v.lightValue};border:1px solid var(--border)"></span>${esc(v.lightValue)}</td>
        <td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:4px;background:${v.darkValue};border:1px solid var(--border)"></span>${esc(v.darkValue)}</td>
      </tr>`).join('\n')}
    </tbody>
  </table>
  ${dm.variableDiff.length > 20 ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">... and ${dm.variableDiff.length - 20} more variables</p>` : ''}` : '<p style="color:var(--text-muted);">Dark mode detected but no CSS variable differences captured.</p>'}
</div>`;
})() : ''}

<!-- ═══════════════ DESIGN.MD PREVIEW ═══════════════ -->
${designMdContent ? `
<div class="card">
  <h2><span class="icon">📄</span> DESIGN.md Content</h2>
  <div class="md-preview">${esc(designMdContent)}</div>
</div>` : `
<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted);">
  <h2><span class="icon">📄</span> DESIGN.md</h2>
  <p>No DESIGN.md file provided. Generate one from tokens.json using the Claude Code skill <code>/design-md</code>.</p>
</div>`}

</div>

<footer class="report-footer">
  Generated by design-md-generator · ${new Date().toISOString().slice(0, 10)}
</footer>

</body>
</html>`;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generateReport(
  tokensPath: string,
  outputDir: string,
  designMdPath?: string,
): void {
  const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  let designMdContent: string | null = null;
  let validation: ValidationResult | null = null;

  if (designMdPath && fs.existsSync(designMdPath)) {
    designMdContent = fs.readFileSync(designMdPath, 'utf-8');
    validation = validateDesignMd(designMdContent, tokens);
  }

  const html = generateReportHtml(tokens, validation, designMdContent);
  const outPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(outPath, html);
  console.log(`  Generated report.html → ${outPath}`);

  if (validation) {
    console.log(`  Quality score: ${validation.score}/100 (${validation.passed.length} passed, ${validation.failures.length} failures, ${validation.warnings.length} warnings)`);
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(`Usage:
  npx ts-node scripts/report-gen.ts <tokens-json> [output-dir] [design-md]

Examples:
  npx ts-node scripts/report-gen.ts output/stripe.com/tokens.json
  npx ts-node scripts/report-gen.ts output/stripe.com/tokens.json output/stripe.com/ DESIGN.md`);
    process.exit(1);
  }

  const tokensPath = args[0];
  const outputDir = args[1] ?? path.dirname(tokensPath);
  const designMdPath = args[2];

  generateReport(tokensPath, outputDir, designMdPath);
}
