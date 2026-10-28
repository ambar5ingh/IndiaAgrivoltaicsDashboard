// Shadow analysis for infinite parallel rows: sun position, 2D cross-section ray tracing of
// ground light (crop side) and row-to-row shading of modules (solar side).
import { CONFIGS } from './knowledge.js';

const RAD = Math.PI / 180;
export const MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

// Sun vector in east-north-up for latitude (deg), day of year and local solar time (h)
export function sunVector(lat, doy, hour) {
  const dec = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * RAD;
  const w = 15 * (hour - 12) * RAD, phi = lat * RAD;
  const up = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(w);
  const east = -Math.cos(dec) * Math.sin(w);
  const north = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(w);
  return { east, north, up, elev: Math.asin(Math.max(-1, Math.min(1, up))) / RAD, azimuth: (Math.atan2(east, north) / RAD + 360) % 360 };
}
export function dayBounds(lat, doy) {
  const dec = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * RAD;
  const x = -Math.tan(lat * RAD) * Math.tan(dec);
  const ws = Math.acos(Math.max(-1, Math.min(1, x))) / RAD / 15;
  return [12 - ws, 12 + ws];
}
// Clear-sky direct normal irradiance (Meinel), W/m2
function dni(elev) {
  if (elev <= 0.5) return 0;
  const am = 1 / (Math.sin(elev * RAD) + 0.50572 * Math.pow(elev + 6.07995, -1.6364));
  return 1361 * Math.pow(0.7, Math.pow(am, 0.678));
}

// Array geometry from the levers. u axis runs across the rows: north for east-west rows, east for north-south rows.
export function arrayGeometry(e, L) {
  const c = CONFIGS[e.cfgKey];
  const W = c.collector, P = e.pitch;
  const nsRows = e.cfgKey === 'tracker' || e.cfgKey === 'vertical';
  const low = e.cfgKey === 'elevated' ? L.height : e.cfgKey === 'greenhouse' ? 3.0 : c.height;
  return { key: e.cfgKey, W, P, nsRows, low, tilt: e.tilt, hub: low + W / 2 * Math.sin(55 * RAD) };
}

// Panel segment of row k for the current sun (trackers follow the sun, limited to ±55°)
export function segment(G, k, sun) {
  const uc = k * G.P;
  if (G.key === 'vertical') return [uc, G.low, uc, G.low + G.W];
  if (G.key === 'tracker') {
    let th = sun && sun.up > 0 ? Math.atan2(sun.east, sun.up) : 0;
    th = Math.max(-55 * RAD, Math.min(55 * RAD, th));
    const tx = Math.cos(th) * G.W / 2, tz = Math.sin(th) * G.W / 2;
    return [uc - tx, G.hub + tz, uc + tx, G.hub - tz];
  }
  const b = G.tilt * RAD, hx = Math.cos(b) * G.W / 2;
  return [uc - hx, G.low, uc + hx, G.low + G.W * Math.sin(b)]; // lower (south) edge first
}

// Does the ray from (px, pz) in direction (du, dz) hit segment s?
function hits(px, pz, du, dz, s) {
  const ex = s[2] - s[0], ez = s[3] - s[1];
  const den = du * ez - dz * ex;
  if (Math.abs(den) < 1e-12) return false;
  const t = ((s[0] - px) * ez - (s[1] - pz) * ex) / den;
  const v = ((s[0] - px) * dz - (s[1] - pz) * du) / den;
  return t > 1e-6 && v >= 0 && v <= 1;
}
function blocked(G, px, pz, du, dz, sun, skip) {
  const k0 = Math.floor(px / G.P);
  for (let k = k0 - 8; k <= k0 + 8; k++) {
    if (k === skip) continue;
    if (hits(px, pz, du, dz, segment(G, k, sun))) return true;
  }
  return false;
}
const proj = (G, sun) => G.nsRows ? [sun.east, sun.up] : [sun.north, sun.up];

// Sky view factor of a ground point (2D, isotropic sky)
function skyView(G, u) {
  let v = 0, tot = 0;
  for (let a = -88.5; a <= 88.5; a += 3) {
    const w = Math.cos(a * RAD); tot += w;
    if (!blocked(G, u, 0, Math.sin(a * RAD), Math.cos(a * RAD), { east: 0, north: 0, up: 1 })) v += w;
  }
  return v / tot;
}

