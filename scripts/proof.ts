import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { DesignTokens } from './types';

// ─── Color Math ─────────────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToOklch(c: RGB): { l: number; c: number; h: number } {
  // Simplified sRGB → OKLCH (good enough for scoring)
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const lr = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const lg = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const lb = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  // Approximate lightness via luminance
  const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const l = Math.cbrt(lum);
  // Approximate chroma and hue from raw RGB difference
  const maxC = Math.max(lr, lg, lb);
  const minC = Math.min(lr, lg, lb);
  const chroma = (maxC - minC) * 0.4;
  let hue = 0;
  if (maxC - minC > 0.001) {
    if (maxC === lr) hue = 60 * (((lg - lb) / (maxC - minC)) % 6);
    else if (maxC === lg) hue = 60 * ((lb - lr) / (maxC - minC) + 2);
    else hue = 60 * ((lr - lg) / (maxC - minC) + 4);
    if (hue < 0) hue += 360;
  }
  return { l, c: chroma, h: hue };
}

function deltaE(a: { l: number; c: number; h: number }, b: { l: number; c: number; h: number }): number {
  const dl = (a.l - b.l) * 100;
  const dc = (a.c - b.c) * 100;
  const dhRad = ((a.h - b.h) * Math.PI) / 180;
  const dh = 2 * Math.sqrt(Math.max(0, a.c * b.c)) * Math.sin(dhRad / 2) * 100;
  return Math.sqrt(dl * dl + dc * dc + dh * dh);
}

// ─── Pixel Sampling ─────────────────────────────────────────────────────────

interface SampleResult {
  totalSampled: number;
  matched: number;
  coverage: number;
  unmatchedColors: { r: number; g: number; b: number; count: number }[];
}

function scoreColorCoverage(
  pixels: Uint8Array,
  width: number,
  height: number,
  palette: { l: number; c: number; h: number }[],
  threshold: number = 12,
  sampleCount: number = 2000,
): SampleResult {
  const step = Math.max(1, Math.floor((width * height) / sampleCount));
  let matched = 0;
  let totalSampled = 0;
  const unmatchedMap = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < width * height; i += step) {
    const idx = i * 4;
    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2], a = pixels[idx + 3];
    if (a < 128) continue; // skip transparent

    totalSampled++;
    const oklch = rgbToOklch({ r, g, b });

    let found = false;
    for (const pc of palette) {
      if (deltaE(oklch, pc) < threshold) {
        found = true;
        break;
      }
    }

    if (found) {
      matched++;
    } else {
      // Quantize unmatched color for grouping
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      const existing = unmatchedMap.get(key);
      if (existing) existing.count++;
      else unmatchedMap.set(key, { r: qr, g: qg, b: qb, count: 1 });
    }
  }

  const unmatchedColors = Array.from(unmatchedMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSampled,
    matched,
    coverage: totalSampled > 0 ? matched / totalSampled : 0,
    unmatchedColors,
  };
}

// ─── HTML Report ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreColor(pct: number): string {
  if (pct >= 0.85) return '#22c55e';
  if (pct >= 0.65) return '#eab308';
  return '#ef4444';
}

function scoreLabel(pct: number): string {
  if (pct >= 0.85) return 'Excellent';
  if (pct >= 0.65) return 'Good';
  return 'Needs Work';
}

