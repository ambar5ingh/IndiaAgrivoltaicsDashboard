// Operating and upcoming agrivoltaic project sites from the GIZ / India Agrivoltaics Alliance report
// "Agrivoltaics in India: Overview of Projects". Data and photos: data/giz_sites.json, assets/sites/.
// Markers that would overlap at the current zoom merge into a numbered group; clicking a group lists its sites.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND_COLOR = { commercial: '#f6b31f', research: '#78c8a5', upcoming: '#ffffff' };

let map, data = null, layer = null, pts = [], onChange = () => {};

function kindOf(s) {
  if (s.upcoming) return 'upcoming';
  return /commercial/i.test(s.kind) ? 'commercial' : 'research';
}
function capTxt(kw) {
  if (kw == null) return '';
  return kw >= 1000 ? `${+(kw / 1000).toFixed(2)} MW` : `${+kw.toFixed(2)} kW`;
}
function sizeOf(kw) {
  if (kw == null) return 16;
  return kw >= 1000 ? 26 : kw >= 100 ? 21 : 17;
}

function pinIcon(s) {
  const k = kindOf(s), z = sizeOf(s.kw);
  return L.divIcon({
    className: 'site-pin-wrap', iconSize: [z, z], iconAnchor: [z / 2, z / 2],
    html: `<span class="site-pin k-${k}${s.approx ? ' approx' : ''}" style="width:${z}px;height:${z}px;background:${KIND_COLOR[k]}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="9" rx="1" transform="skewX(-12) translate(2 0)"/><path d="M12 14v6M8 20h8"/></svg></span>`,
  });
}
function groupIcon(n) {
  return L.divIcon({ className: 'site-pin-wrap', iconSize: [30, 30], iconAnchor: [15, 15], html: `<span class="site-group">${n}</span>` });
}

// Greedy pixel clustering: good enough for ~40 points, recomputed on every zoom.
function redraw() {
  if (!layer) return;
  layer.clearLayers();
  const R = 24, used = new Array(pts.length).fill(false);
  const px = pts.map(p => map.latLngToLayerPoint(p.ll));
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    const g = [i]; used[i] = true;
    for (let j = i + 1; j < pts.length; j++) if (!used[j] && px[i].distanceTo(px[j]) < R) { g.push(j); used[j] = true; }
    if (g.length === 1) {
      const p = pts[i];
      L.marker(p.ll, { icon: pinIcon(p.s), pane: 'sites', riseOnHover: true, keyboard: true, title: p.s.name })
        .bindTooltip(`<b>${esc(p.s.name)}</b><br>${esc(capTxt(p.s.kw) || p.s.cap)} · ${esc(p.s.place)}${p.s.approx ? '<br><i>Approximate location</i>' : ''}`, { direction: 'top', offset: [0, -10] })
        .on('click', () => openSite(p.s.id))
        .addTo(layer);
    } else {
      const lat = g.reduce((a, k) => a + pts[k].ll[0], 0) / g.length, lon = g.reduce((a, k) => a + pts[k].ll[1], 0) / g.length;
      const list = g.map(k => pts[k].s).sort((a, b) => (b.kw || 0) - (a.kw || 0));
      const html = `<div class="site-list"><div class="t">${g.length} agrivoltaic sites here</div>` +
        list.map(s => `<button data-site="${esc(s.id)}"><span class="dot" style="background:${KIND_COLOR[kindOf(s)]}"></span><span>${esc(s.name)}</span><small>${esc(capTxt(s.kw))}</small></button>`).join('') +
        `<button class="zoom" data-zoom="1">Zoom in</button></div>`;
      const m = L.marker([lat, lon], { icon: groupIcon(g.length), pane: 'sites', title: `${g.length} agrivoltaic sites` })
        .bindPopup(html, { maxWidth: 300, className: 'site-popup' })
        .addTo(layer);
      m.on('popupopen', e => {
        const el = e.popup.getElement();
        el.querySelectorAll('[data-site]').forEach(b => b.onclick = () => { map.closePopup(); openSite(b.dataset.site); });
        el.querySelector('[data-zoom]').onclick = () => { map.closePopup(); map.fitBounds(L.latLngBounds(g.map(k => pts[k].ll)).pad(0.6), { maxZoom: 11 }); };
      });
    }
  }
}

export async function initSites(m, changed) {
  map = m; onChange = changed || onChange;
  map.createPane('sites').style.zIndex = 640;
  try {
    data = await fetch('data/giz_sites.json').then(r => r.json());
  } catch (e) { console.error('agrivoltaic sites', e); return; }
  pts = [];
  for (const s of data.sites) for (const ll of s.loc) pts.push({ s, ll });
  layer = L.layerGroup().addTo(map);
  redraw();
  map.on('zoomend', redraw);
  buildModal();
  const h = new URLSearchParams(location.search).get('site');
  if (h) openSite(h);
}

export function toggleSites() {
  if (!layer) return false;
  if (map.hasLayer(layer)) map.removeLayer(layer); else layer.addTo(map);
  onChange();
  return map.hasLayer(layer);
}
export function sitesOn() { return !!layer && map.hasLayer(layer); }

