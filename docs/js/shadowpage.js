// Shadow analysis page: 2D cross-section, 3D view, light profile and monthly results.
import { CONFIGS } from './knowledge.js';
import { arrayGeometry, analyse, instant, segment, sunVector, dayBounds, MONTH_DOY } from './shadow.js';
import { mount3D, update3D } from './shadow3d.js';

const $ = (s, el = document) => el.querySelector(s);
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '–' : x.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const P = { month: new Date().getMonth(), hour: 10, playing: null, id: null };
const cache = new Map();

export function geomFor(d, e, L) { return arrayGeometry(e, L); }
export function analysisFor(d, e, L) {
  const G = arrayGeometry(e, L);
  const key = [d.id, G.key, G.W, G.P.toFixed(3), G.low, G.tilt].join('|');
  if (!cache.has(key)) {
    if (cache.size > 60) cache.clear();
    cache.set(key, analyse(G, d.lat, Math.min(0.8, Math.max(0.15, d.dif / d.ghi)), d.ghim));
  }
  return { G, A: cache.get(key) };
}

export function shadowSummaryHTML(d, e, L) {
  const { A } = analysisFor(d, e, L);
  const mini = (k, v, u) => `<div class="mini"><div class="k">${k}</div><div class="v">${v}<small> ${u}</small></div></div>`;
  return `<div class="mini-grid">
    ${mini('Ground light', fmt(A.mean * 100), '% of open')}
    ${mini('Uniformity', fmt(A.uniformity, 2), 'min/max')}
    ${mini('Module shading', fmt(A.modLoss * 100, 1), '% beam')}
  </div><p class="hint" style="margin:6px 0 0">Geometric ray tracing over 12 representative days. The screening model above assumes ${fmt(e.shade * 100)}% light reduction; geometry gives ${fmt((1 - A.mean) * 100)}%.</p>`;
}

let ctxRef = null;
export function initShadowPage(ctx) {
  ctxRef = ctx;
  const opts = [...ctx.D].sort((a, b) => a.st.localeCompare(b.st) || a.d.localeCompare(b.d)).map(d => `<option value="${d.id}">${esc(d.d)} · ${esc(d.st)}</option>`).join('');
  $('#sh-controls').innerHTML = `
    <h2 style="margin:0 0 8px">Settings</h2>
    <div class="field"><div class="field-head">District</div><select id="sh-d">${opts}</select></div>
    <div class="field"><div class="field-head">Configuration</div><select id="sh-cfg"><option value="auto">Best fit for the climate zone (auto)</option>${Object.entries(CONFIGS).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('')}</select></div>
    <div class="field"><div class="field-head">GCR<output id="sh-o-gcr"></output></div><input type="range" id="sh-gcr" min="0.10" max="0.60" step="0.01"></div>
    <div class="field" id="sh-f-h"><div class="field-head">Clearance height<output id="sh-o-h"></output></div><input type="range" id="sh-h" min="2.1" max="6" step="0.1"></div>
    <div class="field"><div class="field-head">Month<output id="sh-o-m"></output></div><input type="range" id="sh-m" min="0" max="11" step="1"></div>
    <div class="field"><div class="field-head">Solar time<output id="sh-o-t"></output></div><input type="range" id="sh-t" min="5" max="19" step="0.25"></div>
    <div class="play"><button class="btn" id="sh-play">▶ Play the day</button></div>
    <p class="hint" style="margin-top:12px">Configuration, GCR and height are the same levers as on the dashboard, so changes here update the map too. Tilt follows the climate zone: ≈ latitude adjusted for the Köppen class.</p>`;
  const L = ctx.S.L;
  $('#sh-d').onchange = e => { P.id = +e.target.value; ctx.select(P.id); renderShadowPage(ctx); };
  $('#sh-cfg').onchange = e => { L.config = e.target.value; if (e.target.value !== 'auto') L.gcr = CONFIGS[e.target.value].gcr; ctx.onLever(); };
  $('#sh-gcr').oninput = e => { L.gcr = +e.target.value; L.gcrAuto = false; ctx.onLever(); };
  $('#sh-h').oninput = e => { L.height = +e.target.value; ctx.onLever(); };
  $('#sh-m').oninput = e => { P.month = +e.target.value; renderShadowPage(ctx, true); };
  $('#sh-t').oninput = e => { P.hour = +e.target.value; renderShadowPage(ctx, true); };
  $('#sh-play').onclick = () => {
    if (P.playing) { clearInterval(P.playing); P.playing = null; $('#sh-play').textContent = '▶ Play the day'; return; }
    $('#sh-play').textContent = '❚❚ Pause';
    P.playing = setInterval(() => { P.hour += 0.25; if (P.hour > 19) P.hour = 5; renderShadowPage(ctx, true); }, 120);
  };
}

