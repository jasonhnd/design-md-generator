import type { DOMCollection, InteractionData, A11yTokens } from './types';

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(color: string): [number, number, number] | null {
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }

  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }

  return null;
}

function parseFontSize(fontSize: string): number {
  const val = parseFloat(fontSize);
  return isNaN(val) ? 0 : val;
}

function isLargeText(fontSize: string, fontWeight: string): boolean {
  const size = parseFontSize(fontSize);
  const weight = parseInt(fontWeight, 10);
  const isBold = weight >= 700 || fontWeight === 'bold';
  return size >= 18 || (isBold && size >= 14);
}

interface ContrastPairKey {
  foreground: string;
  background: string;
}

function pairKey(fg: string, bg: string): string {
  return `${fg}|||${bg}`;
}

function extractFocusIndicator(
  interactions: InteractionData[],
): { style: Record<string, string>; consistent: boolean } {
  const focusStyles: Record<string, string>[] = [];

  for (const interaction of interactions) {
    for (const capture of interaction.captures) {
      if (capture.focusVisibleDiff) {
        focusStyles.push(capture.focusVisibleDiff);
      }
    }
  }

  if (focusStyles.length === 0) {
    return { style: {}, consistent: true };
  }

  const first = focusStyles[0];
  const firstKeys = Object.keys(first).sort().join(',');
  const firstVals = Object.keys(first)
    .sort()
    .map((k) => first[k])
    .join(',');

  let consistent = true;
  for (let i = 1; i < focusStyles.length; i++) {
    const current = focusStyles[i];
    const currentKeys = Object.keys(current).sort().join(',');
    const currentVals = Object.keys(current)
      .sort()
      .map((k) => current[k])
      .join(',');

    if (currentKeys !== firstKeys || currentVals !== firstVals) {
      consistent = false;
      break;
    }
  }

  return { style: { ...first }, consistent };
}

export function extractA11y(
  domCollections: DOMCollection[],
  interactions: InteractionData[],
): A11yTokens {
  const focusIndicator = extractFocusIndicator(interactions);

  const pairCounts = new Map<string, { fg: string; bg: string; count: number }>();

  for (const collection of domCollections) {
    for (const el of collection.elements) {
      if (!el.color || !el.backgroundColor) continue;
      if (el.color === 'transparent' || el.backgroundColor === 'transparent') continue;

      const key = pairKey(el.color, el.backgroundColor);
      const existing = pairCounts.get(key);
      if (existing) {
        pairCounts.set(key, { ...existing, count: existing.count + 1 });
      } else {
        pairCounts.set(key, { fg: el.color, bg: el.backgroundColor, count: 1 });
      }
    }
  }

  const contrastPairs: A11yTokens['contrastPairs'] = [];

  for (const { fg, bg, count } of pairCounts.values()) {
    const fgRgb = parseRgb(fg);
    const bgRgb = parseRgb(bg);
    if (!fgRgb || !bgRgb) continue;

    const fgLum = relativeLuminance(...fgRgb);
    const bgLum = relativeLuminance(...bgRgb);
    const ratio = contrastRatio(fgLum, bgLum);
    const roundedRatio = Math.round(ratio * 100) / 100;

    contrastPairs.push({
      foreground: fg,
      background: bg,
      ratio: roundedRatio,
      meetsAA: roundedRatio >= 4.5,
      meetsAAA: roundedRatio >= 7,
      usageCount: count,
    });
  }

  contrastPairs.sort((a, b) => b.usageCount - a.usageCount);

  const interactiveTags = new Set(['button', 'a', 'input', 'select', 'textarea']);
  let minWidth = Infinity;
  let minHeight = Infinity;

  for (const collection of domCollections) {
    for (const el of collection.elements) {
      if (!interactiveTags.has(el.tag)) continue;
      if (el.rect.width <= 0 || el.rect.height <= 0) continue;

      if (el.rect.width * el.rect.height < minWidth * minHeight) {
        minWidth = el.rect.width;
        minHeight = el.rect.height;
      }
    }
  }

  const minTouchTarget = {
    width: minWidth === Infinity ? 0 : Math.round(minWidth),
    height: minHeight === Infinity ? 0 : Math.round(minHeight),
  };

  let smallestFontSize = Infinity;
  let smallestFontSizeStr = '0px';

  for (const collection of domCollections) {
    for (const el of collection.elements) {
      if (!el.fontSize || !el.textContent?.trim()) continue;
      const size = parseFontSize(el.fontSize);
      if (size > 0 && size < smallestFontSize) {
        smallestFontSize = size;
        smallestFontSizeStr = el.fontSize;
      }
    }
  }

  return {
    focusIndicator,
    contrastPairs,
    minTouchTarget,
    minFontSize: smallestFontSizeStr,
  };
}