function buildProofHtml(
  sourceUrl: string,
  originalScreenshotB64: string,
  previewScreenshotB64: string,
  result: SampleResult,
  tokens: DesignTokens,
): string {
  const pct = result.coverage;
  const pctStr = (pct * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fidelity Proof — ${esc(sourceUrl)}</title>
<style>
  :root { --bg: #0f0f13; --surface: #1a1a24; --text: #e4e4eb; --border: #2a2a3a; --muted: #8b8ba0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }

  .header { padding: 2.5rem 2rem; text-align: center; }
  .header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .header .url { color: var(--muted); font-size: 0.85rem; }

  .score-block { text-align: center; padding: 2rem; }
  .score-ring {
    width: 160px; height: 160px; border-radius: 50%; margin: 0 auto 1rem;
    display: flex; align-items: center; justify-content: center; flex-direction: column; position: relative;
  }
  .score-ring::before { content:''; position:absolute; inset:5px; border-radius:50%; background: var(--surface); }
  .score-num { position: relative; font-size: 2.5rem; font-weight: 800; }
  .score-pct { position: relative; font-size: 0.85rem; }
  .score-sub { position: relative; font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

  .metric-row { display: flex; justify-content: center; gap: 3rem; margin: 1.5rem 0; flex-wrap: wrap; }
  .metric { text-align: center; }
  .metric strong { display: block; font-size: 1.3rem; }
  .metric span { font-size: 0.75rem; color: var(--muted); }

  .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 0 2rem 2rem; max-width: 1400px; margin: 0 auto; }
  @media (max-width: 900px) { .comparison { grid-template-columns: 1fr; } }
  .comparison-panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .comparison-panel__label {
    padding: 0.75rem 1rem; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; border-bottom: 1px solid var(--border); color: var(--muted);
  }
  .comparison-panel img {
    width: 100%; height: auto; display: block;
  }

  .unmatched { max-width: 900px; margin: 0 auto; padding: 0 2rem 3rem; }
  .unmatched h2 { font-size: 1rem; margin-bottom: 1rem; color: var(--muted); }
  .unmatched-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .unmatched-swatch {
    width: 56px; height: 40px; border-radius: 6px; display: flex; align-items: flex-end;
    justify-content: center; font-size: 0.55rem; padding: 2px; font-family: monospace;
    border: 1px solid var(--border);
  }

  .footer { text-align: center; padding: 2rem; font-size: 0.7rem; color: var(--muted); }
</style>
</head>
<body>

<div class="header">
  <h1>Fidelity Proof</h1>
  <div class="url">${esc(sourceUrl)}</div>
</div>

<div class="score-block">
  <div class="score-ring" style="background: conic-gradient(${scoreColor(pct)} ${pct * 360}deg, var(--border) 0deg);">
    <span class="score-num" style="color:${scoreColor(pct)}">${pctStr}%</span>
    <span class="score-sub">${scoreLabel(pct)}</span>
  </div>
  <p style="color:var(--muted);font-size:0.85rem;">Color Palette Coverage — how well our extracted palette captures the original site's colors</p>

  <div class="metric-row">
    <div class="metric">
      <strong>${result.totalSampled.toLocaleString()}</strong>
      <span>Pixels Sampled</span>
    </div>
    <div class="metric">
      <strong>${result.matched.toLocaleString()}</strong>
      <span>Matched (ΔE &lt; 12)</span>
    </div>
    <div class="metric">
      <strong>${tokens.colorTokens.length}</strong>
      <span>Palette Colors</span>
    </div>
    <div class="metric">
      <strong>${result.unmatchedColors.length}</strong>
      <span>Unmatched Groups</span>
    </div>
  </div>
</div>

<div class="comparison">
  <div class="comparison-panel">
    <div class="comparison-panel__label">🌐 Original Site</div>
    <img src="data:image/png;base64,${originalScreenshotB64}" alt="Original site screenshot">
  </div>
  <div class="comparison-panel">
    <div class="comparison-panel__label">🎨 Extracted Token Preview</div>
    <img src="data:image/png;base64,${previewScreenshotB64}" alt="Preview from extracted tokens">
  </div>
</div>

${result.unmatchedColors.length > 0 ? `
<div class="unmatched">
  <h2>Top Unmatched Color Groups</h2>
  <p style="color:var(--muted);font-size:0.8rem;margin-bottom:1rem;">Colors found on the original site but not captured in our palette (quantized to nearest 32-step)</p>
  <div class="unmatched-grid">
${result.unmatchedColors.map((c) => {
  const hex = `#${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`;
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const fg = lum > 140 ? '#000' : '#fff';
  return `    <div class="unmatched-swatch" style="background:${hex};color:${fg}">×${c.count}</div>`;
}).join('\n')}
  </div>
</div>` : ''}

<div class="footer">
  Generated by design-md-generator proof · ${new Date().toISOString().slice(0, 10)}
</div>

</body>
</html>`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function runProof(
  url: string,
  tokensPath: string,
  outputDir: string,
  previewPath?: string,
): Promise<void> {
  const tokens: DesignTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  // Build palette in OKLCH
  const palette = tokens.colorTokens
    .filter((c) => c.rgba[3] > 0.1)
    .map((c) => rgbToOklch({ r: c.rgba[0], g: c.rgba[1], b: c.rgba[2] }));

  console.log(`  Palette: ${palette.length} colors`);

  const browser = await chromium.launch();

  // 1. Screenshot original site
  console.log(`  Capturing original: ${url}`);
  const origCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const origPage = await origCtx.newPage();
  await origPage.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await origPage.waitForTimeout(2000);
  const origScreenshot = await origPage.screenshot({ fullPage: false });
  const origB64 = origScreenshot.toString('base64');

  // Extract pixel data from original screenshot
  console.log('  Sampling pixels from original...');
  const pixelData = await origPage.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await new Promise((resolve) => { img.onload = resolve; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      width: canvas.width,
      height: canvas.height,
      data: Array.from(imageData.data),
    };
  }, origB64);

  await origCtx.close();

  // 2. Screenshot preview
  const resolvedPreview = previewPath ?? path.join(outputDir, 'preview.html');
  if (!fs.existsSync(resolvedPreview)) {
    console.error(`  Preview not found at ${resolvedPreview}. Run preview-gen.ts first.`);
    await browser.close();
    return;
  }

  console.log('  Capturing preview...');
  const prevCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const prevPage = await prevCtx.newPage();
  await prevPage.goto(`file://${path.resolve(resolvedPreview)}`, { waitUntil: 'networkidle' });
  await prevPage.waitForTimeout(500);
  const prevScreenshot = await prevPage.screenshot({ fullPage: false });
  const prevB64 = prevScreenshot.toString('base64');
  await prevCtx.close();
  await browser.close();

  // 3. Score
  console.log('  Computing color coverage...');
  const pixels = new Uint8Array(pixelData.data);
  const result = scoreColorCoverage(pixels, pixelData.width, pixelData.height, palette);
  const pct = (result.coverage * 100).toFixed(1);
  console.log(`  Coverage: ${pct}% (${result.matched}/${result.totalSampled} pixels within ΔE < 12)`);

  // 4. Generate proof report
  const html = buildProofHtml(url, origB64, prevB64, result, tokens);
  const outPath = path.join(outputDir, 'proof.html');
  fs.writeFileSync(outPath, html);
  console.log(`  Generated proof.html → ${outPath}`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(`Usage: npx ts-node scripts/proof.ts <url> <tokens-json> [output-dir] [preview-html]

Example:
  npx ts-node scripts/proof.ts https://stripe.com output/stripe.com/tokens.json
  npx ts-node scripts/proof.ts https://vercel.com examples/vercel/tokens.json examples/vercel/`);
    process.exit(1);
  }

  const url = args[0];
  const tokensPath = args[1];
  const outputDir = args[2] ?? path.dirname(tokensPath);
  const previewPath = args[3];

  runProof(url, tokensPath, outputDir, previewPath).catch((err) => {
    console.error('Fatal:', err.message ?? err);
    process.exit(1);
  });
}

export { runProof };
