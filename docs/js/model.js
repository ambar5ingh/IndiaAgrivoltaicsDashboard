// Agrivoltaic screening model: one district + one set of levers -> design and results.
import { KOPPEN, CROPS, CONFIGS, MODULES, GRID_EF, REF_GCR } from './knowledge.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function koppenOf(d) { return KOPPEN[d.kg] || KOPPEN.Aw; }

export function aridity(d) { return clamp((1500 - d.rain) / 1300, 0, 1); }

export function betaOf(d) {
  const k = koppenOf(d);
  return k.beta + Math.min(0.10, 0.01 * (d.hot || 0)) * (k.beta > 0 ? 1 : 0);
}

export function cropFor(d, L) {
  if (L.crop !== 'auto') return L.crop;
  const list = koppenOf(d).crops;
  return list && list.length ? list[0] : 'leafy';
}

export function configFor(d, L) {
  if (L.config !== 'auto') return L.config;
  const c = koppenOf(d).config;
  return CONFIGS[c] ? c : 'elevated';
}

export const moduleOf = L => MODULES[L.module] || MODULES.topcon;

// Year-1 specific yield, kWh/kWp/yr (reference = conventional fixed-tilt plant with the same modules)
export function specificYield(d, cfgKey, L, reference = false) {
  const c = CONFIGS[cfgKey];
  const m = moduleOf(L);
  const lat = Math.abs(d.lat);
  const ftilt = (1 + 0.0045 * lat) * (reference ? 1 : c.ftilt);
  const k = koppenOf(d);
  const tcell = d.t + 24 - (reference ? 0 : c.tcool) - 1.0 * ((d.ws || 2) - 2);
  const tloss = (-m.gamma / 100) * Math.max(0, tcell - 25);
  const soil = k.soil;
  let bif = 0;
  if (!reference && L.bifacial && m.bifi > 0) bif = clamp(c.bif + (cfgKey === 'elevated' ? 0.01 * (L.height - 3) : 0), 0, 0.08) * (m.bifi / 0.7);
  // vertical E-W systems rely on the rear face: monofacial modules lose about 40% of their output there
  const fvert = cfgKey === 'vertical' && !reference && !(L.bifacial && m.bifi > 0) ? 0.6 : 1;
  return d.ghi * 365 * ftilt * (1 - tloss) * (1 - soil) * 0.86 * m.lowLight * (1 + bif) * fvert; // 14% system losses
}

// Lifetime-average output factor for linear degradation over n years
export const degAvg = (deg, n = 25) => 1 - deg / 100 * (n - 1) / 2;

// IRR by bisection on a cash-flow array (index 0 = year 0)
export function irr(cf) {
  const npv = r => cf.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.5, hi = 1.0;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; (npv(lo) * npv(mid) <= 0) ? hi = mid : lo = mid; }
  return (lo + hi) / 2;
}

// 25-year project cash flows per MWp (Rs): capex in year 0, tariff revenue on a degrading yield, O&M escalating 3%/yr
export function cashflows(Y1, capex, L, deg, extraPerMW = 0) {
  const cf = [-capex * 1e7];
  for (let y = 1; y <= 25; y++) {
    const e = Y1 * 1000 * Math.pow(1 - deg / 100, y - 1); // kWh per MWp
    cf.push(e * L.tariff - L.om * 1e5 * Math.pow(1.03, y - 1) + extraPerMW);
  }
  return cf;
}

// grid access: distance from the district's interior point to the nearest >=66 kV substation and line density
export function gridScore(d) {
  const g = d.grid;
  if (!g) return 0.5;
  const fd = g.dsub == null ? 0 : clamp(1 - g.dsub / 60, 0, 1);
  const fl = clamp(g.dens / 10, 0, 1);
  return 0.6 * fd + 0.4 * fl;
}

export function suitability(d, W) {
  const k = koppenOf(d);
  const crop = (d.lc && d.lc.crop) || 0;
  const fs = clamp((d.ghi - 4.0) / 1.8, 0, 1);
  const fc = clamp(crop / 0.75, 0, 1);
  const fb = clamp(betaOf(d) / 0.6, 0, 1);
  const fw = aridity(d);
  const fg = gridScore(d);
  const wg = W.grid || 0;
  const wsum = W.solar + W.crop + W.cobenefit + W.water + wg || 1;
  let s = (W.solar * fs + W.crop * fc + W.cobenefit * fb + W.water * fw + wg * fg) / wsum;
  if (k.group === 'D' || k.group === 'E') s *= 0.4;
  if (d.lc && d.lc.tree > 0.6) s *= 0.7;
  return Math.round(100 * s);
}

