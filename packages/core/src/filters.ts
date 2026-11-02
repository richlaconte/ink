// One shared set of SVG filters for the page: url(#ink) and url(#ink-soft).
//   slow warp (paper unevenness) -> fine displacement (ragged fibre edges)
//   -> blur + alpha threshold (feathering, pooling where strokes overlap)
//   -> grain (ink density)

import { SVGNS } from './drawing';

export interface FilterParams { rough: number; warp: number; bleed: number; grain: number }
export const filterParams: FilterParams = { rough: 1.1, warp: 1.4, bleed: 0.45, grain: 0.35 };

const ID = 'pen-ink-defs';

export function ensureFilters(): SVGSVGElement | null {
  if (typeof document === 'undefined') return null;
  let defs = document.getElementById(ID) as SVGSVGElement | null;
  if (defs) return defs;
  defs = document.createElementNS(SVGNS, 'svg');
  defs.id = ID;
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  document.body.prepend(defs);
  updateFilters();
  return defs;
}

export function updateFilters(params: Partial<FilterParams> = {}) {
  Object.assign(filterParams, params);
  if (typeof document === 'undefined') return;
  const defs = document.getElementById(ID);
  if (!defs) { ensureFilters(); return; }
  const { rough, warp, bleed, grain } = filterParams;
  defs.innerHTML = `
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="warpN"/>
    <feDisplacementMap in="SourceGraphic" in2="warpN" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="warped"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="fineN"/>
    <feDisplacementMap in="warped" in2="fineN" scale="${rough}" xChannelSelector="R" yChannelSelector="G" result="ragged"/>
    <feGaussianBlur in="ragged" stdDeviation="${bleed}" result="blur"/>
    <feComponentTransfer in="blur" result="bled"><feFuncA type="linear" slope="1.9" intercept="-0.12"/></feComponentTransfer>
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="2" result="grainN"/>
    <feColorMatrix in="grainN" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${-grain * 1.6} 0 0 0 ${1 + grain * 0.35}" result="grainA"/>
    <feComposite in="bled" in2="grainA" operator="in"/>
  </filter>
  <filter id="ink-soft" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="fineN"/>
    <feDisplacementMap in="SourceGraphic" in2="fineN" scale="${rough * 0.8}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
}