function pickDistrict(ctx) {
  if (ctx.S.selected) P.id = ctx.S.selected;
  if (!P.id || !ctx.byId.get(P.id)) {
    let best = null;
    for (const d of ctx.D) { const t = ctx.T.get(d.id); if (!best || t.s > ctx.T.get(best.id).s) best = d; }
    P.id = best.id;
  }
  return ctx.byId.get(P.id);
}

export async function renderShadowPage(ctx, light = false) {
  if (!ctx || !ctx.T.size) return;
  const d = pickDistrict(ctx), L = ctx.S.L, e = ctx.T.get(d.id).e;
  const { G, A } = analysisFor(d, e, L);
  const doy = MONTH_DOY[P.month];
  const [t0, t1] = dayBounds(d.lat, doy);
  const I = instant(G, d.lat, doy, P.hour);
  // controls
  $('#sh-d').value = d.id; $('#sh-cfg').value = L.config;
  $('#sh-gcr').value = e.gcr; $('#sh-o-gcr').textContent = fmt(e.gcr, 2) + (L.gcrAuto ? ' (zone)' : '');
  $('#sh-h').value = L.height; $('#sh-o-h').textContent = e.cfgKey === 'elevated' ? fmt(L.height, 1) + ' m' : 'fixed by type';
  $('#sh-f-h').style.opacity = e.cfgKey === 'elevated' ? 1 : .5;
  $('#sh-m').value = P.month; $('#sh-o-m').textContent = MN[P.month];
  $('#sh-t').value = P.hour; $('#sh-o-t').textContent = `${String(Math.floor(P.hour)).padStart(2, '0')}:${String(Math.round((P.hour % 1) * 60)).padStart(2, '0')}`;
  // KPIs
  const k = (lab, v, u, cls = '') => `<div class="kpi ${cls}"><div class="k">${lab}</div><div class="v">${v}<small>${u}</small></div></div>`;
  const mo = A.months[P.month];
  $('#sh-kpis').innerHTML =
    k('Ground light, year', fmt(A.mean * 100), '% of open', 'accent') +
    k(`Ground light, ${MN[P.month]}`, fmt(mo.mean * 100), '%') +
    k('Light uniformity', fmt(A.uniformity, 2), 'min/max') +
    k('Direct sun at ground', fmt(A.sunHours, 1), 'h/day avg') +
    k('Module row shading', fmt(A.modLoss * 100, 1), '% of beam');
  $('#sh-2d').innerHTML = crossSection(G, I, d, e, t0, t1);
  if (!light) {
    $('#sh-profile').innerHTML = profileChart(G, A, P.month);
    $('#sh-month').innerHTML = monthCharts(A);
  } else {
    $('#sh-profile').innerHTML = profileChart(G, A, P.month);
  }
  const ok = await mount3D($('#sh-3d'));
  if (ok) update3D(G, I.sun);
}

