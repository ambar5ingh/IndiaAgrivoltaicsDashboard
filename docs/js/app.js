import { KOPPEN, KOPPEN_GROUP, CROPS, CONFIGS, MODULES, ACR, SCENARIOS, ADOPTION_STEPS, INFO, GRID_EF, REF_GCR } from './knowledge.js';
import { evaluate, districtTotals, suitability, koppenOf, aridity, betaOf, gridScore } from './model.js';
import { acrOf, agroClimate } from './agroclimate.js';
import { initShadowPage, renderShadowPage, shadowSummaryHTML } from './shadowpage.js';
import { methodHTML, sourcesHTML } from './pages.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '–' : x.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- state
const DEFAULT_W = { solar: 30, crop: 25, cobenefit: 15, water: 15, grid: 15 };
const S = {
  scenario: 'moderate', custom: false,
  L: null, W: { ...DEFAULT_W },
  layer: 'suit', stateFilter: '', selected: null, basemap: false, rankKey: 'mw',
};
function scenarioLevers(key) {
  const sc = SCENARIOS[key];
  return { adoption: sc.adoption, threshold: sc.threshold, config: sc.config, gcr: sc.gcr, gcrAuto: false, height: 3.5, eff: sc.eff,
    bifacial: true, module: 'topcon', crop: 'auto', margin: 120000, marginAuto: true, capex: sc.capex, tariff: sc.tariff, rate: 9, om: 7 };
}
S.L = scenarioLevers(S.scenario);

let fitted = false;
let D = [], byId = new Map(), T = new Map(), geo, statesGeo, map, distLayer, stateLayer, baseLayer;

// ---------------------------------------------------------------- loading
async function fetchJSON(url, label, pct) {
  $('#load-text').textContent = label;
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const j = await r.json();
  $('#load-bar').style.width = pct + '%';
  return j;
}
async function init() {
  try {
    D = await fetchJSON('data/districts.json', 'Loading district data…', 35);
    geo = await fetchJSON('data/districts.geojson', 'Loading district boundaries…', 80);
    statesGeo = await fetchJSON('data/states.geojson', 'Loading state boundaries…', 95);
  } catch (e) {
    $('#load-text').textContent = 'Could not load data: ' + e.message;
    return;
  }
  try {
    const grid = await fetchJSON('data/grid.json', 'Loading grid access…', 98);
    D.forEach(d => { d.grid = grid[d.id] || null; });
  } catch (e) { /* grid layer optional */ }
  D.forEach(d => { byId.set(d.id, d); d.acr = acrOf(d); d.ac = agroClimate(d); });
  readHash();
  for (const d of D) T.set(d.id, districtTotals(d, S.L, S.W));
  layerDomain();
  buildControls();
  buildMap();
  buildStatic();
  initShadowPage(shadowCtx());
  recompute();
  route();
  $('#loading').style.display = 'none';
  window.addEventListener('hashchange', route);
}

// ---------------------------------------------------------------- routing / URL
function route() {
  const page = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard';
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  $('#popover').hidden = true;
  if (page === 'shadow') renderShadowPage(shadowCtx());
  $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  if (page === 'dashboard' && map) setTimeout(() => {
    map.invalidateSize();
    if (!fitted) { fitted = true; S.selected ? select(S.selected, true) : fitScope(); }
  }, 0);
}
function readHash() {
  const q = location.hash.split('?')[1];
  if (!q) return;
  const p = new URLSearchParams(q);
  if (p.get('s') && SCENARIOS[p.get('s')]) { S.scenario = p.get('s'); S.L = scenarioLevers(S.scenario); }
  if (p.get('L')) { try { Object.assign(S.L, JSON.parse(atob(p.get('L')))); S.custom = true; } catch (e) { /* ignore */ } }
  if (p.get('W')) { try { Object.assign(S.W, JSON.parse(atob(p.get('W')))); S.custom = true; } catch (e) { /* ignore */ } }
  if (p.get('layer')) S.layer = p.get('layer');
  if (p.get('st')) S.stateFilter = p.get('st');
  if (p.get('d')) S.selected = +p.get('d');
}
function shareURL() {
  const p = new URLSearchParams();
  p.set('s', S.scenario);
  if (S.custom) { p.set('L', btoa(JSON.stringify(S.L))); p.set('W', btoa(JSON.stringify(S.W))); }
  p.set('layer', S.layer);
  if (S.stateFilter) p.set('st', S.stateFilter);
  if (S.selected) p.set('d', S.selected);
  return location.origin + location.pathname + '#/dashboard?' + p.toString();
}

// ---------------------------------------------------------------- layers
const RAMP = ['#f6f1e2', '#d7ecd9', '#a9d8bd', '#78c8a5', '#46a383', '#2a7a63', '#1a5546', '#13322c'];
const LAYERS = {
  koppen: { label: 'Köppen-Geiger climate class', cat: true, info: 'koppen', color: d => koppenOf(d).color, key: d => d.kg,
    name: k => `${k} · ${KOPPEN[k].name.split(' (')[0]}`, keys: () => Object.keys(KOPPEN), colorOfKey: k => KOPPEN[k].color, tip: d => `${d.kg} · ${koppenOf(d).name}` },
  acr:    { label: 'Agro-climatic region (Planning Commission)', cat: true, info: 'acr', color: d => ACR[d.acr].color, key: d => d.acr,
    name: k => `${k} · ${ACR[k].name.replace(' Region', '')}`, keys: () => Object.keys(ACR).map(Number), colorOfKey: k => ACR[k].color, tip: d => `${d.acr} · ${ACR[d.acr].name}` },
  suit:   { label: 'Agrivoltaic suitability score', unit: '/100', get: (d, t) => t.s, dec: 0, info: 'suit', domain: [0, 100] },
  mw:     { label: 'Scenario capacity (MWp)', unit: 'MWp', get: (d, t) => t.mw, dec: 0, info: 'capacity', zeroGrey: true },
  ler:    { label: 'Land Equivalent Ratio (LER)', unit: '', get: (d, t) => t.e.ler, dec: 2, info: 'ler' },
  croprel:{ label: 'Relative crop yield under panels', unit: '%', get: (d, t) => t.e.cropRel * 100, dec: 0, info: 'crop_rel' },
  irr:    { label: 'Project IRR (%)', unit: '%', get: (d, t) => t.e.irr * 100, dec: 1, info: 'irr' },
  payback:{ label: 'Simple payback (years)', unit: 'yr', get: (d, t) => t.e.payback, dec: 1, info: 'payback' },
  gridd:  { label: 'Distance to ≥66 kV substation (km)', unit: 'km', get: d => d.grid ? d.grid.dsub : NaN, dec: 0, info: 'grid', domain: [0, 60] },
  gridl:  { label: 'Transmission line density (km/100 km²)', unit: 'km/100km²', get: d => d.grid ? d.grid.dens : NaN, dec: 1, info: 'grid' },
  ai:     { label: 'Aridity index (rain ÷ PET)', unit: '', get: d => d.ac.ai, dec: 2, info: 'ai', domain: [0, 1.5] },
  lgp:    { label: 'Length of growing period (days)', unit: 'days', get: d => d.ac.lgp, dec: 0, info: 'lgp', domain: [0, 300] },
  ghi:    { label: 'Solar resource, GHI (kWh/m²/day)', unit: 'kWh/m²/d', get: d => d.ghi, dec: 2, info: 'ghi' },
  yield:  { label: 'Specific yield (kWh/kWp/yr)', unit: 'kWh/kWp', get: (d, t) => t.e.Y, dec: 0, info: 'yield' },
  lcoe:   { label: 'LCOE (₹/kWh)', unit: '₹/kWh', get: (d, t) => t.e.lcoe, dec: 2, info: 'lcoe' },
  crop:   { label: 'Cropland share (%)', unit: '%', get: d => 100 * ((d.lc && d.lc.crop) || 0), dec: 0, info: 'cropland', domain: [0, 90] },
  water:  { label: 'Water saving under panels (%)', unit: '%', get: (d, t) => t.e.water * 100, dec: 0, info: 'water' },
  rain:   { label: 'Annual rainfall (mm)', unit: 'mm', get: d => d.rain, dec: 0 },
  temp:   { label: 'Mean annual temperature (°C)', unit: '°C', get: d => d.t, dec: 1 },
  hot:    { label: 'Months with Tmax ≥ 35 °C', unit: 'months', get: d => d.hot, dec: 0, domain: [0, 12] },
};

