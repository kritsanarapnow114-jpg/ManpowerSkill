import { clamp, escapeHtml } from "./format.js";

// Renders a radar/spider chart as an inline SVG string.
// axes: [{ label: string (may contain \n for line breaks), v: 0-100 }]
export function radarSVG(axes, color, fill) {
  const R = 95, cx = 155, cy = 140, n = axes.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

  const gridRings = [0.25, 0.5, 0.75, 1].map((rr, ri) => {
    const points = axes.map((_, i) => pt(i, R * rr).join(",")).join(" ");
    const fillAttr = ri === 3 ? "#f4f8fb" : "none";
    return `<polygon points="${points}" fill="${fillAttr}" stroke="#d8e0e7" stroke-width="1"/>`;
  }).join("");

  const spokes = axes.map((_, i) => {
    const [x2, y2] = pt(i, R);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#d8e0e7" stroke-width="1"/>`;
  }).join("");

  const dp = axes.map((a, i) => pt(i, (R * clamp(a.v)) / 100));
  const poly = `<polygon points="${dp.map((p) => p.join(",")).join(" ")}" fill="${fill}" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
  const dots = dp.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="#fff" stroke="${color}" stroke-width="2"/>`).join("");

  const labels = axes.map((a, i) => {
    const p = pt(i, R + 20);
    const [lx, ly] = p;
    const c = Math.cos(ang(i)), s = Math.sin(ang(i));
    const anchor = Math.abs(c) < 0.35 ? "middle" : c > 0 ? "start" : "end";
    const lines = String(a.label).split("\n");
    let y0 = ly;
    if (s < -0.35) y0 = ly - lines.length * 11;
    const tsp = lines
      .map((ln, li) => `<text x="${lx}" y="${y0 + li * 11}" text-anchor="${anchor}" font-size="9.5" font-weight="600" fill="#42525f">${escapeHtml(ln)}</text>`)
      .join("");
    const val = `<text x="${lx}" y="${y0 + lines.length * 11 + 2}" text-anchor="${anchor}" font-size="12" font-weight="800" fill="${color}">${clamp(a.v)}%</text>`;
    return tsp + val;
  }).join("");

  return `<svg viewBox="0 0 310 300" style="width:100%;max-width:340px;overflow:visible;display:block;margin:0 auto">${gridRings}${spokes}${poly}${dots}${labels}</svg>`;
}