// ---------------------------------------------------------------- 2D cross-section
function crossSection(G, I, d, e, t0, t1) {
  const Wv = 900, Hv = 330, groundY = 270;
  const u0 = -G.P, u1 = 2 * G.P;
  const zmax = Math.max(G.low + G.W + 1.5, G.hub + G.W / 2 + 1.5, 6);
  const sx = Wv / (u1 - u0), sz = Math.min(sx, (groundY - 30) / zmax);
  const X = u => (u - u0) * sx, Y = z => groundY - z * sz;
  const sun = I.sun, night = sun.up <= 0;
  const [lu, ru] = G.nsRows ? ['West', 'East'] : ['South', 'North'];
  let svg = `<svg class="chart" viewBox="0 0 ${Wv} ${Hv}" role="img" aria-label="Cross-section of panel rows with shadows">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#1d2b45' : '#bfe0f5'}"/><stop offset="1" stop-color="${night ? '#33415e' : '#eef7fc'}"/></linearGradient></defs>
    <rect x="0" y="0" width="${Wv}" height="${groundY}" fill="url(#sky)"/>
    <rect x="0" y="${groundY}" width="${Wv}" height="${Hv - groundY}" fill="#e9dcc0"/>`;
  // ground light/shadow band
  const step = I.ground[1].u - I.ground[0].u;
  I.ground.forEach(g => { svg += `<rect x="${X(g.u - step / 2)}" y="${groundY}" width="${step * sx + 0.6}" height="8" fill="${g.lit ? '#f6d36b' : '#5b5346'}"/>`; });
  // crops
  for (let u = u0 + 0.3; u < u1; u += 0.6) {
    const near = [...Array(5)].some((_, i) => { const kk = Math.round(u / G.P) - 2 + i; return G.key !== 'elevated' && G.key !== 'greenhouse' && Math.abs(u - kk * G.P) < (G.key === 'vertical' ? 0.5 : G.W / 2 * 0.6 + 0.3); });
    if (near) continue;
    const lit = I.ground.reduce((b, g) => Math.abs(g.u - u) < Math.abs(b.u - u) ? g : b).lit;
    svg += `<path d="M${X(u)},${groundY} q-6,-10 -2,-20 M${X(u)},${groundY} q6,-12 2,-24 M${X(u)},${groundY} v-16" stroke="${lit ? '#3f8f46' : '#2c5a30'}" stroke-width="2" fill="none"/>`;
  }
  // panels and posts
  const kMin = Math.floor(u0 / G.P) - 1, kMax = Math.ceil(u1 / G.P) + 1;
  for (let kk = kMin; kk <= kMax; kk++) {
    const s = segment(G, kk, sun);
    const postU = [s[0], s[2]], postZ = [s[1], s[3]];
    if (G.key === 'vertical') svg += `<line x1="${X(s[0])}" y1="${groundY}" x2="${X(s[0])}" y2="${Y(s[3])}" stroke="#9aa3ad" stroke-width="3"/>`;
    else if (G.key === 'tracker') svg += `<line x1="${X(kk * G.P)}" y1="${groundY}" x2="${X(kk * G.P)}" y2="${Y(G.hub)}" stroke="#9aa3ad" stroke-width="4"/>`;
    else postU.forEach((pu, i) => { svg += `<line x1="${X(pu)}" y1="${groundY}" x2="${X(pu)}" y2="${Y(postZ[i])}" stroke="#9aa3ad" stroke-width="3"/>`; });
    svg += `<line x1="${X(s[0])}" y1="${Y(s[1])}" x2="${X(s[2])}" y2="${Y(s[3])}" stroke="#1f3663" stroke-width="7" stroke-linecap="round"/>`;
    if (kk === 0 && I.moduleShade > 0) {
      // shaded portion of the centre row (from the lower edge)
      const f = I.moduleShade;
      svg += `<line x1="${X(s[0])}" y1="${Y(s[1])}" x2="${X(s[0] + f * (s[2] - s[0]))}" y2="${Y(s[1] + f * (s[3] - s[1]))}" stroke="#c0564b" stroke-width="7" stroke-linecap="round"/>`;
    }
  }
  // sun rays through the panel edges of the centre rows
  if (!night) {
    const len = 60;
    for (let kk = 0; kk <= 1; kk++) {
      const s = segment(G, kk, sun);
      for (const [pu, pz] of [[s[0], s[1]], [s[2], s[3]]]) {
        const t = pz / I.dz, gu = pu - I.du * t;
        svg += `<line x1="${X(pu + I.du * len)}" y1="${Y(pz + I.dz * len)}" x2="${X(gu)}" y2="${groundY}" stroke="#f6b31f" stroke-width="1.4" stroke-dasharray="5 4" opacity=".9"/>`;
      }
    }
    // sun glyph on the extension of the ray through the centre row's upper edge
    const s0 = segment(G, 0, sun), [eu, ez] = s0[1] > s0[3] ? [s0[0], s0[1]] : [s0[2], s0[3]];
    const top = 24, tz = (Y(ez) - top) / sz / Math.max(1e-6, I.dz);
    let gx = X(eu + I.du * tz), gy = top;
    if (gx < 20 || gx > Wv - 20) { const ux = gx < 20 ? 20 : Wv - 20, tu = (ux / sx + u0 - eu) / (I.du || 1e-6); gx = ux; gy = Math.max(top, Y(ez + I.dz * tu)); }
    svg += `<circle cx="${gx}" cy="${gy}" r="13" fill="#f6b31f" stroke="#fff" stroke-width="2"/>`;
  }
  // dimensions and labels
  svg += `<line x1="${X(0)}" y1="${Hv - 30}" x2="${X(G.P)}" y2="${Hv - 30}" stroke="#13322c" stroke-width="1.2"/>
    <line x1="${X(0)}" y1="${Hv - 36}" x2="${X(0)}" y2="${Hv - 24}" stroke="#13322c"/><line x1="${X(G.P)}" y1="${Hv - 36}" x2="${X(G.P)}" y2="${Hv - 24}" stroke="#13322c"/>
    <text x="${X(G.P / 2)}" y="${Hv - 36}" font-size="12" text-anchor="middle" fill="#13322c" font-weight="700">row pitch ${fmt(G.P, 1)} m</text>
    <text x="10" y="${Hv - 8}" font-size="12" fill="#64748b" font-weight="700">← ${lu}</text>
    <text x="${Wv - 10}" y="${Hv - 8}" font-size="12" fill="#64748b" text-anchor="end" font-weight="700">${ru} →</text>
    <text x="12" y="20" font-size="12" fill="${night ? '#f5e8c9' : '#13322c'}" font-weight="700">${esc(d.d)} · ${MN[P.month]} 15 · ${$('#sh-o-t').textContent} solar time</text>
    <text x="12" y="38" font-size="12" fill="${night ? '#f5e8c9' : '#13322c'}">${night ? 'Sun below the horizon' : `Sun elevation ${fmt(sun.elev, 1)}°, azimuth ${fmt(sun.azimuth)}°`} · day length ${fmt(t1 - t0, 1)} h</text>
    <text x="12" y="56" font-size="12" fill="${night ? '#f5e8c9' : '#13322c'}">${esc(CONFIGS[G.key].short)} · GCR ${fmt(e.gcr, 2)} · ${G.key === 'tracker' ? 'tracking ±55°' : G.key === 'vertical' ? 'vertical' : `tilt ${G.tilt}°`} · ${G.key === 'vertical' ? 'panel base' : 'lower edge'} ${fmt(G.key === 'tracker' ? G.hub : G.low, 1)} m</text>
    </svg>
    <div class="sh-legend"><span><i class="sw" style="background:#f6d36b"></i>Ground in direct sun</span><span><i class="sw" style="background:#5b5346"></i>Ground in panel shadow</span>
      <span><i class="sw" style="background:#1f3663"></i>Module</span><span><i class="sw" style="background:#c0564b"></i>Module shaded by the next row (${fmt(I.moduleShade * 100)}% now)</span>
      <span><i class="sw" style="background:#f6b31f"></i>Sun rays</span></div>`;
  return svg;
}