export function sitesLegend() {
  if (!sitesOn()) return '';
  const n = data.sites.filter(s => !/b$/.test(s.id)).length, mw = data.sites.reduce((a, s) => a + (s.kw || 0), 0) / 1000;
  const sw = (k, label) => `<div><span class="site-pin k-${k}" style="width:13px;height:13px;background:${KIND_COLOR[k]}"></span>${label}</div>`;
  return `<div class="t" style="margin-top:8px">Agrivoltaic project sites <button class="info" data-info="sites">i</button></div>
    <div class="cat-legend">${sw('commercial', 'Commercial')}${sw('research', 'Research / demo')}${sw('upcoming', 'Upcoming')}
    <div style="color:var(--muted)">${n} projects · ${mw.toFixed(1)} MW</div></div>
    <div class="kv-note">Bigger pins are bigger plants. Click a pin for details and photos. Source: GIZ / India Agrivoltaics Alliance.</div>`;
}

// ---------------------------------------------------------------- detail dialog
function buildModal() {
  if (document.getElementById('site-modal')) return;
  const d = document.createElement('div');
  d.id = 'site-modal'; d.className = 'site-modal'; d.hidden = true;
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'site-title');
  d.innerHTML = `<div class="site-card"><button class="site-x" aria-label="Close">×</button><div id="site-body"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.site-x')) closeSite(); });
  document.addEventListener('keydown', e => {
    if (d.hidden) return;
    if (e.key === 'Escape') closeSite();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
}
let cur = null, photo = 0;
function closeSite() {
  document.getElementById('site-modal').hidden = true; cur = null;
  const u = new URL(location.href); u.searchParams.delete('site'); history.replaceState(null, '', u);
}
function step(k) {
  if (!cur || cur.photos.length < 2) return;
  photo = (photo + k + cur.photos.length) % cur.photos.length; renderPhoto();
}
function renderPhoto() {
  const p = cur.photos[photo], el = document.getElementById('site-photo');
  if (!el) return;
  el.querySelector('img').src = p.src; el.querySelector('img').alt = p.cap;
  el.querySelector('figcaption').textContent = `${p.cap}${cur.photos.length > 1 ? ` (${photo + 1} of ${cur.photos.length})` : ''}`;
  document.querySelectorAll('.site-thumbs button').forEach((b, i) => b.classList.toggle('on', i === photo));
}

export function openSite(id) {
  const s = data && data.sites.find(x => x.id === String(id));
  if (!s) return;
  cur = s; photo = 0;
  const k = kindOf(s);
  const facts = [
    ['Capacity', s.cap], ['Developer', s.dev], ['Commissioned', s.date], ['Location', `${s.place}, ${s.state}`],
    ['Project type', s.kind], ['Design', s.design], ['Panel height', s.height],
  ].filter(([, v]) => v && v !== 'N.A.');
  const gps = s.loc.map(([a, b]) => `${a.toFixed(5)}, ${b.toFixed(5)}`).join(' · ');
  const gallery = s.photos.length ? `
    <figure class="site-photo" id="site-photo">
      <div class="ph"><img src="${esc(s.photos[0].src)}" alt="${esc(s.photos[0].cap)}" loading="eager">
      ${s.photos.length > 1 ? '<button class="nav prev" aria-label="Previous photo">‹</button><button class="nav next" aria-label="Next photo">›</button>' : ''}</div>
      <figcaption></figcaption>
    </figure>
    ${s.photos.length > 1 ? `<div class="site-thumbs">${s.photos.map((p, i) => `<button data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}` :
    `<div class="site-nophoto">The report has no photo of this site.</div>`;
  document.getElementById('site-body').innerHTML = `
    <div class="site-head">
      <span class="site-pin k-${k}" style="width:30px;height:30px;background:${KIND_COLOR[k]}"></span>
      <div><div class="site-num">GIZ agrivoltaic site${s.upcoming ? ' · upcoming' : ''}</div><h2 id="site-title">${esc(s.name)}</h2>
      <div class="site-sub">${esc(s.dev)} · ${esc(s.place)}, ${esc(s.state)}</div></div>
    </div>
    <div class="site-grid">
      <div class="site-media">${gallery}</div>
      <div class="site-info">
        <div class="site-chips">${facts.slice(0, 3).map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
        <p class="site-about">${esc(s.about)}</p>
        <div class="site-crops"><span>Crops and farming</span>${esc(s.crops)}</div>
      </div>
    </div>
    <table class="spec site-specs"><tbody>
      ${facts.slice(3).map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}
      ${s.specs.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}
      <tr><td>GPS</td><td>${esc(gps)}${s.approx ? ' <span class="site-warn">approximate: the report gives only a map short link</span>' : ''}</td></tr>
    </tbody></table>
    <p class="site-src">Source: ${esc(data.source)}. Photo credits as given in the report.</p>`;
  const body = document.getElementById('site-body');
  body.querySelector('.prev')?.addEventListener('click', () => step(-1));
  body.querySelector('.next')?.addEventListener('click', () => step(1));
  body.querySelectorAll('.site-thumbs button').forEach(b => b.onclick = () => { photo = +b.dataset.i; renderPhoto(); });
  if (s.photos.length) renderPhoto();
  const modal = document.getElementById('site-modal');
  modal.hidden = false; modal.querySelector('.site-card').scrollTop = 0; modal.querySelector('.site-x').focus();
  const u = new URL(location.href); u.searchParams.set('site', s.id); history.replaceState(null, '', u);
}