function rampColor(v, lo, hi) {
  if (v == null || !isFinite(v)) return '#e5e7eb';
  let f = hi > lo ? (v - lo) / (hi - lo) : 0.5;
  f = Math.max(0, Math.min(1, f));
  const x = f * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), t = x - i;
  const a = hexRgb(RAMP[i]), b = hexRgb(RAMP[i + 1]);
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * t)).join(',')})`;
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function textOn(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#13322c' : '#fff'; }

let domain = [0, 1];
function layerDomain() {
  const Ly = LAYERS[S.layer];
  if (Ly.cat) return;
  if (Ly.domain) { domain = Ly.domain; return; }
  const vals = D.filter(inScope).map(d => Ly.get(d, T.get(d.id))).filter(v => isFinite(v) && !(Ly.zeroGrey && v <= 0)).sort((a, b) => a - b);
  if (!vals.length) { domain = [0, 1]; return; }
  const q = p => vals[Math.min(vals.length - 1, Math.max(0, Math.round(p * (vals.length - 1))))];
  domain = [q(0.02), q(0.98)];
  if (domain[0] === domain[1]) domain = [domain[0] - 1, domain[1] + 1];
}
function fillFor(d) {
  const Ly = LAYERS[S.layer];
  if (Ly.cat) return Ly.color(d);
  const v = Ly.get(d, T.get(d.id));
  if (Ly.zeroGrey && !(v > 0)) return '#e8e4d8';
  return rampColor(v, domain[0], domain[1]);
}
const inScope = d => !S.stateFilter || d.st === S.stateFilter;

// ---------------------------------------------------------------- compute
function recompute() {
  T.clear();
  for (const d of D) T.set(d.id, districtTotals(d, S.L, S.W));
  layerDomain();
  restyle();
  renderKPIs();
  renderLegend();
  renderDistrict();
  renderRank();
  if ($('#page-shadow').classList.contains('active')) renderShadowPage(shadowCtx());
  $('#scen-pill').textContent = (S.custom ? 'Custom · ' : '') + SCENARIOS[S.scenario].label;
}

// ---------------------------------------------------------------- controls
const SLIDERS = {
  threshold: v => fmt(v) , gcr: v => fmt(v, 2), height: v => fmt(v, 1) + ' m', eff: v => fmt(v, 1) + '%',
  margin: v => '₹' + fmt(v / 1000) + 'k/ha', capex: v => '₹' + fmt(v, 2) + ' cr/MW', tariff: v => '₹' + fmt(v, 2) + '/kWh',
  rate: v => fmt(v, 1) + '%', om: v => '₹' + fmt(v, 1) + ' L/MW·yr',
};
function buildControls() {
  // scenarios
  $('#scen-grid').innerHTML = Object.entries(SCENARIOS).map(([k, s]) =>
    `<button class="scen" data-s="${k}"><b>${esc(s.label)}</b><span>${esc(s.desc)}</span></button>`).join('');
  $$('#scen-grid .scen').forEach(b => b.onclick = () => {
    S.scenario = b.dataset.s; S.L = scenarioLevers(S.scenario); S.W = { ...DEFAULT_W }; S.custom = false; syncControls(); recompute();
  });
  $('#btn-reset').onclick = () => { S.L = scenarioLevers(S.scenario); S.W = { ...DEFAULT_W }; S.custom = false; syncControls(); recompute(); };
  // selects
  $('#config').innerHTML = `<option value="auto">Best fit for the climate zone (auto)</option>` +
    Object.entries(CONFIGS).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('');
  $('#module').innerHTML = Object.entries(MODULES).map(([k, m]) => `<option value="${k}">${esc(m.label)}</option>`).join('');
  $('#module').onchange = e => { S.L.module = e.target.value; S.L.eff = MODULES[e.target.value].eff; if (!MODULES[e.target.value].bifi) S.L.bifacial = false; changed(); };
  $('#crop').innerHTML = Object.entries(CROPS).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('');
  $('#layer').innerHTML = Object.entries(LAYERS).map(([k, l]) => `<option value="${k}">${esc(l.label)}</option>`).join('');
  const states = [...new Set(D.map(d => d.st))].sort();
  $('#state').innerHTML = '<option value="">All India</option>' + states.map(s => `<option>${esc(s)}</option>`).join('');

  const changed = () => { S.custom = true; syncControls(); recompute(); };
  $('#adoption').oninput = e => { S.L.adoption = ADOPTION_STEPS[+e.target.value]; changed(); };
  for (const k of Object.keys(SLIDERS)) $('#' + k).oninput = e => { S.L[k] = +e.target.value; if (k === 'gcr') S.L.gcrAuto = false; if (k === 'margin') S.L.marginAuto = false; changed(); };
  $('#config').onchange = e => {
    S.L.config = e.target.value;
    if (e.target.value !== 'auto') { const c = CONFIGS[e.target.value]; S.L.gcr = c.gcr; if (e.target.value === 'elevated') S.L.height = Math.max(S.L.height, 3); }
    changed();
  };
  $('#crop').onchange = e => { S.L.crop = e.target.value; changed(); };
  $('#gcrAuto').onchange = e => { S.L.gcrAuto = e.target.checked; changed(); };
  $('#marginAuto').onchange = e => { S.L.marginAuto = e.target.checked; changed(); };
  $('#bifacial').onchange = e => { S.L.bifacial = e.target.checked; changed(); };
  for (const k of Object.keys(DEFAULT_W)) $('#w' + k).oninput = e => { S.W[k] = +e.target.value; changed(); };

  $('#layer').onchange = e => { S.layer = e.target.value; layerDomain(); restyle(); renderLegend(); };
  $('#state').onchange = e => { S.stateFilter = e.target.value; layerDomain(); restyle(); renderKPIs(); renderLegend(); renderRank(); fitScope(); };
  $('#btn-fit').onclick = fitScope;
  $('#btn-basemap').onclick = toggleBasemap;
  $('#btn-grid').onclick = togglePowerGrid;
  $('#btn-graticule').onclick = toggleGraticule;
  $('#btn-share').onclick = async () => {
    const u = shareURL();
    try { await navigator.clipboard.writeText(u); flash('#btn-share', 'Copied'); } catch (e) { prompt('Copy this link', u); }
  };
  $('#btn-csv').onclick = downloadCSV;

  // tabs
  $$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  // info buttons (delegated, works for buttons rendered later)
  document.addEventListener('click', e => {
    const b = e.target.closest('.info');
    if (b) { e.stopPropagation(); openInfo(b); return; }
    if (!e.target.closest('#popover')) $('#popover').hidden = true;
    if (!e.target.closest('.search-wrap')) $('#search-results').hidden = true;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#popover').hidden = true; });
  buildSearch();
  syncControls();
}
function flash(sel, txt) { const b = $(sel), o = b.textContent; b.textContent = txt; setTimeout(() => b.textContent = o, 1400); }
function showTab(t) {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t));
}
function syncControls() {
  const L = S.L;
  $$('#scen-grid .scen').forEach(b => b.classList.toggle('active', b.dataset.s === S.scenario && !S.custom));
  $('#scen-custom').hidden = !S.custom;
  let ai = ADOPTION_STEPS.findIndex(x => Math.abs(x - L.adoption) < 1e-9);
  if (ai < 0) ai = ADOPTION_STEPS.reduce((bi, x, i) => Math.abs(x - L.adoption) < Math.abs(ADOPTION_STEPS[bi] - L.adoption) ? i : bi, 0);
  $('#adoption').max = ADOPTION_STEPS.length - 1; $('#adoption').value = ai;
  $('#o-adoption').textContent = fmt(L.adoption, L.adoption < 0.1 ? 3 : (L.adoption < 1 ? 2 : 1)) + '%';
  for (const [k, f] of Object.entries(SLIDERS)) { $('#' + k).value = L[k]; $('#o-' + k).textContent = f(L[k]); }
  $('#config').value = L.config; $('#crop').value = L.crop; $('#module').value = L.module;
  const mod = MODULES[L.module];
  $('#module-ex').textContent = `${mod.note} Temperature coefficient ${mod.gamma}%/°C, degradation ${mod.deg}%/yr${mod.bifi ? `, bifaciality ${Math.round(mod.bifi * 100)}%` : ', monofacial only'}.`;
  $('#bifacial').disabled = !mod.bifi;
  $('#gcrAuto').checked = L.gcrAuto; $('#marginAuto').checked = L.marginAuto; $('#bifacial').checked = L.bifacial;
  $('#o-gcr').textContent = L.gcrAuto ? 'by zone' : fmt(L.gcr, 2);
  $('#o-margin').textContent = L.marginAuto ? 'by crop' : SLIDERS.margin(L.margin);
  $('#f-height').style.opacity = (L.config === 'elevated' || L.config === 'auto') ? 1 : .5;
  const c = CROPS[L.crop]; $('#crop-ex').textContent = L.crop === 'auto' ? 'Each district gets the first crop group recommended for its Köppen class.' : 'For example ' + c.examples + '. Shade sensitivity α = ' + c.alpha + '.';
  for (const k of Object.keys(DEFAULT_W)) { $('#w' + k).value = S.W[k]; $('#o-w' + k).textContent = S.W[k]; }
  $('#layer').value = S.layer; $('#state').value = S.stateFilter;
}

// ---------------------------------------------------------------- info popover
function openInfo(btn) {
  const key = btn.dataset.info, it = INFO[key];
  if (!it) return;
  const p = $('#popover');
  p.innerHTML = `<button class="x" aria-label="Close">×</button><b>${esc(it[0])}</b>${esc(it[1])}`;
  p.hidden = false;
  $('.x', p).onclick = () => p.hidden = true;
  const r = btn.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
  p.style.maxWidth = w + 'px';
  let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left - 20));
  let top = r.bottom + 8;
  p.style.left = left + 'px'; p.style.top = top + 'px';
  const ph = p.getBoundingClientRect().height;
  if (top + ph > window.innerHeight - 10) p.style.top = Math.max(10, r.top - ph - 8) + 'px';
}

// ---------------------------------------------------------------- map
function buildMap() {
  map = L.map('map', { preferCanvas: true, zoomSnap: 0.25, minZoom: 3.5, maxZoom: 11, attributionControl: true, zoomControl: true });
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Boundaries: datta07/INDIAN-SHAPEFILES · Data: NASA POWER, ESA WorldCover, Köppen-Geiger (Rubel et al.) · Grid: © OpenStreetMap contributors (Overture Maps)');
  const renderer = L.canvas({ padding: 0.3, tolerance: 2 });
  distLayer = L.geoJSON(geo, {
    renderer,
    style: f => ({ weight: 0.5, color: '#ffffff', opacity: 0.9, fillOpacity: 0.92, fillColor: fillFor(byId.get(f.properties.id)) }),
    onEachFeature: (f, lyr) => {
      lyr.on('mousemove', e => showTip(e, byId.get(f.properties.id)));
      lyr.on('mouseout', () => { $('#tip').hidden = true; if (f.properties.id !== S.selected) distLayer.resetStyle(lyr); });
      lyr.on('mouseover', () => { if (f.properties.id !== S.selected) lyr.setStyle({ weight: 2, color: '#1f3663' }); });
      lyr.on('click', () => select(f.properties.id, false));
    },
  }).addTo(map);
  stateLayer = L.geoJSON(statesGeo, { renderer, interactive: false, style: { weight: 1.3, color: '#1f3663', opacity: 0.55, fill: false } }).addTo(map);
}
function restyle() {
  if (!distLayer) return;
  distLayer.eachLayer(l => {
    const id = l.feature.properties.id, d = byId.get(id);
    const out = S.stateFilter && d.st !== S.stateFilter;
    l.setStyle({ fillColor: fillFor(d), fillOpacity: out ? 0.18 : 0.92, weight: id === S.selected ? 3 : 0.5, color: id === S.selected ? '#f6b31f' : '#ffffff' });
    if (id === S.selected) l.bringToFront();
  });
  stateLayer && stateLayer.bringToFront();
}
function fitScope() {
  if (!S.stateFilter) { map.fitBounds([[7, 68.5], [36.5, 97.2]], { padding: [10, 10] }); return; }
  const b = L.latLngBounds([]);
  distLayer.eachLayer(l => { if (byId.get(l.feature.properties.id).st === S.stateFilter) b.extend(l.getBounds()); });
  if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
}
function toggleBasemap() {
  S.basemap = !S.basemap;
  if (S.basemap) {
    baseLayer = baseLayer || L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd', maxZoom: 19 });
    baseLayer.addTo(map); baseLayer.bringToBack();
    distLayer.eachLayer(l => l.setStyle({ fillOpacity: 0.7 }));
  } else if (baseLayer) { map.removeLayer(baseLayer); restyle(); }
  $('#btn-basemap').textContent = 'Basemap: ' + (S.basemap ? 'on' : 'off');
}
function showTip(e, d) {
  const t = T.get(d.id), Ly = LAYERS[S.layer];
  const v = Ly.cat ? Ly.tip(d) : `${fmt(Ly.get(d, t), Ly.dec)} ${Ly.unit}`;
  const tip = $('#tip');
  tip.innerHTML = `<b>${esc(d.d)}</b>, ${esc(d.st)}<br><span class="m">${esc(v)}</span>`;
  tip.hidden = false;
  const r = $('#map').getBoundingClientRect(), wrap = $('.map-wrap').getBoundingClientRect();
  let x = e.originalEvent.clientX - wrap.left, y = e.originalEvent.clientY - wrap.top;
  if (x > wrap.width - 220) x -= 240;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function select(id, zoom) {
  S.selected = id;
  restyle();
  renderDistrict();
  showTab('district');
  if (zoom) distLayer.eachLayer(l => { if (l.feature.properties.id === id) map.fitBounds(l.getBounds(), { maxZoom: 7, padding: [40, 40] }); });
  $('.panel-body').scrollTop = 0;
}

// ---------------------------------------------------------------- legend & KPIs
function renderLegend() {
  const Ly = LAYERS[S.layer], el = $('#legend');
  const info = Ly.info ? ` <button class="info" data-info="${Ly.info}">i</button>` : '';
  if (Ly.cat) {
    const present = {};
    D.filter(inScope).forEach(d => { const k = Ly.key(d); present[k] = (present[k] || 0) + 1; });
    const keys = Ly.keys().filter(k => present[k]);
    el.innerHTML = `<div class="t">${esc(Ly.label)}${info}</div><div class="cat-legend">` +
      keys.map(k => `<div><span class="sw" style="background:${Ly.colorOfKey(k)}"></span>${esc(Ly.name(k))} <span style="color:var(--muted)">(${present[k]})</span></div>`).join('') + '</div>' + overlayLegend();
    return;
  }
  const grad = `linear-gradient(90deg, ${RAMP.join(',')})`;
  el.innerHTML = `<div class="t">${esc(Ly.label)}${info}</div><div class="ramp" style="background:${grad}"></div>
    <div class="ramp-labels"><span>${fmt(domain[0], Ly.dec)}</span><span>${fmt((domain[0] + domain[1]) / 2, Ly.dec)}</span><span>${fmt(domain[1], Ly.dec)}</span></div>` +
    (Ly.zeroGrey ? `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;color:var(--muted)"><span class="sw" style="background:#e8e4d8"></span>Below threshold / no capacity</div>` : '') + overlayLegend();
}
function scopeTotals() {
  let mw = 0, gwh = 0, ha = 0, inv = 0, co2 = 0, ler = 0, n = 0, all = 0, cropHa = 0, irrW = 0;
  for (const d of D) {
    if (!inScope(d)) continue;
    const t = T.get(d.id); all++; cropHa += t.cropHa;
    if (t.ha > 0) { n++; mw += t.mw; gwh += t.gwh; ha += t.ha; inv += t.inv; co2 += t.co2; ler += t.e.ler * t.ha; if (isFinite(t.e.irr)) irrW += t.e.irr * t.mw; }
  }
  return { mw, gwh, ha, inv, co2, ler: ha ? ler / ha : NaN, irr: mw ? irrW / mw : NaN, n, all, cropHa };
}
function renderKPIs() {
  const s = scopeTotals();
  const gw = s.mw / 1000;
  const k = (label, v, unit, info, cls = '') => `<div class="kpi ${cls}"><div class="k">${label}${info ? ` <button class="info" data-info="${info}">i</button>` : ''}</div><div class="v">${v}<small>${unit}</small></div></div>`;
  $('#kpis').innerHTML =
    k('Capacity', fmt(gw, gw < 10 ? 1 : 0), 'GWp', 'capacity', 'accent') +
    k('Generation', fmt(s.gwh / 1000, s.gwh < 10000 ? 1 : 0), 'TWh/yr', 'yield') +
    k('Land shared', fmt(s.ha / 1000, s.ha < 10000 ? 1 : 0), "'000 ha", 'adoption') +
    k('Avg. LER', fmt(s.ler, 2), '', 'ler') +
    k('Project IRR', fmt(s.irr * 100, 1), '%', 'irr') +
    k('Investment', fmt(s.inv / 1e5, s.inv < 1e5 ? 2 : 1), '₹ lakh cr', 'capex') +
    k('CO₂ avoided', fmt(s.co2, s.co2 < 10 ? 1 : 0), 'Mt/yr', 'co2');
  $('#scope-line').innerHTML = `<b>${esc(S.stateFilter || 'All India')}</b> · ${s.n} of ${s.all} districts at or above the suitability threshold · cropland ${fmt(s.cropHa / 1e6, 1)} million ha · scenario: ${esc((S.custom ? 'custom, based on ' : '') + SCENARIOS[S.scenario].label)}`;
}