// ---------------------------------------------------------------- charts
function profileChart(G, A, m) {
  const W = 560, H = 220, pad = { l: 40, r: 12, t: 14, b: 30 };
  const xs = u => pad.l + (W - pad.l - pad.r) * u / G.P, ys = v => pad.t + (H - pad.t - pad.b) * (1 - v);
  const line = arr => A.us.map((u, i) => `${xs(u)},${ys(arr[i])}`).join(' ');
  const yt = [0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="#efe9d8"/><text x="${pad.l - 6}" y="${ys(v) + 3}" font-size="10" text-anchor="end" fill="#64748b">${v * 100}%</text>`).join('');
  const mo = A.months[m].light;
  const hov = A.us.map((u, i) => `<g><title>${fmt(u, 1)} m: year ${fmt(A.light[i] * 100)}%, ${MN[m]} ${fmt(mo[i] * 100)}%, sky view ${fmt(A.svf[i] * 100)}%</title><rect x="${xs(u) - (W - pad.l - pad.r) / A.us.length / 2}" y="${pad.t}" width="${(W - pad.l - pad.r) / A.us.length}" height="${H - pad.t - pad.b}" fill="transparent"/></g>`).join('');
  const iMin = A.light.indexOf(A.min);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Light across one row pitch">${yt}
    <polyline points="${line(A.light)}" fill="none" stroke="#13322c" stroke-width="2.2"/>
    <polyline points="${line(mo)}" fill="none" stroke="#f6b31f" stroke-width="2"/>
    <circle cx="${xs(A.us[iMin])}" cy="${ys(A.min)}" r="4" fill="#13322c" stroke="#fff" stroke-width="2"/>
    <text x="${xs(A.us[iMin])}" y="${ys(A.min) + 16}" font-size="10" text-anchor="middle" fill="#1f2937" font-weight="700">min ${fmt(A.min * 100)}%</text>
    <text x="${pad.l}" y="${H - 8}" font-size="10" fill="#64748b">0 m (row centre)</text><text x="${W - pad.r}" y="${H - 8}" font-size="10" text-anchor="end" fill="#64748b">${fmt(G.P, 1)} m (next row)</text>
    ${hov}</svg>
    <div class="sh-legend"><span><i class="sw" style="background:#13322c"></i>Annual average</span><span><i class="sw" style="background:#f6b31f"></i>${MN[m]}</span><span>Daily light (direct + diffuse) at crop height, % of an open field</span></div>`;
}
function bars(vals, fmtv, color, label, maxv) {
  const W = 560, H = 130, pad = { l: 6, r: 6, t: 16, b: 18 }, bw = (W - pad.l - pad.r) / 12;
  const mx = maxv || Math.max(...vals) || 1;
  return `<div class="chart-title"><span>${label}</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <line x1="0" x2="${W}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="#e6dec8"/>${vals.map((v, i) => {
      const h = (H - pad.t - pad.b) * v / mx, x = pad.l + i * bw + 4, w = bw - 8, y = H - pad.b - h, r = Math.min(4, h / 2);
      return `<g><title>${MN[i]}: ${fmtv(v)}</title><path d="M${x},${H - pad.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H - pad.b} Z" fill="${color}"/>
      <text x="${x + w / 2}" y="${y - 3}" font-size="9" text-anchor="middle" fill="#1f2937">${fmtv(v)}</text><text x="${x + w / 2}" y="${H - 5}" font-size="9" text-anchor="middle" fill="#64748b">${MN[i][0]}</text></g>`;
    }).join('')}</svg>`;
}
function monthCharts(A) {
  return bars(A.months.map(m => m.mean * 100), v => fmt(v) + '%', '#5fb78f', 'Crop side: ground light, % of open field', 100) +
    bars(A.months.map(m => m.modLoss * 100), v => fmt(v, 1) + '%', '#c0564b', 'Solar side: row-to-row shading loss of direct sun on modules') +
    `<p class="hint">Kharif (Jun–Sep) and rabi (Oct–Mar) crops see different light: the low winter sun makes longer shadows on east–west rows.</p>`;
}
