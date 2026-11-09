// Mandis (agricultural markets) and cold storages as point layers. Data: data/mandis.json and
// data/cold_storage.json, built by pipeline/build_markets.py. Both load on first use and draw on a canvas,
// so the ~6,000 points stay fast.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = v => '₹' + Number(v).toLocaleString('en-IN');
export const MANDI_COLOR = '#e4572e', COLD_COLOR = '#2b8cbe';

let map, renderer, onChange = () => {};
const L_ = { mandi: null, cold: null }, DATA = { mandi: null, cold: null };

export function initMarkets(m, changed) {
  map = m; onChange = changed || onChange;
  map.createPane('markets').style.zIndex = 630;
  renderer = L.canvas({ pane: 'markets', padding: 0.3 });
}

const radius = () => { const z = map.getZoom(); return z < 5.5 ? 2.6 : z < 7 ? 3.6 : 5; };

function mandiPopup(x) {
  const tags = [x.agm ? `<span class="mk-tag">Agmarknet prices</span>` : '', x.enam ? `<span class="mk-tag enam">e-NAM mandi</span>` : ''].join('');
  let h = `<div class="mk-pop"><div class="mk-kind" style="color:${MANDI_COLOR}">Mandi</div><h4>${esc(x.n.trim())}</h4>
    <div class="mk-sub">${esc(x.d ? x.d + ', ' : '')}${esc(x.st)}</div><div class="mk-tags">${tags}</div>`;
  if (x.prices && x.prices.length) {
    h += `<div class="mk-h">Prices on ${esc(new Date(x.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))} <small>(₹ per quintal: range, modal)</small></div>
      <div class="mk-scroll"><table class="mk-prices"><tbody>` +
      x.prices.map(([c, v, lo, hi, mo]) => {
        const vv = v && v.toLowerCase().replace(/\W/g, '') !== c.toLowerCase().replace(/\W/g, '') && v.toLowerCase() !== 'other' ? ` <small>${esc(v)}</small>` : '';
        const n = k => Number(k).toLocaleString('en-IN');
        return `<tr><td>${esc(c)}${vv}</td><td>${lo === hi ? '' : n(lo) + '–' + n(hi)}</td><td><b>${inr(mo)}</b></td></tr>`;
      }).join('') +
      `</tbody></table></div>`;
  }
  if (x.comm) {
    h += `<div class="mk-h">Traded on e-NAM</div><div class="mk-comm">` +
      Object.entries(x.comm).map(([g, it]) => `<div><span>${esc(g)}</span> ${esc(it.join(', '))}</div>`).join('') + `</div>`;
  }
  if (x.addr) h += `<div class="mk-h">Address</div><div class="mk-addr">${esc(x.addr)}${x.pin && !x.addr.includes(x.pin) ? ' – ' + esc(x.pin) : ''}</div>`;
  const prec = x.p === 'market' ? `market yard “${esc(x.at)}” in OpenStreetMap` : `${x.p === 'town' ? 'town' : 'village'} of ${esc(x.at)} (OpenStreetMap)`;
  h += `<div class="mk-note">Location: ${prec}${x.p === 'market' ? '' : ', so the yard itself may be a few km away'}.${x.note ? ' ' + esc(x.note[0].toUpperCase() + x.note.slice(1)) + '.' : ''}</div></div>`;
  return h;
}

function coldPopup(x) {
  return `<div class="mk-pop"><div class="mk-kind" style="color:${COLD_COLOR}">Cold storage</div><h4>${esc(x.n)}</h4>
    <div class="mk-sub">${esc(x.d)}, ${esc(x.st)}</div>
    ${x.in ? `<div class="mk-note">The point falls in ${esc(x.in)} on this map (renamed or split district, or a point near the boundary).</div>` : ''}
    <div class="mk-note">Source: National Horticulture Board cold chain map (ICAP), NHB-assisted units only.${x.r ? ' Coordinates are given to 0.01° (about 1 km).' : ''} Capacity is not in the map feed.</div></div>`;
}

async function build(kind) {
  if (L_[kind]) return;
  const url = kind === 'mandi' ? 'data/mandis.json' : 'data/cold_storage.json';
  DATA[kind] = await fetch(url).then(r => r.json());
  const g = L.layerGroup();
  const list = kind === 'mandi' ? DATA.mandi.mandis : DATA.cold.sites;
  for (const x of list) {
    const opt = kind === 'mandi'
      ? { radius: radius() + 0.8, color: '#fff', weight: 1, fillColor: x.agm ? MANDI_COLOR : '#fff', fillOpacity: 1, renderer }
      : { radius: radius(), color: '#fff', weight: 0.8, fillColor: COLD_COLOR, fillOpacity: 0.95, renderer };
    if (kind === 'mandi' && !x.agm) { opt.color = MANDI_COLOR; opt.weight = 1.6; }
    L.circleMarker([x.lat, x.lon], opt)
      .bindTooltip(esc(x.n.trim()), { direction: 'top', offset: [0, -4] })
      .bindPopup(() => kind === 'mandi' ? mandiPopup(x) : coldPopup(x), { maxWidth: 340, className: 'mk-popup' })
      .addTo(g);
  }
  L_[kind] = g;
  map.on('zoomend', () => {
    const r = radius();
    g.eachLayer(l => l.setRadius(kind === 'mandi' ? r + 0.8 : r));
  });
}

export async function toggleMarket(kind) {
  try { await build(kind); } catch (e) { console.error(kind, e); return false; }
  const g = L_[kind];
  if (map.hasLayer(g)) map.removeLayer(g); else g.addTo(map);
  onChange();
  return map.hasLayer(g);
}

export function marketsLegend() {
  let h = '';
  if (L_.mandi && map.hasLayer(L_.mandi)) {
    const m = DATA.mandi.meta;
    h += `<div class="t" style="margin-top:8px">Mandis <button class="info" data-info="mandis">i</button></div>
      <div class="cat-legend"><div><span class="mk-dot" style="background:${MANDI_COLOR}"></span>With Agmarknet prices (${m.with_prices.toLocaleString('en-IN')})</div>
      <div><span class="mk-dot" style="background:#fff;border:2px solid ${MANDI_COLOR}"></span>e-NAM directory only (${(m.placed - m.with_prices).toLocaleString('en-IN')})</div></div>
      <div class="kv-note">${m.placed.toLocaleString('en-IN')} mandis placed by town name. Click one for prices and what it trades.</div>`;
  }
  if (L_.cold && map.hasLayer(L_.cold)) {
    const c = DATA.cold.meta;
    h += `<div class="t" style="margin-top:8px">Cold storages (NHB) <button class="info" data-info="cold">i</button></div>
      <div class="cat-legend"><div><span class="mk-dot" style="background:${COLD_COLOR}"></span>${c.n.toLocaleString('en-IN')} NHB-assisted units</div></div>`;
  }
  return h;
}
