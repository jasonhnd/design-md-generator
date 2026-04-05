import type { DOMCollection, IconSystemInfo } from './types';

interface SvgClassData {
  className: string;
  attributes: Record<string, string>;
}

function buildFrequencyMap(values: number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const v of values) {
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

function topN(freqMap: Map<number, number>, n: number): number[] {
  return [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value]) => value)
    .sort((a, b) => a - b);
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const freqMap = buildFrequencyMap(values);
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of freqMap) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function detectLibrary(svgClassData: SvgClassData[]): string | null {
  const checks: { name: string; test: (d: SvgClassData) => boolean }[] = [
    { name: 'lucide', test: (d) => d.className.includes('lucide') || d.attributes['data-lucide'] !== undefined },
    { name: 'heroicons', test: (d) => d.className.includes('heroicon') },
    { name: 'phosphor', test: (d) => d.className.split(/\s+/).some((c) => c.startsWith('ph-')) },
    { name: 'feather', test: (d) => d.className.includes('feather') || d.attributes['data-feather'] !== undefined },
    { name: 'material-icons', test: (d) => d.className.includes('material-icons') },
    {
      name: 'font-awesome',
      test: (d) => {
        const classes = d.className.split(/\s+/);
        return classes.some((c) => c.startsWith('fa-') || ['fas', 'far', 'fab', 'fal', 'fad'].includes(c));
      },
    },
  ];

  for (const { name, test } of checks) {
    if (svgClassData.some(test)) return name;
  }
  return null;
}

function determineColorMode(svgColors: string[]): 'currentColor' | 'fixed' | 'mixed' {
  if (svgColors.length === 0) return 'mixed';
  const currentColorCount = svgColors.filter((c) => c === 'currentColor').length;
  const ratio = currentColorCount / svgColors.length;
  if (ratio > 0.8) return 'currentColor';
  if (ratio < 0.2) return 'fixed';
  return 'mixed';
}

export function detectIcons(domCollections: DOMCollection[]): IconSystemInfo | null {
  const allSizes: { width: number; height: number }[] = [];
  const allColors: string[] = [];
  const allClassData: SvgClassData[] = [];

  for (const collection of domCollections) {
    allSizes.push(...collection.svgSizes);
    allColors.push(...collection.svgColors);

    for (const el of collection.elements) {
      if (el.tag === 'svg') {
        allClassData.push({ className: el.className, attributes: {} });
      }
    }
  }

  const totalCount = allSizes.length;
  if (totalCount < 3) return null;

  const widthFreq = buildFrequencyMap(allSizes.map((s) => s.width));
  const sizeScale = topN(widthFreq, 3);

  const strokeWidths: number[] = [];
  for (const collection of domCollections) {
    for (const el of collection.elements) {
      if (el.tag === 'svg' || el.tag === 'path' || el.tag === 'line' || el.tag === 'circle') {
        const bw = parseFloat(el.borderTopWidth);
        if (!isNaN(bw) && bw > 0) strokeWidths.push(bw);
      }
    }
  }
  const strokeWidth = mode(strokeWidths);

  const colorMode = determineColorMode(allColors);
  const library = detectLibrary(allClassData);

  return { library, sizeScale, strokeWidth, colorMode, totalCount };
}