// ---------------------------------------------------------------- district specs
function renderDistrict() {
  const el = $('#tab-district');
  const d = byId.get(S.selected);
  if (!d) {
    el.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="#1f3663" stroke-width="1.5"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><br>Click a district on the map, or search for one, to see its climate class, solar resource and recommended agrivoltaic design.</div>`;
    return;
  }
  const t = T.get(d.id), e = t.e, k = koppenOf(d);
  const info = key => ` <button class="info" data-info="${key}">i</button>`;
  const mini = (label, v, unit, key) => `<div class="mini"><div class="k">${label}${key ? info(key) : ''}</div><div class="v">${v}<small> ${unit}</small></div></div>`;
  const shares = (d.kgs && d.kgs.length ? d.kgs : [[d.kg, 1]]);
  const cfgName = e.cfg.label;
  const heightTxt = e.cfgKey === 'elevated' ? `${fmt(S.L.height, 1)} m (zone guide: ${k.height})` : (e.cfgKey === 'greenhouse' ? 'Greenhouse roof' : `${fmt(e.cfg.height, 1)} m lower edge`);
  const tiltTxt = e.cfgKey === 'tracker' ? '±55° single-axis tracking' : e.cfgKey === 'vertical' ? '90° (vertical)' : `${e.tilt}° facing south`;
  const lc = d.lc || {};
  const lcOrder = [['crop', 'Cropland', '#e3b23c'], ['tree', 'Trees', '#2a7a63'], ['shrub', 'Shrub', '#a3b18a'], ['grass', 'Grass', '#cfe1b9'], ['built', 'Built-up', '#c0564b'], ['bare', 'Bare', '#d9cbb0'], ['water', 'Water', '#5b8fd1'], ['snow', 'Snow', '#e5eef5']];
  const cropFlag = e.cropRel < 0.66 ? '<span class="chip warn">Below DIN SPEC 66% yield floor</span>' : (e.cropRel < 0.8 ? '<span class="chip warn">Below Japan\'s 80% rule</span>' : '<span class="chip">Meets DIN SPEC (≥66%) and Japan (≥80%) yield rules</span>');
  const risks = [...k.risks];
  if (d.hot >= 6) risks.push(`${d.hot} months with Tmax ≥ 35 °C`);
  if (d.rain > 2500) risks.push('Very high rainfall: drainage and run-off');
  if (d.frost > 5) risks.push(`${fmt(d.frost)} frost days a year`);
  if ((lc.tree || 0) > 0.5) risks.push('Mostly forest: limited open farmland');
  const rank = [...D].sort((a, b) => T.get(b.id).s - T.get(a.id).s).findIndex(x => x.id === d.id) + 1;

  el.innerHTML = `
  <div class="d-head"><div><h2>${esc(d.d)}</h2><div class="st">${esc(d.st)} · ${fmt(d.area)} km² · ${fmt(d.lat, 2)}°N ${fmt(d.lon, 2)}°E</div></div>
    <button class="btn-ghost close" id="d-close" aria-label="Clear selection">Clear</button></div>

  <section class="section">
    <h3>Köppen-Geiger climate${info('koppen')}</h3>
    <div class="kg-badge"><div class="kg-code" style="background:${k.color};color:${textOn(k.color)}">${esc(d.kg)}</div>
      <div><div class="kg-name">${esc(k.name)} · ${KOPPEN_GROUP[k.group]}</div><div class="kg-desc">${esc(k.climate)}</div></div></div>
    <div class="share-bar">${shares.map(([z, f]) => `<div title="${z} ${fmt(f * 100)}%" style="flex:${f};background:${(KOPPEN[z] || {}).color || '#ccc'}"></div>`).join('')}</div>
    <div class="share-legend">${shares.map(([z, f]) => `<span><i class="sw" style="background:${(KOPPEN[z] || {}).color || '#ccc'}"></i>${z} ${fmt(f * 100)}%</span>`).join('')}
      <span>· NASA POWER check: <b>${esc(d.kgp)}</b></span></div>
  </section>

  <section class="section">
    <h3>Key indicators</h3>
    <div class="mini-grid">
      ${mini('Suitability', fmt(t.s), `/100 · #${rank}`, 'suit')}
      ${mini('GHI', fmt(d.ghi, 2), 'kWh/m²/d', 'ghi')}
      ${mini('Spec. yield', fmt(e.Y), 'kWh/kWp', 'yield')}
      ${mini('Cropland', fmt(100 * (lc.crop || 0)), '%', 'cropland')}
      ${mini('LER', fmt(e.ler, 2), '', 'ler')}
      ${mini('LCOE', '₹' + fmt(e.lcoe, 2), '/kWh', 'lcoe')}
    </div>
    <div class="chart-title" style="margin-top:12px"><span>Land Equivalent Ratio = crop ${fmt(e.cropRel, 2)} + electricity ${fmt(e.elecRel, 2)}</span></div>
    <div class="ler-bar" title="LER ${fmt(e.ler, 2)}">
      <div class="c" style="width:${Math.min(100, e.cropRel / 2 * 100)}%">Crop ${fmt(e.cropRel * 100)}%</div>
      <div class="e" style="width:${Math.min(100, e.elecRel / 2 * 100)}%">Power ${fmt(e.elecRel * 100)}%</div>
    </div>
    <div class="ler-axis"><span style="left:0;transform:none">0</span><span style="left:50%">1.0 (no gain)</span><span style="left:100%;transform:translateX(-100%)">2.0</span></div>
  </section>

  <section class="section">
    <h3>Recommended agrivoltaic design</h3>
    <table class="spec">
      <tr><td>Configuration${info('config')}</td><td>${esc(cfgName)}${S.L.config === 'auto' ? ' <span style="color:var(--muted);font-weight:500">(auto for ' + esc(d.kg) + ')</span>' : ''}</td></tr>
      <tr><td>GCR${info('gcr')}</td><td>${fmt(e.gcr, 2)} <span style="color:var(--muted);font-weight:500">(zone range ${k.gcr[0]}–${k.gcr[1]})</span></td></tr>
      <tr><td>Clearance${info('height')}</td><td>${esc(heightTxt)}</td></tr>
      <tr><td>Tilt / orientation</td><td>${esc(tiltTxt)}; ${esc(e.cfg.orient)}</td></tr>
      <tr><td>Row pitch</td><td>≈ ${fmt(e.pitch, 1)} m (${fmt(e.cfg.collector, 1)} m collector ÷ GCR)</td></tr>
      <tr><td>Capacity density${info('density')}</td><td>${fmt(e.density, 2)} MWp/ha</td></tr>
      <tr><td>Energy per hectare</td><td>${fmt(e.eHa, 0)} MWh/ha/yr (CUF ${fmt(e.cuf * 100, 1)}%)</td></tr>
      <tr><td>Light reduction at crop</td><td>${fmt(e.shade * 100)}%</td></tr>
      <tr><td>Land lost to structures</td><td>${fmt(e.cfg.landLoss * 100)}%</td></tr>
      <tr><td>Modules</td><td>${fmt(S.L.eff, 1)}% ${S.L.bifacial ? 'bifacial' : 'monofacial'}${k.group === 'A' && d.rain > 2000 ? '; corrosion-grade frames' : ''}</td></tr>
      <tr><td>Capex${info('capex')}</td><td>₹${fmt(e.capex, 2)} crore/MWp</td></tr>
    </table>
  </section>

  <section class="section">
    <h3>Crops${info('crop')}</h3>
    <div class="chips" style="margin-bottom:8px">${k.crops.map(c => `<span class="chip" title="${esc(CROPS[c].examples)}">${esc(CROPS[c].label)}</span>`).join('')}</div>
    <table class="spec">
      <tr><td>Modelled crop group</td><td>${esc(e.crop.label)} <span style="color:var(--muted);font-weight:500">(${esc(e.crop.examples)})</span></td></tr>
      <tr><td>Relative crop yield${info('crop_rel')}</td><td>${fmt(e.cropRel * 100)}% of open field</td></tr>
      <tr><td>Shade sensitivity α / climate benefit β</td><td>${fmt(e.crop.alpha, 2)} / ${fmt(e.beta, 2)}</td></tr>
      <tr><td>Water saving${info('water')}</td><td>${fmt(e.water * 100)}% less evapotranspiration</td></tr>
    </table>
    <div class="chips" style="margin-top:8px">${cropFlag}</div>
  </section>

  <section class="section">
    <h3>Climate profile</h3>
    <div class="mini-grid" style="margin-bottom:6px">
      ${mini('Mean temp', fmt(d.t, 1), '°C')}
      ${mini('Rainfall', fmt(d.rain), 'mm/yr')}
      ${mini('Hot months', fmt(d.hot), 'Tmax≥35°C')}
    </div>
    ${barChart(d.ghim, 'Monthly GHI', 'kWh/m²/day', 2, '#f6b31f')}
    ${barChart(d.rm, 'Monthly rainfall', 'mm', 0, '#5b8fd1')}
    ${lineChart(d.tm, 'Monthly mean temperature', '°C', 1)}
    <div class="chart-title"><span>Land cover (ESA WorldCover 2021)</span></div>
    <div class="share-bar" style="height:12px">${lcOrder.filter(([key]) => lc[key] > 0.003).map(([key, n, c]) => `<div title="${n} ${fmt(lc[key] * 100)}%" style="flex:${lc[key]};background:${c}"></div>`).join('')}</div>
    <div class="share-legend">${lcOrder.filter(([key]) => lc[key] > 0.01).map(([key, n, c]) => `<span><i class="sw" style="background:${c}"></i>${n} ${fmt(lc[key] * 100)}%</span>`).join('')}</div>
  </section>

  <section class="section">
    <h3>Agro-climatic conditions${info('acr')}</h3>
    <div class="kg-badge"><div class="kg-code" style="background:${ACR[d.acr].color};color:${textOn(ACR[d.acr].color)}">${d.acr}</div>
      <div><div class="kg-name">${esc(ACR[d.acr].name)}</div><div class="kg-desc">Rainfall ${esc(ACR[d.acr].rain)} · ${esc(ACR[d.acr].soils)}</div></div></div>
    <div class="mini-grid" style="margin-bottom:6px">
      ${mini('Aridity', fmt(d.ac.ai, 2), esc(d.ac.cls), 'ai')}
      ${mini('Growing period', fmt(d.ac.lgp), 'days', 'lgp')}
      ${mini('Water deficit', fmt(d.ac.deficit), 'mm/yr', 'deficit')}
    </div>
    <table class="spec">
      <tr><td>Major crops of the region</td><td>${esc(ACR[d.acr].crops)}</td></tr>
      <tr><td>Kharif rain (Jun–Sep)</td><td>${fmt(d.ac.kharif)} mm (${fmt(100 * d.ac.kharif / Math.max(1, d.rain))}% of annual)</td></tr>
      <tr><td>Rabi-season rain (Oct–Mar)</td><td>${fmt(d.ac.rabi)} mm${d.ac.rabi < 100 ? ' · rabi crops need irrigation' : ''}</td></tr>
      <tr><td>Reference ET (Hargreaves)</td><td>${fmt(d.ac.PET)} mm/yr</td></tr>
      <tr><td>Agrivoltaics angle</td><td>${esc(ACR[d.acr].av)}</td></tr>
    </table>
    ${barChart(d.ac.pet.map((e, m) => Math.max(0, e - d.rm[m])), 'Monthly water deficit (PET − rain)', 'mm', 0, '#c0564b')}
  </section>

  <section class="section">
    <h3>Grid access${info('grid')}</h3>
    ${d.grid ? `<div class="mini-grid">
      ${mini('Nearest ≥66 kV', fmt(d.grid.dsub, 1), 'km')}
      ${mini('Substations', fmt(d.grid.sub), `(${d.grid.subhv} ≥66 kV)`)}
      ${mini('Lines', fmt(d.grid.lkm), 'km')}
    </div>
    <table class="spec" style="margin-top:6px">
      <tr><td>Line density</td><td>${fmt(d.grid.dens, 1)} km per 100 km²</td></tr>
      <tr><td>≥132 kV lines in district</td><td>${fmt(d.grid.lhv)} km</td></tr>
      <tr><td>Grid score (suitability input)</td><td>${fmt(gridScore(d) * 100)}/100</td></tr>
      <tr><td>Connection note</td><td>${d.grid.dsub != null && d.grid.dsub < 15 ? 'Close to a substation: suits 0.5–2 MW PM-KUSUM-A feeder-level plants.' : 'Farther from substations: favour feeder-level or captive (pumping) use, or budget for a longer line.'}</td></tr>
    </table>
    <div style="margin-top:8px"><button class="btn-ghost" id="d-showgrid">Show the power grid on the map</button></div>` : '<p class="hint">No grid data for this district.</p>'}
  </section>

  <section class="section">
    <h3>Shadow analysis${info('shadow')}</h3>
    <div id="d-shadow">${shadowSummaryHTML(d, e, S.L)}</div>
    <div style="margin-top:8px"><a class="btn" href="#/shadow" style="text-decoration:none;display:inline-block">Open 2D / 3D shadow analysis</a></div>
  </section>

  <section class="section">
    <h3>Financials per MWp${info('irr')}</h3>
    <div class="mini-grid">
      ${mini('Project IRR', fmt(e.irr * 100, 1), '%', 'irr')}
      ${mini('Payback', fmt(e.payback, 1), 'years', 'payback')}
      ${mini('NPV', '₹' + fmt(e.npv, 2), 'cr/MWp', 'npv')}
    </div>
    <table class="spec" style="margin-top:6px">
      <tr><td>IRR incl. crop change${info('irr_sys')}</td><td>${fmt(e.irrSys * 100, 1)}%</td></tr>
      <tr><td>Module</td><td>${esc(e.mod.label)}</td></tr>
      <tr><td>Year-1 yield</td><td>${fmt(e.Y1)} kWh/kWp, falling ${e.mod.deg}%/yr</td></tr>
      <tr><td>Capex</td><td>₹${fmt(e.capex, 2)} crore/MWp</td></tr>
      <tr><td>Tariff / LCOE</td><td>₹${fmt(S.L.tariff, 2)} / ₹${fmt(e.lcoe, 2)} per kWh</td></tr>
    </table>
    ${cashChart(e.cf)}
  </section>

  <section class="section">
    <h3>Design notes and risks</h3>
    <ul class="notes">${k.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="chips" style="margin-top:8px">${risks.map(r => `<span class="chip warn">${esc(r)}</span>`).join('')}</div>
  </section>

  <section class="section">
    <h3>Scenario result for this district${info('capacity')}</h3>
    ${t.eligible ? '' : `<p class="hint">Suitability ${t.s} is below the threshold of ${S.L.threshold}, so the scenario adds no capacity here. Lower the threshold to include it.</p>`}
    <table class="spec">
      <tr><td>Cropland</td><td>${fmt(t.cropHa / 1000, 1)} thousand ha</td></tr>
      <tr><td>Agrivoltaic area</td><td>${fmt(t.ha, 0)} ha (${fmt(S.L.adoption, 3)}% of cropland)</td></tr>
      <tr><td>Capacity</td><td>${fmt(t.mw, t.mw < 10 ? 1 : 0)} MWp</td></tr>
      <tr><td>Generation</td><td>${fmt(t.gwh, t.gwh < 10 ? 1 : 0)} GWh/yr</td></tr>
      <tr><td>Investment</td><td>₹${fmt(t.inv, 0)} crore</td></tr>
      <tr><td>CO₂ avoided${info('co2')}</td><td>${fmt(t.co2 * 1000, 0)} thousand t/yr</td></tr>
      <tr><td>Gross revenue per ha${info('revenue')}</td><td>₹${fmt((e.revElec + e.revCrop) / 1e5, 1)} lakh (power ₹${fmt(e.revElec / 1e5, 1)} L + crop ₹${fmt(e.revCrop / 1e5, 1)} L) vs ₹${fmt(e.margin / 1e5, 1)} L crop only</td></tr>
      <tr><td>Tariff vs LCOE</td><td>${e.lcoe <= S.L.tariff ? `Viable: tariff exceeds LCOE by ₹${fmt(S.L.tariff - e.lcoe, 2)}/kWh` : `Viability gap of ₹${fmt(e.lcoe - S.L.tariff, 2)}/kWh`}</td></tr>
    </table>
  </section>`;
  const sg = $('#d-showgrid'); if (sg) sg.onclick = () => { if (!gridLayer || !map.hasLayer(gridLayer)) togglePowerGrid(); select(d.id, true); };
  $('#d-close').onclick = () => { S.selected = null; restyle(); renderDistrict(); showTab('levers'); };
}

function barChart(vals, title, unit, dec, color) {
  const W = 360, H = 96, pad = { l: 4, r: 4, t: 14, b: 16 };
  const max = Math.max(...vals) || 1, bw = (W - pad.l - pad.r) / 12;
  const imax = vals.indexOf(Math.max(...vals));
  const bars = vals.map((v, i) => {
    const h = (H - pad.t - pad.b) * v / max, x = pad.l + i * bw + 3, y = H - pad.b - h, w = bw - 6, r = Math.min(4, h / 2, w / 2);
    const path = h > 0 ? `M${x},${H - pad.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H - pad.b} Z` : '';
    return `<g><title>${MONTH_NAMES[i]}: ${fmt(v, dec)} ${unit}</title><rect x="${pad.l + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <path d="${path}" fill="${color}"/><text x="${x + w / 2}" y="${H - 4}" font-size="9" text-anchor="middle" fill="#64748b">${MONTHS[i]}</text>
      ${i === imax ? `<text x="${x + w / 2}" y="${y - 3}" font-size="9" text-anchor="middle" fill="#1f2937" font-weight="700">${fmt(v, dec)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="chart-title"><span>${title}</span><span>${unit}</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><line x1="0" x2="${W}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="#e6dec8"/>${bars}</svg>`;
}
function cashChart(cf) {
  const W = 360, H = 120, pad = { l: 6, r: 6, t: 12, b: 16 };
  let cum = 0; const cs = cf.map(x => (cum += x) / 1e7);
  const lo = Math.min(0, ...cs), hi = Math.max(0, ...cs), bw = (W - pad.l - pad.r) / cs.length;
  const py = v => pad.t + (H - pad.t - pad.b) * (hi - v) / (hi - lo || 1), y0 = py(0);
  const bars = cs.map((v, i) => {
    const x = pad.l + i * bw + 1, w = bw - 2, y = Math.min(py(v), y0), h = Math.max(1, Math.abs(py(v) - y0));
    return `<g><title>Year ${i}: cumulative ₹${fmt(v, 2)} crore per MWp</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${v >= 0 ? '#2a7a63' : '#c0564b'}"/></g>`;
  }).join('');
  return `<div class="chart-title"><span>Cumulative cash flow, ₹ crore per MWp</span><span>years 0–25</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative cash flow"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="#94a3b8"/>${bars}
    <text x="${pad.l}" y="${H - 3}" font-size="9" fill="#64748b">0</text><text x="${W / 2}" y="${H - 3}" font-size="9" text-anchor="middle" fill="#64748b">12</text><text x="${W - pad.r}" y="${H - 3}" font-size="9" text-anchor="end" fill="#64748b">25</text>
    <text x="${W - pad.r}" y="${py(cs[cs.length - 1]) - 4}" font-size="9" text-anchor="end" font-weight="700" fill="#1f2937">₹${fmt(cs[cs.length - 1], 2)} cr</text></svg>`;
}
function lineChart(vals, title, unit, dec) {
  const W = 360, H = 96, pad = { l: 10, r: 10, t: 16, b: 16 };
  const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
  const bw = (W - pad.l - pad.r) / 12;
  const px = i => pad.l + bw * (i + 0.5), py = v => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const pts = vals.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const imax = vals.indexOf(Math.max(...vals)), imin = vals.indexOf(Math.min(...vals));
  return `<div class="chart-title"><span>${title}</span><span>${unit}</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><line x1="0" x2="${W}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="#e6dec8"/>
    <polyline points="${pts}" fill="none" stroke="#13322c" stroke-width="2" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<g><title>${MONTH_NAMES[i]}: ${fmt(v, dec)} ${unit}</title><rect x="${px(i) - bw / 2}" y="0" width="${bw}" height="${H}" fill="transparent"/>
      <circle cx="${px(i)}" cy="${py(v)}" r="4" fill="#13322c" stroke="#fff" stroke-width="2"/>
      <text x="${px(i)}" y="${H - 4}" font-size="9" text-anchor="middle" fill="#64748b">${MONTHS[i]}</text>
      ${i === imax || i === imin ? `<text x="${px(i)}" y="${py(v) - 7}" font-size="9" text-anchor="middle" fill="#1f2937" font-weight="700">${fmt(v, dec)}</text>` : ''}</g>`).join('')}</svg>`;
}

// ---------------------------------------------------------------- rankings
const RANK_COLS = {
  s: ['Suit.', t => t.s, 0], mw: ['MWp', t => t.mw, 0], ler: ['LER', t => t.e.ler, 2], irr: ['IRR %', t => t.e.irr * 100, 1], lcoe: ['₹/kWh', t => t.e.lcoe, 2],
};
function renderRank() {
  const el = $('#tab-rank');
  const [lab, get, dec] = RANK_COLS[S.rankKey];
  const asc = S.rankKey === 'lcoe';
  const rows = D.filter(inScope).map(d => ({ d, t: T.get(d.id) })).sort((a, b) => asc ? get(a.t) - get(b.t) : get(b.t) - get(a.t)).slice(0, 40);
  el.innerHTML = `<section class="section"><h3>Top districts · ${esc(S.stateFilter || 'All India')}</h3>
    <p class="hint">Sorted by ${esc(lab)}. Click a column to re-sort, or a row to open the district.</p>
    <table class="rank-table"><thead><tr><th>#</th><th>District</th>${Object.entries(RANK_COLS).map(([k, c]) => `<th class="num" data-k="${k}">${c[0]}${k === S.rankKey ? (asc ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-id="${r.d.id}"><td>${i + 1}</td><td><span class="kgdot" style="background:${koppenOf(r.d).color}" title="${r.d.kg}"></span>${esc(r.d.d)}<br><span style="color:var(--muted);font-size:.68rem">${esc(r.d.st)} · ${r.d.kg}</span></td>
      ${Object.values(RANK_COLS).map(c => `<td class="num">${fmt(c[1](r.t), c[2])}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
  $$('th[data-k]', el).forEach(th => th.onclick = () => { S.rankKey = th.dataset.k; renderRank(); });
  $$('tbody tr', el).forEach(tr => tr.onclick = () => select(+tr.dataset.id, true));
}

// ---------------------------------------------------------------- search
function buildSearch() {
  const inp = $('#search'), box = $('#search-results');
  let hits = [], hi = 0;
  const draw = () => { box.innerHTML = hits.map((d, i) => `<button data-id="${d.id}" class="${i === hi ? 'hi' : ''}">${esc(d.d)} <span>· ${esc(d.st)}</span></button>`).join(''); box.hidden = !hits.length; $$('button', box).forEach(b => b.onclick = () => pick(+b.dataset.id)); };
  const pick = id => { box.hidden = true; inp.value = byId.get(id).d; select(id, true); };
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    hits = q.length < 2 ? [] : D.filter(d => d.d.toLowerCase().includes(q) || d.st.toLowerCase().startsWith(q))
      .sort((a, b) => a.d.toLowerCase().indexOf(q) - b.d.toLowerCase().indexOf(q)).slice(0, 12);
    hi = 0; draw();
  };
  inp.onkeydown = e => {
    if (e.key === 'ArrowDown') { hi = Math.min(hits.length - 1, hi + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && hits[hi]) pick(hits[hi].id);
  };
}

// ---------------------------------------------------------------- CSV
function downloadCSV() {
  const head = ['state', 'district', 'koppen', 'koppen_name', 'area_km2', 'cropland_pct', 'ghi_kwh_m2_day', 'mean_temp_c', 'rain_mm', 'suitability', 'config', 'gcr', 'crop_group', 'specific_yield_kwh_kwp', 'density_mwp_ha', 'relative_crop_yield', 'ler', 'water_saving_pct', 'lcoe_rs_kwh', 'project_irr_pct', 'payback_yr', 'module', 'agro_climatic_region', 'aridity_index', 'growing_period_days', 'dist_to_substation_km', 'line_density_km_per_100km2', 'eligible', 'av_area_ha', 'capacity_mwp', 'generation_gwh', 'investment_rs_crore', 'co2_avoided_kt'];
  const rows = D.map(d => {
    const t = T.get(d.id), e = t.e;
    return [d.st, d.d, d.kg, koppenOf(d).name, d.area, 100 * ((d.lc && d.lc.crop) || 0), d.ghi, d.t, d.rain, t.s, e.cfgKey, e.gcr, e.cropKey, e.Y, e.density, e.cropRel, e.ler, e.water * 100, e.lcoe, e.irr * 100, e.payback, e.mod.short, ACR[d.acr].name, d.ac.ai, d.ac.lgp, d.grid ? d.grid.dsub : '', d.grid ? d.grid.dens : '', t.eligible, t.ha, t.mw, t.gwh, t.inv, t.co2 * 1000]
      .map(v => typeof v === 'number' ? +v.toFixed(3) : `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const blob = new Blob([head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'india_agrivoltaics_districts.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- static pages
function buildStatic() {
  const count = {}, area = {};
  D.forEach(d => { count[d.kg] = (count[d.kg] || 0) + 1; area[d.kg] = (area[d.kg] || 0) + d.area; });
  const keys = Object.keys(KOPPEN).filter(k => count[k]).sort((a, b) => count[b] - count[a]);
  $('#kg-cards').innerHTML = keys.map(k => {
    const z = KOPPEN[k], cfg = CONFIGS[z.config];
    return `<article class="kg-card"><div class="top"><div class="kg-code" style="background:${z.color};color:${textOn(z.color)}">${k}</div>
      <div><div class="kg-name">${esc(z.name)}</div><div class="kg-desc">${KOPPEN_GROUP[z.group]}</div></div>
      <div class="count">${count[k]} districts<br>${fmt(area[k] / 1000)}k km²</div></div>
      <div class="body"><p><b>Where:</b> ${esc(z.india)}</p><p><b>Climate:</b> ${esc(z.climate)}</p>
      <table class="spec"><tr><td>Configuration</td><td>${esc(cfg ? cfg.label : '–')}</td></tr><tr><td>GCR</td><td>${z.gcr[0]}–${z.gcr[1]}</td></tr>
      <tr><td>Clearance</td><td>${esc(z.height)}</td></tr><tr><td>Tilt</td><td>≈ latitude ${z.tiltAdj >= 0 ? '+' : '−'} ${Math.abs(z.tiltAdj)}°</td></tr>
      <tr><td>Shade co-benefit β</td><td>${z.beta}</td></tr></table>
      <p style="margin-top:8px"><b>Crops:</b> ${z.crops.map(c => esc(CROPS[c].label.toLowerCase())).join(', ')}</p>
      <ul class="notes">${z.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      <div class="chips" style="margin-top:6px">${z.risks.map(r => `<span class="chip warn">${esc(r)}</span>`).join('')}</div></div></article>`;
  }).join('');
  $('#method-body').innerHTML = methodHTML({ CONFIGS, CROPS, MODULES, REF_GCR, GRID_EF });
  $('#sources-body').innerHTML = sourcesHTML();
}


// ---------------------------------------------------------------- overlays: power grid and lat/long graticule
const KV_COLORS = { 765: '#7a0177', 400: '#c51b8a', 220: '#f768a1', 132: '#1f3663', 66: '#5b8fd1', 33: '#9ecae1', 0: '#8c8c8c' };
let gridLayer = null, gridLoading = false, gratLayer = null;
function overlayLegend() {
  let h = '';
  if (gridLayer && map.hasLayer(gridLayer)) {
    h += `<div class="t" style="margin-top:8px">Power grid (OpenStreetMap) <button class="info" data-info="grid">i</button></div><div class="cat-legend">` +
      [765, 400, 220, 132, 66, 0].map(b => `<div><span class="sw" style="background:${KV_COLORS[b]};height:4px;border-radius:2px"></span>${b ? b + ' kV' : 'Voltage not tagged'}</div>`).join('') +
      `<div class="span"><span class="sw" style="background:#fff;border:2px solid #13322c;border-radius:50%"></span>Substation ≥220 kV<br>(66–132 kV appear when zoomed in)</div></div>`;
  }
  return h;
}
async function togglePowerGrid() {
  const btn = $('#btn-grid');
  if (gridLayer) {
    if (map.hasLayer(gridLayer)) map.removeLayer(gridLayer); else gridLayer.addTo(map);
  } else {
    if (gridLoading) return;
    gridLoading = true; btn.textContent = 'Power grid: loading…';
    try {
      const [lines, subs] = await Promise.all([fetch('data/grid_lines.geojson').then(r => r.json()), fetch('data/substations.json').then(r => r.json())]);
      const rend = L.canvas({ padding: 0.3 });
      const order = { 0: 0, 66: 1, 132: 2, 220: 3, 400: 4, 765: 5 };
      lines.features.sort((a, b) => order[a.properties.b] - order[b.properties.b]);
      const lineLayer = L.geoJSON(lines, { renderer: rend, interactive: false,
        style: f => ({ color: KV_COLORS[f.properties.b], weight: f.properties.b >= 400 ? 2.2 : f.properties.b >= 220 ? 1.6 : 1, opacity: 0.9 }) });
      const dot = ([x, y, b, n]) => L.circleMarker([y, x], { renderer: rend, radius: b >= 400 ? 3 : b >= 220 ? 2.2 : 1.4,
        color: '#13322c', weight: b >= 220 ? 1 : 0.6, fillColor: '#ffffff', fillOpacity: 1 }).bindTooltip(`${n ? esc(n) + ' · ' : ''}${b} kV substation`);
      const subHV = L.layerGroup(subs.filter(s => s[2] >= 220).map(dot));
      const subLV = L.layerGroup(subs.filter(s => s[2] < 220).map(dot)); // 66 and 132 kV, shown once zoomed in
      gridLayer = L.layerGroup([lineLayer, subHV]).addTo(map);
      const zoomSubs = () => { const on = map.hasLayer(gridLayer) && map.getZoom() >= 6.5; if (on && !gridLayer.hasLayer(subLV)) gridLayer.addLayer(subLV); else if (!on && gridLayer.hasLayer(subLV)) gridLayer.removeLayer(subLV); };
      map.on('zoomend', zoomSubs); zoomSubs();
    } catch (e) { console.error('power grid', e); btn.textContent = 'Power grid: failed'; gridLoading = false; return; }
    gridLoading = false;
  }
  btn.textContent = 'Power grid: ' + (map.hasLayer(gridLayer) ? 'on' : 'off');
  renderLegend();
}
function toggleGraticule() {
  if (!gratLayer) {
    const ls = [];
    for (let lat = 6; lat <= 38; lat += 2) ls.push(L.polyline([[lat, 66], [lat, 100]], { color: '#1f3663', weight: lat % 10 === 0 ? 1 : 0.5, opacity: 0.35, dashArray: '4 4', interactive: false }));
    for (let lon = 66; lon <= 100; lon += 2) ls.push(L.polyline([[5, lon], [38, lon]], { color: '#1f3663', weight: lon % 10 === 0 ? 1 : 0.5, opacity: 0.35, dashArray: '4 4', interactive: false }));
    const labels = [];
    for (let lat = 8; lat <= 36; lat += 4) labels.push(L.marker([lat, 67.2], { interactive: false, icon: L.divIcon({ className: 'grat-label', html: lat + '°N', iconSize: [34, 14] }) }));
    for (let lon = 68; lon <= 98; lon += 4) labels.push(L.marker([6.2, lon], { interactive: false, icon: L.divIcon({ className: 'grat-label', html: lon + '°E', iconSize: [34, 14] }) }));
    gratLayer = L.layerGroup([...ls, ...labels]);
  }
  if (map.hasLayer(gratLayer)) map.removeLayer(gratLayer); else gratLayer.addTo(map);
  $('#btn-graticule').textContent = 'Lat/long grid: ' + (map.hasLayer(gratLayer) ? 'on' : 'off');
}

// ---------------------------------------------------------------- shadow page context
function shadowCtx() {
  return { D, byId, T, S, evaluate, onLever: () => { S.custom = true; syncControls(); recompute(); }, select: id => { S.selected = id; restyle(); renderDistrict(); } };
}

init();
