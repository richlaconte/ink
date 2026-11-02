// SVG path data -> polylines, without the DOM (works in Node, workers, SSR).
// Supports M L H V C S Q T A Z in absolute and relative forms.

export type Pt = [number, number];

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function cubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt, step: number) {
  const n = Math.min(200, Math.max(2, Math.ceil((dist(p0, p1) + dist(p1, p2) + dist(p2, p3)) / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
}

function quad(out: Pt[], p0: Pt, p1: Pt, p2: Pt, step: number) {
  const n = Math.min(200, Math.max(2, Math.ceil((dist(p0, p1) + dist(p1, p2)) / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
}

// Elliptical arc via the endpoint -> centre parameterisation (SVG spec, appendix B.2.4).
function arc(out: Pt[], p0: Pt, rx: number, ry: number, rotDeg: number, large: number, sweep: number, p1: Pt, step: number) {
  if (dist(p0, p1) < 1e-9) return;
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) { out.push(p1); return; }
  const phi = (rotDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = cp * cx1 - sp * cy1 + (p0[0] + p1[0]) / 2, cy = sp * cx1 + cp * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy)))));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const ux = (x1 - cx1) / rx, uy = (y1 - cy1) / ry, vx = (-x1 - cx1) / rx, vy = (-y1 - cy1) / ry;
  const t1 = ang(1, 0, ux, uy);
  let dt = ang(ux, uy, vx, vy);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.min(400, Math.max(2, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step)));
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push([cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
}

/** Flatten path data into one polyline per subpath. `step` is the rough segment length, in path units. */
export function flattenPath(d: string, step = 4): Pt[][] {
  const tokens = d.match(TOKEN) || [];
  const paths: Pt[][] = [];
  let cur: Pt[] = [];
  let p: Pt = [0, 0], start: Pt = [0, 0], lastCtrl: Pt | null = null, lastCmd = '';
  let i = 0, cmd = '';
  const num = () => parseFloat(tokens[i++]);
  const begin = (q: Pt) => { if (cur.length > 1) paths.push(cur); cur = [q]; };

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) { i++; continue; }
    const lower = cmd.toLowerCase(), rel = cmd !== cmd.toUpperCase();
    if (lower === 'z') {
      if (cur.length) { if (dist(p, start) > 1e-9) cur.push([...start]); }
      p = [...start]; lastCtrl = null; lastCmd = 'z';
      if (cur.length > 1) paths.push(cur);
      cur = [];
      cmd = '';
      continue;
    }
    if (i + ARGS[lower] > tokens.length) break;
    const ox = rel ? p[0] : 0, oy = rel ? p[1] : 0;
    const prev: Pt = [p[0], p[1]];
    switch (lower) {
      case 'm': {
        p = [ox + num(), oy + num()]; start = [...p]; begin(p);
        cmd = rel ? 'l' : 'L'; // extra pairs are implicit lineto
        lastCtrl = null; lastCmd = 'm';
        continue;
      }
      case 'l': p = [ox + num(), oy + num()]; break;
      case 'h': p = [ox + num(), p[1]]; break;
      case 'v': p = [p[0], oy + num()]; break;
      case 'c': {
        const c1: Pt = [ox + num(), oy + num()], c2: Pt = [ox + num(), oy + num()], e: Pt = [ox + num(), oy + num()];
        if (!cur.length) cur = [p];
        cubic(cur, p, c1, c2, e, step); lastCtrl = c2; p = e; lastCmd = 'c'; continue;
      }
      case 's': {
        const c1: Pt = lastCtrl && (lastCmd === 'c' || lastCmd === 's') ? [2 * p[0] - lastCtrl[0], 2 * p[1] - lastCtrl[1]] : [...p];
        const c2: Pt = [ox + num(), oy + num()], e: Pt = [ox + num(), oy + num()];
        if (!cur.length) cur = [p];
        cubic(cur, p, c1, c2, e, step); lastCtrl = c2; p = e; lastCmd = 's'; continue;
      }
      case 'q': {
        const c: Pt = [ox + num(), oy + num()], e: Pt = [ox + num(), oy + num()];
        if (!cur.length) cur = [p];
        quad(cur, p, c, e, step); lastCtrl = c; p = e; lastCmd = 'q'; continue;
      }
      case 't': {
        const c: Pt = lastCtrl && (lastCmd === 'q' || lastCmd === 't') ? [2 * p[0] - lastCtrl[0], 2 * p[1] - lastCtrl[1]] : [...p];
        const e: Pt = [ox + num(), oy + num()];
        if (!cur.length) cur = [p];
        quad(cur, p, c, e, step); lastCtrl = c; p = e; lastCmd = 't'; continue;
      }
      case 'a': {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
        const e: Pt = [ox + num(), oy + num()];
        if (!cur.length) cur = [p];
        arc(cur, p, rx, ry, rot, large, sweep, e, step); p = e; lastCtrl = null; lastCmd = 'a'; continue;
      }
    }
    if (!cur.length) cur = [prev];
    cur.push([...p]);
    lastCtrl = null; lastCmd = lower;
  }
  if (cur.length > 1) paths.push(cur);
  // A lone moveto (a dot) still deserves ink.
  if (!paths.length && cur.length === 1) paths.push([cur[0], [cur[0][0] + 0.01, cur[0][1] + 0.01]]);
  return paths;
}

/** Flatten then resample each subpath at a uniform spacing (cached). */
const cache = new Map<string, Pt[][]>();
export function samplePath(d: string, step = 4): Pt[][] {
  const key = step + '|' + d;
  let hit = cache.get(key);
  if (!hit) {
    hit = flattenPath(d, step / 2).map((pts) => resample(pts, step));
    cache.set(key, hit);
  }
  return hit;
}

export function arcLengths(pts: Pt[]): Float32Array {
  const s = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) s[i] = s[i - 1] + dist(pts[i - 1], pts[i]);
  return s;
}

/** Resample a polyline at a uniform spacing. */
export function resample(pts: Pt[], step = 2): Pt[] {
  if (pts.length < 2) return pts;
  const s = arcLengths(pts), L = s[s.length - 1];
  if (L === 0) return [pts[0], [pts[0][0] + 0.01, pts[0][1] + 0.01]];
  const n = Math.max(1, Math.round(L / step));
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const t = (L * k) / n;
    while (j < s.length - 2 && s[j + 1] < t) j++;
    const seg = s[j + 1] - s[j] || 1, f = (t - s[j]) / seg;
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
  }
  return out;
}
