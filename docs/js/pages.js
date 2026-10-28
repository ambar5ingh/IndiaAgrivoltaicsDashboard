// Methodology and sources pages.
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export function methodHTML({ CONFIGS, CROPS, MODULES, REF_GCR, GRID_EF }) {
  const modRows = Object.values(MODULES).map(m => `<tr><td>${m.label}</td><td>${m.eff}%</td><td>${m.gamma}%/°C</td><td>${m.deg}%/yr</td><td>${m.bifi ? Math.round(m.bifi * 100) + '%' : 'monofacial'}</td><td>${m.capexAdj >= 0 ? '+' : ''}${Math.round(m.capexAdj * 100)}%</td></tr>`).join('');
  const cfgRows = Object.values(CONFIGS).map(c => `<tr><td>${c.label}</td><td>${c.gcr}</td><td>${c.kshade}</td><td>${Math.round(c.landLoss * 100)}%</td><td>${c.ftilt}</td><td>+${Math.round(c.bif * 100)}%</td><td>${c.tcool} °C</td><td>+${Math.round(c.prem * 100)}%</td></tr>`).join('');
  const cropRows = Object.entries(CROPS).filter(([k]) => k !== 'auto').map(([, c]) => `<tr><td>${c.label}</td><td>${c.examples}</td><td>${c.alpha}</td><td>₹${(c.margin / 1000).toLocaleString('en-IN')}k</td></tr>`).join('');
  return `
  <div class="hero"><h1 class="hero-title">How the <span class="gradient-text">dashboard works</span></h1>
  <p class="hero-sub">A transparent screening model for all 791 districts. It is meant for comparing districts and testing levers, not for designing a specific site.</p></div>

  <div class="card"><h2>1. District data</h2>
  <p>For every district the build script (<code>pipeline/build_data.py</code>) samples about 300 m grid cells inside the boundary and averages:</p>
  <ul>
    <li><b>Köppen-Geiger class</b>: area shares from the 1986–2010 Köppen-Geiger map (Rubel et al. 2017, via the <code>kgcpy</code> package). The class covering the largest share is the district's class. Where the monsoon makes both the dry-summer (s) and dry-winter (w) rules hold, which the Rubel/Kottek rules settle in favour of "s", the class is set to dry-winter when the warm half-year is wetter. That is the Peel et al. (2007) precedence used by Beck et al. (2018). A second class is computed from NASA POWER monthly temperature and rainfall as a cross-check; the two agree in about 80% of districts.</li>
    <li><b>Solar resource</b>: GHI, DNI, diffuse and PAR from NASA POWER v10 climatology (CERES SYN1deg, 2001–2020).</li>
    <li><b>Climate</b>: monthly mean, maximum and minimum temperature, rainfall, humidity, wind and frost days from NASA POWER (MERRA-2, 2001–2020).</li>
    <li><b>Land cover</b>: shares of cropland, trees, grass, built-up and other classes from ESA WorldCover 2021.</li>
  </ul></div>

  <div class="card"><h2>2. Energy</h2>
  <div class="formula">Year-1 yield (kWh/kWp/yr) = GHI × 365 × F_tilt × (1 − temperature loss) × (1 − soiling) × 0.86 × (1 + bifacial gain)
Lifetime-average yield  = year-1 yield × (1 − degradation × 12)
F_tilt          = (1 + 0.0045 × |latitude|) × configuration factor   (tracker 1.13, vertical 0.80)
Cell temperature ≈ T_mean + 24 − ventilation cooling − 1.0 × (wind − 2 m/s)
Temperature loss = |γ| × max(0, T_cell − 25)        (γ from the module technology)
Capacity density (MWp/ha) = GCR × module efficiency × 10
Energy per ha (MWh/ha/yr) = density × specific yield</div>
  <p>0.86 covers inverter, wiring, mismatch and availability losses. Degradation, temperature coefficient and bifaciality come from the module technology (section 5). Soiling is 2–6% depending on the climate class, highest in the Thar desert.</p></div>

  <div class="card"><h2>3. Crop and Land Equivalent Ratio</h2>
  <div class="formula">Shade (light reduction at crop level) = GCR × k_shade(configuration)
Relative crop yield = (1 − land loss) × (1 − α × shade + β × shade)
β = climate co-benefit of the Köppen class + 0.01 per month with Tmax ≥ 35 °C (max +0.10)
Electricity term   = energy per ha ÷ energy per ha of a conventional plant (GCR ${REF_GCR}, same modules)
LER = relative crop yield + electricity term</div>
  <p>α is the crop group's shade sensitivity; β is the share of the light loss that partial shade wins back in hot, dry climates through lower leaf temperature and water stress. Published field trials report LER between 1.3 and 1.7 (Dupraz et al. 2011; Fraunhofer ISE Heggelbach; ICAR-CAZRI Jodhpur 1.42–1.62). The dashboard flags designs that fall below the DIN SPEC 91434 floor of 66% crop yield, or Japan's 80% rule.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Crop group</th><th>Examples</th><th>α</th><th>Default gross margin / ha / yr</th></tr></thead><tbody>${cropRows}</tbody></table></div>
  <h3>Water saving</h3>
  <div class="formula">Evapotranspiration reduction = 0.6 × shade × (0.6 + 0.4 × aridity),  aridity = clamp((1500 − rain) / 1300, 0, 1)</div></div>

  <div class="card"><h2>4. Configurations</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Configuration</th><th>Default GCR</th><th>k_shade</th><th>Land loss</th><th>Yield factor</th><th>Bifacial</th><th>Cooling</th><th>Capex premium</th></tr></thead><tbody>${cfgRows}</tbody></table></div>
  <p>With configuration set to <b>auto</b>, each district uses the configuration recommended for its Köppen class: interspace in the hot desert, greenhouses in alpine and continental zones, elevated systems elsewhere. Elevated systems add 4% capex for every metre of clearance above 3 m.</p></div>

  <div class="card"><h2>5. Suitability and scenarios</h2>
  <div class="formula">Suitability = 100 × Σ wᵢ fᵢ / Σ wᵢ
f_solar = (GHI − 4.0) / 1.8      f_cropland = cropland share / 0.75
f_cobenefit = β / 0.6           f_water = aridity
× 0.4 for continental and alpine classes, × 0.7 where trees cover more than 60%</div>
  <p>A scenario converts a share of the cropland of every district at or above the suitability threshold. Capacity = cropland × adoption × density. Generation = capacity × specific yield. Investment = capacity × capex × (1 + configuration premium). CO₂ avoided = generation × ${GRID_EF} tCO₂/MWh.</p>
  <h3>Economics</h3>
  <div class="formula">LCOE (₹/kWh) = (capex × CRF + O&amp;M) ÷ annual generation,   CRF = r / (1 − (1 + r)^−25)</div></div>

  <div class="card"><h2>6. Module technology and financials</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Technology</th><th>Default efficiency</th><th>Temperature coefficient</th><th>Degradation</th><th>Bifaciality</th><th>Capex vs PERC</th></tr></thead><tbody>${modRows}</tbody></table></div>
  <div class="formula">Cash flow, year 0  = −capex per MWp
Cash flow, year y  = year-1 yield × (1 − degradation)^(y−1) × tariff − O&amp;M × 1.03^(y−1),   y = 1…25
Project IRR        = rate at which the 25-year NPV is zero (unlevered, pre-tax)
IRR incl. crops    = same, adding (relative crop yield − 1) × crop margin ÷ capacity density each year</div></div>

  <div class="card"><h2>7. Power grid</h2>
  <p>Transmission lines (66–765 kV) and substations come from OpenStreetMap, read from the Overture Maps <code>base/infrastructure</code> release of October 2026 by <code>pipeline/build_grid.py</code>. For each district the script measures the distance from the district's interior point to the nearest ≥66 kV substation and the kilometres of line per 100 km².</p>
  <div class="formula">Grid score = 0.6 × clamp(1 − distance / 60 km) + 0.4 × clamp(line density / 10 km per 100 km²)</div>
  <p>OpenStreetMap is uneven across India and many lines carry no voltage tag, so the layer is indicative only.</p></div>

  <div class="card"><h2>8. Agro-climatic conditions</h2>
  <p>Districts are assigned to the Planning Commission's 15 agro-climatic regions by state and, for states that span regions, by sub-state lists. Reference evapotranspiration uses the Hargreaves radiation formula with district monthly temperature and solar radiation:</p>
  <div class="formula">ET0 (mm/day) = 0.0135 × (T + 17.8) × Rs / 2.45,   Rs in MJ/m²/day
Aridity index = annual rain ÷ annual ET0   (UNEP classes)
Growing period = days in months warmer than 5 °C with rain ≥ 0.5 × ET0, with up to 100 mm stored soil water</div></div>

  <div class="card"><h2>9. Shadow analysis</h2>
  <p>Rows are treated as infinitely long, so a 2D cross-section across them is exact. The sun position comes from latitude, day of year and solar time. For every point between two rows, and every 10 minutes of the 15th of each month, a ray toward the sun is tested against the panels. Direct light uses a clear-sky beam model; diffuse light is the sky view factor of the point, mixed in at the district's diffuse share from NASA POWER. Months are weighted by monthly GHI. The same rays from points on a module give the row-to-row shading loss. Trackers follow the sun to ±55° without backtracking. The 3D view renders the same geometry with three.js shadow maps.</p></div>

  <div class="card"><h2>10. Limitations</h2>
  <ul>
    <li>District averages hide large differences within a district, especially in hill districts and along coasts.</li>
    <li>NASA POWER solar data is about 100 km resolution and usually reads a few percent below high-resolution products such as Solargis or the Global Solar Atlas.</li>
    <li>Crop responses are simplified linear screening relations. Real responses depend on variety, season, irrigation and how light is spread under the array.</li>
    <li>ESA WorldCover cropland includes fallow and seasonally cropped land, and does not tell irrigated from rain-fed land.</li>
    <li>Not modelled: grid connection and substation capacity, land tenure and leasing, slope, flood zones, protected areas.</li>
    <li>District boundaries follow the source shapefile, including areas administered by other countries that India claims.</li>
  </ul></div>`;
}

