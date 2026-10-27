// Agrivoltaic screening model: one district + one set of levers -> design and results.
import { KOPPEN, CROPS, CONFIGS, GRID_EF, REF_GCR } from './knowledge.js';

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

// Specific yield, kWh/kWp/yr
export function specificYield(d, cfgKey, L, reference = false) {
  const c = CONFIGS[cfgKey];
  const lat = Math.abs(d.lat);
  const ftilt = (1 + 0.0045 * lat) * (reference ? 1 : c.ftilt);
  const k = koppenOf(d);
  const tcell = d.t + 24 - (reference ? 0 : c.tcool) - 1.0 * ((d.ws || 2) - 2);
  const tloss = 0.0035 * Math.max(0, tcell - 25);
  const soil = k.soil;
  let bif = 0;
  if (!reference && L.bifacial) bif = clamp(c.bif + (cfgKey === 'elevated' ? 0.01 * (L.height - 3) : 0), 0, 0.08);
  return d.ghi * 365 * ftilt * (1 - tloss) * (1 - soil) * 0.86 * 0.94 * (1 + bif); // 14% system losses, 6% lifetime-average degradation
}

export function suitability(d, W) {
  const k = koppenOf(d);
  const crop = (d.lc && d.lc.crop) || 0;
  const fs = clamp((d.ghi - 4.0) / 1.8, 0, 1);
  const fc = clamp(crop / 0.75, 0, 1);
  const fb = clamp(betaOf(d) / 0.6, 0, 1);
  const fw = aridity(d);
  const wsum = W.solar + W.crop + W.cobenefit + W.water || 1;
  let s = (W.solar * fs + W.crop * fc + W.cobenefit * fb + W.water * fw) / wsum;
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
  const Y = specificYield(d, cfgKey, L);
  const Yref = specificYield(d, cfgKey, L, true);
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
  const capex = L.capex * (1 + c.prem + heightPrem); // Rs crore / MWp
  const r = L.rate / 100, n = 25;
  const crf = r > 0 ? r / (1 - Math.pow(1 + r, -n)) : 1 / n;
  const lcoe = (capex * 1e7 * crf + L.om * 1e5) / (Y * 1000); // Rs/kWh
  const margin = L.marginAuto ? crop.margin : L.margin;
  const revElec = eHa * 1000 * L.tariff; // Rs/ha/yr
  const revCrop = cropRel * margin;
  const costElec = density * (capex * 1e7 * crf + L.om * 1e5);
  const tilt = c.tiltFixed ? Math.round(clamp(Math.abs(d.lat) + k.tiltAdj, 8, 45)) : (cfgKey === 'vertical' ? 90 : 0);
  const pitch = cfgKey === 'vertical' ? c.collector / gcr : c.collector / gcr;
  return {
    cfgKey, cfg: c, cropKey, crop, gcr, Y, Yref, cuf: Y / 8760, density, eHa, elecRel, shade, beta, ry, cropRel, ler, water,
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