export function evaluate(d, L) {
  const cfgKey = configFor(d, L);
  const c = CONFIGS[cfgKey];
  const k = koppenOf(d);
  const cropKey = cropFor(d, L);
  const crop = CROPS[cropKey];
  const gcr = L.gcrAuto ? (k.gcr[0] + k.gcr[1]) / 2 || c.gcr : L.gcr;
  const eff = L.eff / 100;
  const mod = moduleOf(L);
  const Y1 = specificYield(d, cfgKey, L);
  const Y = Y1 * degAvg(mod.deg);
  const Yref = specificYield(d, cfgKey, L, true) * degAvg(mod.deg);
  const density = gcr * eff * 10; // MWp/ha
  const eHa = density * Y; // MWh/ha/yr
  const eRef = REF_GCR * eff * 10 * Yref;
  const elecRel = eHa / eRef;
  const shade = clamp(gcr * c.kshade, 0, 0.9);
  const beta = betaOf(d);
  const ry = clamp(1 - crop.alpha * shade + beta * shade, 0.2, 1.2);
  const cropRel = ry * (1 - c.landLoss);
  const ler = cropRel + elecRel;
  const water = 0.6 * shade * (0.6 + 0.4 * aridity(d));
  const heightPrem = cfgKey === 'elevated' ? 0.04 * Math.max(0, L.height - 3) : 0;
  const capex = L.capex * (1 + c.prem + heightPrem + mod.capexAdj); // Rs crore / MWp
  const r = L.rate / 100, n = 25;
  const crf = r > 0 ? r / (1 - Math.pow(1 + r, -n)) : 1 / n;
  const lcoe = (capex * 1e7 * crf + L.om * 1e5) / (Y * 1000); // Rs/kWh
  const margin = L.marginAuto ? crop.margin : L.margin;
  const revElec = eHa * 1000 * L.tariff; // Rs/ha/yr
  const revCrop = cropRel * margin;
  const costElec = density * (capex * 1e7 * crf + L.om * 1e5);
  const cf = cashflows(Y1, capex, L, mod.deg);
  const irrP = irr(cf);
  // system view: add the change in crop margin on the land each MWp occupies (1 / density ha)
  const cropDelta = (cropRel - 1) * margin / density;
  const irrS = irr(cashflows(Y1, capex, L, mod.deg, cropDelta));
  let cum = cf[0], payback = NaN;
  for (let y = 1; y < cf.length; y++) { cum += cf[y]; if (cum >= 0) { payback = y - 1 + (cf[y] - cum) / cf[y]; break; } }
  const npv = cf.reduce((s2, x, t) => s2 + x / Math.pow(1 + r, t), 0) / 1e7; // Rs crore per MWp
  const tilt = c.tiltFixed ? Math.round(clamp(Math.abs(d.lat) + k.tiltAdj, 8, 45)) : (cfgKey === 'vertical' ? 90 : 0);
  const pitch = cfgKey === 'vertical' ? c.collector / gcr : c.collector / gcr;
  return {
    cfgKey, cfg: c, mod, cropKey, crop, gcr, Y1, Y, Yref, cf, irr: irrP, irrSys: irrS, payback, npv, cuf: Y / 8760, density, eHa, elecRel, shade, beta, ry, cropRel, ler, water,
    capex, lcoe, margin, revElec, revCrop, netElec: revElec - costElec, tilt, pitch,
  };
}

// District totals under the scenario
export function districtTotals(d, L, W) {
  const s = suitability(d, W);
  const e = evaluate(d, L);
  const cropHa = d.area * 100 * ((d.lc && d.lc.crop) || 0);
  const eligible = s >= L.threshold;
  const ha = eligible ? cropHa * L.adoption / 100 : 0;
  const mw = ha * e.density;
  const gwh = mw * e.Y / 1000;
  return { s, e, cropHa, eligible, ha, mw, gwh, inv: mw * e.capex, co2: gwh * GRID_EF / 1000 }; // inv Rs crore, co2 Mt
}