export function sourcesHTML() {
  return `
  <div class="hero"><h1 class="hero-title">Data &amp; <span class="gradient-text">sources</span></h1>
  <p class="hero-sub">Every input is open data. The build script that produces <code>data/districts.json</code> is in the repository's <code>pipeline</code> folder.</p></div>

  <div class="card"><h2>Datasets</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Source</th><th>Resolution and period</th></tr></thead><tbody>
    <tr><td>District boundaries (790)</td><td>${a('https://github.com/datta07/INDIAN-SHAPEFILES', 'datta07/INDIAN-SHAPEFILES')}, INDIA_DISTRICTS.geojson</td><td>Current districts, simplified to about 1 km for the web</td></tr>
    <tr><td>Köppen-Geiger class</td><td>Rubel, Brugger, Haslinger &amp; Auer (2017), <i>Meteorologische Zeitschrift</i> 26, via ${a('https://pypi.org/project/kgcpy/', 'kgcpy')}</td><td>100 arc-seconds, 1986–2010</td></tr>
    <tr><td>Solar irradiance (GHI, DNI, diffuse, PAR)</td><td>${a('https://power.larc.nasa.gov/', 'NASA POWER')} v10, CERES SYN1deg climatology (${a('https://registry.opendata.aws/nasa-power/', 'AWS Open Data')})</td><td>1°, 2001–2020</td></tr>
    <tr><td>Temperature, rainfall, humidity, wind, frost</td><td>NASA POWER v10, MERRA-2 climatology</td><td>0.5° × 0.625°, 2001–2020</td></tr>
    <tr><td>Power grid (lines, substations)</td><td>${a('https://www.openstreetmap.org/', 'OpenStreetMap')} contributors via ${a('https://docs.overturemaps.org/', 'Overture Maps')} base/infrastructure (ODbL)</td><td>Release 2026-10-21</td></tr>
    <tr><td>Agro-climatic regions</td><td>Planning Commission (1989), Agro-Climatic Regional Planning</td><td>15 regions</td></tr>
    <tr><td>Land cover (cropland share)</td><td>${a('https://esa-worldcover.org/', 'ESA WorldCover 2021 v200')}</td><td>10 m, read at about 300 m</td></tr>
  </tbody></table></div></div>

  <div class="card"><h2>Agrivoltaics in India: research behind the defaults</h2>
  <ul>
    <li><b>Potential.</b> TERI (2026) estimates 1,192–2,129 GW of agrivoltaics on 2.8 million ha of highly suitable cropland, mostly horticulture, at 0.42–0.75 MW/ha. As of August 2025 India had 36 operational agrivoltaic projects totalling 37.5 MW. ${a('https://taiyangnews.info/markets/teri-indias-agrivoltaic-potential-may-reach-21-tw', 'TaiyangNews summary')} · ${a('https://www.teriin.org/policy-brief/agri-photovoltaics-potential-india-pathways-sustainable-energy-food-solutions', 'TERI policy brief')}</li>
    <li><b>Field evidence.</b> ICAR-CAZRI's 105 kW system in Jodhpur (2017) grows arid-zone pulses, cumin, isabgol and aloe between panel rows, recycles rainwater from the panels (about 1.5 lakh litres per acre) and reports LER of 1.42–1.62. ${a('https://www.cazri.res.in/publications/technologies/T18E.pdf', 'CAZRI technology sheet')}</li>
    <li><b>Costs and policy.</b> Agri-PV raises capital cost by 15–25% over conventional solar; PM-KUSUM Component A tariffs have been about ₹3.0–3.45/kWh, with 10 GW sanctioned. ${a('https://renewablewatch.in/2026/01/07/promising-pathway-pm-kusum-2-0-could-give-a-bigger-push-to-agrivoltaics', 'Renewable Watch (2026)')} · ${a('https://cstep.in/publication/tariff-design-and-revenue-optimization-for-agrivoltaics-projects-under-the-pm-kusum-scheme-a-financial-viability-analysis-for-madhya-pradesh-india/', 'CSTEP tariff study')} · ${a('https://www.climatepolicyinitiative.org/publication/tapping-the-potential-ofagriphotovoltaics-in-india/', 'CPI: Tapping the potential of agri-PV in India')}</li>
    <li><b>Standards.</b> DIN SPEC 91434: Category I overhead (≥2.1 m clearance, ≤10% land loss), Category II interspace (≤15% land loss), crop yield at least 66% of the reference. France (2024 decree) caps coverage at 40% and allows at most a 10% yield loss. Japan's solar-sharing permits ask for at least 80% of normal yield. ${a('https://www.tib-op.org/ojs/index.php/agripv/article/download/2539/2756', 'AgriVoltaics Conference Proceedings')}</li>
    <li><b>Programmes.</b> ${a('https://indiaagripv.org/dashboard', 'Indian Agrivoltaics Alliance (NSEFI, TERI, CSTEP): National Agrivoltaics Dashboard')} · ${a('https://energyforum.in/fileadmin/india/media_elements/publications/20240502_AgriPV_in_India/Agrivoltaics_in_India.pdf', 'Indo-German Energy Forum: Agrivoltaics in India (2024)')} · ${a('https://cstep.in/drupal/sites/default/files/2023-02/Agrivoltaics%20for%20the%20Indian%20condition.pdf', 'CSTEP: Agrivoltaics for the Indian condition')}</li>
  </ul></div>

  <div class="card"><h2>Scientific references</h2>
  <ul>
    <li>Beck, H.E. et al. (2018). Present and future Köppen-Geiger climate classification maps at 1-km resolution. <i>Scientific Data</i> 5, 180214.</li>
    <li>Peel, M.C., Finlayson, B.L. &amp; McMahon, T.A. (2007). Updated world map of the Köppen-Geiger climate classification. <i>HESS</i> 11, 1633–1644.</li>
    <li>Rubel, F. et al. (2017). Climate change impacts on the Köppen-Geiger climate classification. <i>Meteorologische Zeitschrift</i> 26, 115–125.</li>
    <li>Dupraz, C. et al. (2011). Combining solar photovoltaic panels and food crops for optimising land use. <i>Renewable Energy</i> 36, 2725–2732.</li>
    <li>Marrou, H. et al. (2013). Microclimate under agrivoltaic systems: is crop growth rate affected in the partial shade of solar panels? <i>Agricultural and Forest Meteorology</i> 177, 117–132.</li>
    <li>Barron-Gafford, G.A. et al. (2019). Agrivoltaics provide mutual benefits across the food–energy–water nexus in drylands. <i>Nature Sustainability</i> 2, 848–855.</li>
    <li>Weselek, A. et al. (2019). Agrophotovoltaic systems: applications, challenges, and opportunities. A review. <i>Agronomy for Sustainable Development</i> 39, 35.</li>
    <li>Laub, M. et al. (2022). Contrasting yield responses at varying levels of shade suggest different suitability of crops for dual land-use systems: a meta-analysis. <i>Agronomy for Sustainable Development</i> 42, 51.</li>
    <li>Hargreaves, G.H. (1975). Moisture availability and crop production. <i>Transactions of the ASAE</i> 18, 980–984.</li>
    <li>Marion, B. et al. (2017). A practical irradiance model for bifacial PV modules. <i>IEEE PVSC</i>.</li>
    <li>Fraunhofer ISE (2024). <i>Agrivoltaics: Opportunities for Agriculture and the Energy Transition</i> (guideline).</li>
  </ul></div>
  <p class="footer-note">Built as an open screening tool. Numbers are indicative; check site conditions before investing.</p>`;
}