// Plane-of-array beam incidence for row orientation and sun
function cosInc(G, sun, seg) {
  if (G.key === 'vertical') return Math.abs(sun.east); // bifacial: one face always lit
  if (G.key === 'tracker') { const th = Math.atan2(seg[1] - seg[3], seg[2] - seg[0]); return Math.max(0, Math.sin(th) * sun.east + Math.cos(th) * sun.up); }
  const b = G.tilt * RAD;
  return Math.max(0, -Math.sin(b) * sun.north + Math.cos(b) * sun.up);
}

// Instantaneous state for drawing
export function instant(G, lat, doy, hour, n = 120) {
  const sun = sunVector(lat, doy, hour);
  const [du, dz] = proj(G, sun);
  const ground = [];
  for (let i = 0; i < n; i++) {
    const u = -G.P + (3 * G.P) * i / (n - 1);
    ground.push({ u, lit: sun.up > 0 && !blocked(G, u, 0, du, dz, sun, null) });
  }
  // shaded share of the centre module's surface
  const s0 = segment(G, 0, sun);
  let sh = 0;
  for (let i = 0; i < 20; i++) {
    const f = (i + 0.5) / 20, px = s0[0] + f * (s0[2] - s0[0]), pz = s0[1] + f * (s0[3] - s0[1]);
    if (sun.up > 0 && blocked(G, px, pz, du, dz, sun, 0)) sh++;
  }
  return { sun, du, dz, ground, moduleShade: sh / 20 };
}

// Daily and annual integration. kd = diffuse fraction of GHI, ghim = monthly GHI (weights).
export function analyse(G, lat, kd, ghim, npts = 48) {
  const us = Array.from({ length: npts }, (_, i) => (i + 0.5) * G.P / npts);
  const svf = G.key === 'tracker' ? us.map(u => skyView({ ...G, key: 'flat', tilt: 0, low: G.hub }, u)) : us.map(u => skyView(G, u));
  const months = [];
  for (let m = 0; m < 12; m++) {
    const doy = MONTH_DOY[m];
    const [t0, t1] = dayBounds(lat, doy);
    let bTot = 0, beamLit = new Float64Array(npts), sunH = new Float64Array(npts), modB = 0, modSh = 0;
    const dt = 1 / 6;
    for (let h = t0 + dt / 2; h < t1; h += dt) {
      const sun = sunVector(lat, doy, h);
      if (sun.up <= 0.01) continue;
      const bh = dni(sun.elev) * sun.up;
      bTot += bh;
      const [du, dz] = proj(G, sun);
      for (let i = 0; i < npts; i++) if (!blocked(G, us[i], 0, du, dz, sun, null)) { beamLit[i] += bh; sunH[i] += dt; }
      const s0 = segment(G, 0, sun), ci = cosInc(G, sun, s0) * dni(sun.elev);
      if (ci > 0) {
        let sh = 0;
        for (let j = 0; j < 10; j++) {
          const f = (j + 0.5) / 10, px = s0[0] + f * (s0[2] - s0[0]), pz = s0[1] + f * (s0[3] - s0[1]);
          if (blocked(G, px, pz, du, dz, sun, 0)) sh++;
        }
        modB += ci; modSh += ci * sh / 10;
      }
    }
    const dTot = bTot * kd / (1 - kd);
    const light = us.map((u, i) => (beamLit[i] + dTot * svf[i]) / (bTot + dTot));
    months.push({ light, mean: light.reduce((a, b) => a + b, 0) / npts, sunH: Array.from(sunH), dayLen: t1 - t0, modLoss: modB ? modSh / modB : 0 });
  }
  const wts = ghim.map((g, m) => g * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]);
  const wsum = wts.reduce((a, b) => a + b, 0);
  const light = us.map((u, i) => months.reduce((s, mo, m) => s + mo.light[i] * wts[m], 0) / wsum);
  const mean = light.reduce((a, b) => a + b, 0) / npts;
  const min = Math.min(...light), max = Math.max(...light);
  const modLoss = months.reduce((s, mo, m) => s + mo.modLoss * wts[m], 0) / wsum;
  const sunHours = months.reduce((s, mo) => s + mo.sunH.reduce((a, b) => a + b, 0) / npts, 0) / 12;
  return { us, svf, months, light, mean, min, max, uniformity: max > 0 ? min / max : 0, modLoss, sunHours };
}
