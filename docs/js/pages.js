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
    <li><b>Solar resource</b>: monthly and annual GHI and the annual diffuse share, from NASA POWER v10 monthly CERES SYN1deg data averaged over January 2001 to December 2020. GHI drives the energy model and the monthly GHI chart; the diffuse share is used in the shadow analysis.</li>
    <li><b>Climate</b>: from NASA POWER v10 monthly MERRA-2 data (0.5° × 0.625°), averaged over January 2001 to December 2020. What the dashboard uses:
      <ul>
        <li>monthly mean temperature and monthly rainfall: the climate charts, the Köppen cross-check, aridity, growing period and water deficit;</li>
        <li>hot months: the number of calendar months in which the highest daily maximum temperature reached in 2001–2020 is at least 35 °C (map layer, risk notes and the shade co-benefit);</li>
        <li>wind speed: annual and monthly wind at 10 m and annual wind at 50 m are shown; annual wind at 2 m sets module cooling in the energy model;</li>
        <li>relative humidity (annual) in the district panel, and frost days, which only raise a risk note above 5 days a year.</li>
      </ul>
      Year-by-year values (annual mean GHI, total rainfall, mean temperature and 10 m wind for each year 2001–2020) feed the year-by-year chart in the district panel.</li>
    <li><b>Agricultural land</b>: cropland share in 2024 and 2019 from the UMD GLAD annual cropland maps (Potapov et al. 2022 method, 30 m, averaged onto the 300 m cells). <i>Compact farmland</i> counts only the cropland in 300 m cells that are at least half cropland, which leaves out scattered plots, homestead gardens and field edges where an agrivoltaic array is hard to lay out.</li>
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
  <p>α is the crop group's shade sensitivity; β is the share of the light loss that partial shade wins back in hot, dry climates through lower leaf temperature and water stress. Published field trials report LER between 1.3 and 1.7 (Dupraz et al. 2011; Fraunhofer ISE Heggelbach; ICAR-CAZRI Jodhpur 1.42–1.62). Under Indian rules the dashboard checks the MNRE handbook's 80% yield rule; under international rules, the DIN SPEC 91434 floor of 66%, Japan's 80% and France's 90%. The α values follow the handbook's light-response classes (Table 4.1): soybean, groundnut and potato are moderately shade-tolerant (10–25% loss), maize, sorghum and sugarcane are shade-sensitive.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Crop group</th><th>Examples</th><th>α</th><th>Default gross margin / ha / yr</th></tr></thead><tbody>${cropRows}</tbody></table></div>
  <h3>Water saving</h3>
  <div class="formula">Evapotranspiration reduction = 0.6 × shade × (0.6 + 0.4 × aridity),  aridity = clamp((1500 − rain) / 1300, 0, 1)</div></div>

  <div class="card"><h2>4. Configurations</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Configuration</th><th>Default GCR</th><th>k_shade</th><th>Land loss</th><th>Yield factor</th><th>Bifacial</th><th>Cooling</th><th>Capex premium</th></tr></thead><tbody>${cfgRows}</tbody></table></div>
  <p>With configuration set to <b>auto</b> under international rules, each district uses the configuration recommended for its Köppen class: interspace in the hot desert, greenhouses in alpine and continental zones, elevated systems elsewhere. Under Indian rules, auto follows the handbook's agro-climatic zone table (Table 2.5): overhead fixed in the Indo-Gangetic plains, inter-row fixed on the rainfed peninsular plateau (500–800 mm), vertical east–west in semi-arid Rajasthan and Gujarat, and structure-integrated (greenhouse) on the Western Ghats and coast (over 2,000 mm); Himalayan regions keep the Köppen choice. Elevated systems add 4% capex for every metre of clearance above 3 m. Land loss follows reported values (handbook Section 3.5.4): overhead 5%, inter-row 12%, vertical 8%, trackers 18%.</p></div>

  <div class="card"><h2>5. Suitability and scenarios</h2>
  <div class="formula">Suitability = 100 × Σ wᵢ fᵢ / Σ wᵢ
f_solar = (GHI − 4.0) / 1.8      f_cropland = cropland share (GLAD 2024, or WorldCover 2021 if chosen) / 0.75
f_cobenefit = β / 0.6           f_water = aridity
× 0.4 for continental and alpine classes, × 0.7 where trees cover more than 60%</div>
  <p>A scenario converts a share of the agricultural land base of every district at or above the suitability threshold. The land base is compact farmland in 2024 by default (GLAD), and can be switched to all GLAD 2024 cropland or ESA WorldCover 2021 cropland under Scenario. Capacity = land base × adoption × density. Generation = capacity × specific yield. Investment = capacity × capex × (1 + configuration premium). CO₂ avoided = generation × ${GRID_EF} tCO₂/MWh.</p>
  <h3>Economics</h3>
  <div class="formula">LCOE (₹/kWh) = (capex × CRF + O&amp;M) ÷ annual generation,   CRF = r / (1 − (1 + r)^−25)</div></div>

  <div class="card"><h2>6. Module technology and financials</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Technology</th><th>Default efficiency</th><th>Temperature coefficient</th><th>Degradation</th><th>Bifaciality</th><th>Capex vs PERC</th></tr></thead><tbody>${modRows}</tbody></table></div>
  <div class="formula">Cash flow, year 0  = −capex per MWp
Cash flow, year y  = year-1 yield × (1 − degradation)^(y−1) × tariff − O&amp;M × 1.03^(y−1),   y = 1…25
Project IRR        = rate at which the 25-year NPV is zero (unlevered, pre-tax)
IRR incl. crops    = same, adding (relative crop yield − 1) × crop margin ÷ capacity density each year</div></div>

  <div class="card"><h2>7. Power grid</h2>
  <p>Transmission and sub-transmission lines (33–765 kV) and substations come from OpenStreetMap, read from the Overture Maps <code>base/infrastructure</code> release of October 2026 by <code>pipeline/build_grid.py</code>. For each district the script measures the distance from the district's interior point to the nearest ≥66 kV substation and the kilometres of line per 100 km².</p>
  <div class="formula">Grid score = 0.6 × clamp(1 − distance / 60 km) + 0.4 × clamp(line density / 10 km per 100 km²)</div>
  <p>OpenStreetMap is uneven across India and many lines carry no voltage tag, so the layer is indicative only.</p></div>

  <div class="card"><h2>8. Agro-climatic conditions</h2>
  <p>Districts are assigned to the Planning Commission's 15 agro-climatic regions by state and, for states that span regions, by sub-state lists. Reference evapotranspiration uses the Hargreaves radiation formula with district monthly temperature and solar radiation:</p>
  <div class="formula">ET0 (mm/day) = 0.0135 × (T + 17.8) × Rs / 2.45,   Rs in MJ/m²/day
Aridity index = annual rain ÷ annual ET0   (UNEP classes)
Growing period = days in months warmer than 5 °C with rain ≥ 0.5 × ET0, with up to 100 mm stored soil water</div></div>

  <div class="card"><h2>9. Shadow analysis</h2>
  <p>Rows are treated as infinitely long, so a 2D cross-section across them is exact. The sun position comes from latitude, day of year and solar time. For every point between two rows, and every 10 minutes of the 15th of each month, a ray toward the sun is tested against the panels. Direct light uses a clear-sky beam model; diffuse light is the sky view factor of the point, mixed in at the district's diffuse share from NASA POWER. Months are weighted by monthly GHI. The same rays from points on a module give the row-to-row shading loss. Trackers follow the sun to ±55° without backtracking. The 3D view renders the same geometry with three.js shadow maps.</p></div>

  <div class="card"><h2>10. Rule sets and handbook checks</h2>
  <p>The <b>Rules</b> switch at the top of the levers chooses between international rules (DIN SPEC 91434, France's APER decree, Japan's solar sharing, Italy's guidelines) and the MNRE <i>Agri-Photovoltaics Policy Handbook for India</i> (October 2026). The Indian rule set changes: clearance minimum 3.0 m (slider floor), the 80% yield rule, the auto crop (skips the Negative List), the auto configuration (agro-climatic zone), excludes districts with GHI under 4.0 kWh/m²/day from scenarios, uses the share of farmland within 5 km of a substation as the grid-access factor in the suitability score, and turns on the land screens. Both rule sets cap land loss at 10% (overhead) and 15% (inter-row, vertical) and coverage at 40%.</p>
  <div class="formula">Performance ratio ≈ year-1 AC yield ÷ (GHI × 365 × transposition factor)          benchmark ≥ 0.75
CUF = lifetime-average yield ÷ 8,760 h                                              benchmark ≥ 17%
Rainwater from panels (m³/ha of array/yr) = GCR × rainfall (m) × 10,000 × 0.8
Projects = scenario MWp ÷ 2 MW (plains) or ÷ 0.4 MW (Himalayan regions)
Row pitch check: pitch ≥ 1.5 × table width and a ≥ 3 m pathway between panel edges (Section 9.8.1); vertical 8–12 m</div></div>

  <div class="card"><h2>11. Handbook site screens</h2>
  <p><code>pipeline/build_screens.py</code> applies the GIS screens of handbook Table 2.1 (adapted from TERI 2025) on the same ~300 m grid as the land data, as shares of each district's compact farmland:</p>
  <ul>
    <li><b>Terrain:</b> slope from the Copernicus DEM GLO-90 (90 m). Kept: slope under 8°, and where the slope is 2° or more, facing south, south-east or south-west (azimuth 112.5–247.5°).</li>
    <li><b>Protected areas:</b> OpenStreetMap protected areas and national parks from Overture Maps <code>base/land_use</code> (subtype protected, October 2026 release), buffered by 1 km.</li>
    <li><b>Flood:</b> cells that flood more than 0.1 m in a 100-year river or coastal flood in the WRI Aqueduct Floods historical hazard maps (about 1 km, nearest-neighbour onto the 300 m grid). The pipeline falls back to a seasonal-water proxy from JRC Global Surface Water if the Aqueduct files are not given.</li>
    <li><b>Substation:</b> straight-line distance from each cell to the nearest of about 20,000 substations of any voltage in OpenStreetMap (Overture Maps <code>base/infrastructure</code>). The handbook asks for ≤5 km line-routing distance; straight-line distance is shorter, while missing 33/11 kV substations make it longer.</li>
  </ul>
  <div class="formula">R-value = farmland passing terrain, protected-area and flood screens ÷ compact farmland
Land base with screens = land base × R-value   (× share within 5 km of a substation, if chosen)
Handbook GIS potential = Σ compact farmland × R-value × 0.13 (horticulture share) × 0.42–0.75 MW/ha, districts with GHI ≥ 4.5</div>
  <p>This comes out several times above TERI's 1.2–2.1 TW on 2.8 million ha, because the soil-productivity screen (ICAR-NBSS) is not applied, OSM protected areas are less complete than WDPA, and the crop split is a national average. Read it as an upper bound.</p>
  <p>The handbook's crop-wise steps (crop area A<sub>i</sub>, cropping intensity C<sub>i</sub>, six horticultural crop categories) need MoAFW statistics that are not openly reachable, so the potential here has no crop split and no cropping-intensity division. Soil productivity (ICAR-NBSS) is not screened for the same reason.</p></div>

  <div class="card"><h2>12. Limitations</h2>
  <ul>
    <li>District averages hide large differences within a district, especially in hill districts and along coasts.</li>
    <li>NASA POWER solar data is about 100 km resolution and usually reads a few percent below high-resolution products such as Solargis or the Global Solar Atlas.</li>
    <li>Crop responses are simplified linear screening relations. Real responses depend on variety, season, irrigation and how light is spread under the array.</li>
    <li>Satellite cropland maps (GLAD, ESA WorldCover) include fallow and seasonally cropped land and do not tell irrigated from rain-fed land. They differ from the official Land Use Statistics (net sown area) of the Directorate of Economics and Statistics, which are not available as open, machine-readable district data for recent years.</li>
    <li>Not modelled: feeder and transformer headroom (the handbook's 60–75% loading band and 80% injection rule), land tenure and leasing, soil productivity, crop-wise area statistics. Slope, flood-prone land, protected areas and substation distance are screened from open data (section 11) and are indicative.</li>
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
    <tr><td>Solar irradiance (GHI, diffuse share)</td><td>${a('https://power.larc.nasa.gov/', 'NASA POWER')} v10, CERES SYN1deg monthly (${a('https://registry.opendata.aws/nasa-power/', 'AWS Open Data')})</td><td>1°, 2001–2020</td></tr>
    <tr><td>Temperature, rainfall, humidity, wind (2, 10, 50 m), frost days</td><td>NASA POWER v10, MERRA-2 monthly</td><td>0.5° × 0.625°, 2001–2020</td></tr>
    <tr><td>Agricultural land (cropland 2024 and 2019)</td><td>${a('https://glad.umd.edu/dataset/croplands', 'UMD GLAD')} annual cropland maps; Potapov, P. et al. (2022) <i>Nature Food</i> 3, 19–28</td><td>30 m, averaged to about 300 m</td></tr>
    <tr><td>Power grid (lines, substations)</td><td>${a('https://www.openstreetmap.org/', 'OpenStreetMap')} contributors via ${a('https://docs.overturemaps.org/', 'Overture Maps')} base/infrastructure (ODbL)</td><td>Release 2026-10-21</td></tr>
    <tr><td>Agro-climatic regions</td><td>Planning Commission (1989), Agro-Climatic Regional Planning</td><td>15 regions</td></tr>
    <tr><td>Mandis and their prices</td><td>Agmarknet daily prices via ${a('https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi', 'data.gov.in')} (Government Open Data License); SFAC ${a('https://enam.gov.in/web/', 'e-NAM')} Directory (July 2021). Positions matched to OpenStreetMap town names via Overture Maps divisions and places (ODbL)</td><td>Prices of 9–10 Nov 2026; about 1,500 mandis placed</td></tr>
    <tr><td>Cold storages</td><td>National Horticulture Board, ${a('https://nhb.gov.in/IcapMap/ICAPMap_rpt.aspx', 'Integrated Cold Chain Availability Platform')} map feed (NHB-assisted units)</td><td>4,934 points, downloaded 9 Nov 2026</td></tr>
    <tr><td>Substations (all voltages) and protected areas, for the handbook screens</td><td>OpenStreetMap contributors via Overture Maps base/infrastructure and base/land_use (ODbL)</td><td>Release 2026-10-21</td></tr>
    <tr><td>Terrain (slope, aspect)</td><td>${a('https://registry.opendata.aws/copernicus-dem/', 'Copernicus DEM GLO-90')} (© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA)</td><td>90 m</td></tr>
    <tr><td>Flood hazard, 100-year return period</td><td>${a('https://www.wri.org/data/aqueduct-floods-hazard-maps', 'WRI Aqueduct Floods')} hazard maps, historical riverine (WATCH 1960–1999) and coastal (no subsidence); Ward, P.J. et al. (2020) WRI technical note</td><td>~1 km</td></tr>
    <tr><td>Seasonally inundated land (fallback flood proxy)</td><td>${a('https://global-surface-water.appspot.com/', 'JRC Global Surface Water')} v1.4; Pekel, J.-F. et al. (2016) <i>Nature</i> 540, 418–422</td><td>30 m, 1984–2021</td></tr>
    <tr><td>Indian policy rules</td><td>MNRE (2026) <i>Agri-Photovoltaics Policy Handbook for India</i>, V1.0, October 2026, with NISE, ICAR, BIS, IIT Roorkee and the India Agrivoltaics Alliance</td><td>Rules, thresholds, screens</td></tr>
    <tr><td>Land cover (all classes)</td><td>${a('https://esa-worldcover.org/', 'ESA WorldCover 2021 v200')}</td><td>10 m, read at about 300 m</td></tr>
  </tbody></table></div></div>

  <div class="card"><h2>Agrivoltaics in India: research behind the defaults</h2>
  <ul>
    <li><b>Policy.</b> The MNRE <i>Agri-Photovoltaics Policy Handbook for India</i> (October 2026) defines AgriPV as dual land use with agriculture as the primary activity and electricity as a second activity, sets boundary conditions (up to 2 MW in the plains, ≤5 km to a substation, ≥3 m clearance, LLR 10–15%, crop Positive and Negative Lists, DCR bifacial modules), a 7-step GIS method adapted from TERI (2025), four business models from the India Agrivoltaics Alliance and an MRV reporting card. See the Policy &amp; rules page.</li>
    <li><b>Potential.</b> TERI (2025, <i>Agri-Photovoltaics Potential in India</i>, as cited by the MNRE handbook) estimates 1,192–2,129 GW of agrivoltaics on 2.8 million ha of highly suitable cropland, mostly horticulture, at 0.42–0.75 MW/ha. As of August 2025 India had 36 operational agrivoltaic projects totalling 37.5 MW. ${a('https://taiyangnews.info/markets/teri-indias-agrivoltaic-potential-may-reach-21-tw', 'TaiyangNews summary')} · ${a('https://www.teriin.org/policy-brief/agri-photovoltaics-potential-india-pathways-sustainable-energy-food-solutions', 'TERI policy brief')}</li>
    <li><b>Field evidence.</b> ICAR-CAZRI's 105 kW system in Jodhpur (2017) grows arid-zone pulses, cumin, isabgol and aloe between panel rows, recycles rainwater from the panels (about 1.5 lakh litres per acre) and reports LER of 1.42–1.62. ${a('https://www.cazri.res.in/publications/technologies/T18E.pdf', 'CAZRI technology sheet')}</li>
    <li><b>Costs and policy.</b> Agri-PV raises capital cost by 15–25% over conventional solar; PM-KUSUM Component A tariffs have been about ₹3.0–3.45/kWh, with 10 GW sanctioned. ${a('https://renewablewatch.in/2026/01/07/promising-pathway-pm-kusum-2-0-could-give-a-bigger-push-to-agrivoltaics', 'Renewable Watch (2026)')} · ${a('https://cstep.in/publication/tariff-design-and-revenue-optimization-for-agrivoltaics-projects-under-the-pm-kusum-scheme-a-financial-viability-analysis-for-madhya-pradesh-india/', 'CSTEP tariff study')} · ${a('https://www.climatepolicyinitiative.org/publication/tapping-the-potential-ofagriphotovoltaics-in-india/', 'CPI: Tapping the potential of agri-PV in India')}</li>
    <li><b>Standards.</b> MNRE handbook (2026): clear height ≥3 m (4.0–4.5 m for tractors, 5 m for combines), yield ≥80% of baseline, LLR ≤10% overhead and ≤15% inter-row and vertical, GCR 30–40% for field crops with a proposed 40% upper bound. DIN SPEC 91434: Category I overhead (≥2.1 m clearance, ≤10% land loss), Category II interspace (≤15% land loss), crop yield at least 66% of the reference. France (2024 decree) caps coverage at 40% and allows at most a 10% yield loss. Japan's solar-sharing permits ask for at least 80% of normal yield. ${a('https://www.tib-op.org/ojs/index.php/agripv/article/download/2539/2756', 'AgriVoltaics Conference Proceedings')}</li>
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
    <li>Potapov, P. et al. (2022). Global maps of cropland extent and change show accelerated cropland expansion in the twenty-first century. <i>Nature Food</i> 3, 19–28.</li>
    <li>Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). <i>Journal of Climate</i> 30, 5419–5454.</li>
    <li>Hargreaves, G.H. (1975). Moisture availability and crop production. <i>Transactions of the ASAE</i> 18, 980–984.</li>
    <li>Marion, B. et al. (2017). A practical irradiance model for bifacial PV modules. <i>IEEE PVSC</i>.</li>
    <li>Dupraz, C. (2024). Assessment of the ground coverage ratio of agrivoltaic systems as a proxy for potential crop productivity. <i>Agroforestry Systems</i> 98, 2679–2696.</li>
    <li>Ward, P.J. et al. (2020). <i>Aqueduct Floods Methodology</i>. Technical note, World Resources Institute, Washington, DC.</li>
    <li>Pekel, J.-F. et al. (2016). High-resolution mapping of global surface water and its long-term changes. <i>Nature</i> 540, 418–422.</li>
    <li>Fraunhofer ISE (2024). <i>Agrivoltaics: Opportunities for Agriculture and the Energy Transition</i> (guideline).</li>
  </ul></div>
  <p class="footer-note">Built as an open screening tool. Numbers are indicative; check site conditions before investing.</p>`;
}


// Policy & rules page: international rules next to the MNRE handbook (2026)
export function policyHTML({ rules, RULES, CROPS, NEGATIVE, POSITIVE, HANDBOOK, ghiCount, waterCount, meta }) {
  const hl = k => rules === k ? ' class="hl"' : '';
  const row = (p, i, n) => `<tr><td>${p}</td><td${hl('intl')}>${i}</td><td${hl('india')}>${n}</td></tr>`;
  const lab = list => list.map(k => CROPS[k] ? CROPS[k].label : k).join(', ');
  return `
  <div class="hero"><h1 class="hero-title">Policy <span class="gradient-text">&amp; rules</span></h1>
  <p class="hero-sub">The dashboard can check designs against international agrivoltaic rules or the MNRE <i>Agri-Photovoltaics Policy Handbook for India</i> (October 2026). Use the Rules switch at the top of the levers panel. Now active: <b>${rules === 'india' ? 'India (MNRE 2026)' : 'International'}</b>.</p></div>

  <div class="card"><h2>The two rule sets</h2>
  <div class="tbl-wrap"><table class="tbl rule-cmp"><thead><tr><th>Rule</th><th>International (DIN SPEC 91434, France, Japan, Italy)</th><th>India (MNRE handbook, 2026)</th></tr></thead><tbody>
    ${row('Definition', 'Agriculture primary; DIN Category I overhead, Category II interspace', 'Dual land use with agriculture primary and electricity a "second activity" (not a "third crop"); land stays agricultural')}
    ${row('Minimum clearance (overhead)', '2.1 m (DIN); France 4 m at the torque tube for its auctions', '3.0 m at the lowest point; 4.0–4.5 m for tractors; 5.0 m for combines; top edge ≤6 m')}
    ${row('Crop yield floor', 'DIN ≥66% of reference; Japan ≥80%; France ≥90%', '≥80% of baseline yield of the same crop on the same land')}
    ${row('Land loss', 'DIN ≤10% Category I, ≤15% Category II; France ≤10%', 'LLR ≤10% overhead, ≤15% inter-row and vertical; ≥85–90% of the area stays cultivable')}
    ${row('Coverage / GCR', 'France ≤40% (>10 MW); Italy ≤40%, ≥70% of area farmed', '30–40% for field crops (advisory); <25% keeps yield above 80%; 40% proposed upper bound')}
    ${row('Crops', 'No national list', 'Positive List: ' + lab(POSITIVE) + '. Negative List beneath the array: ' + lab(NEGATIVE) + ' (inter-row strips or MNRE exception only)')}
    ${row('Solar resource', 'Not specified', 'GHI ≥4.5 kWh/m²/day for the GIS potential; 4.0–4.5 eligible; <4.0 excluded')}
    ${row('Grid', 'Not specified', 'Up to 2 MW in the plains, 300–500 kW in hills; ≤5 km line-routing distance to a substation; feeder loading 60–75%; injection ≤80% of minimum daytime load')}
    ${row('Site screens', 'Not specified', 'Cropland; slope <8° with S/SE/SW aspect; productive soils; no flood-prone land; protected areas + 1 km buffer excluded; forest land not eligible')}
    ${row('Modules', 'Not specified', 'ALMM-listed, DCR-compliant bifacial, glass-glass preferred; bifaciality ≥0.70 for vertical systems; IEC TS 63126 for heat')}
    ${row('Auto configuration in the dashboard', 'By Köppen class', 'By agro-climatic zone (Table 2.5)')}
  </tbody></table></div></div>

  <div class="card"><h2>What the Indian rules mean across India</h2>
  <ul>
    <li><b>Solar resource:</b> ${ghiCount.gis} districts at ≥4.5 kWh/m²/day, ${ghiCount.ok} between 4.0 and 4.5, and ${ghiCount.out} below 4.0 (excluded from scenarios under Indian rules). Map layer: Handbook GHI class.</li>
    <li><b>Water:</b> ${waterCount.irr} districts get less than 600 mm of rain a year, where the handbook asks for assured groundwater or irrigation. Map layer: Handbook water rule.</li>
    <li><b>Site screens:</b> ${meta ? 'map layers R-value, farmland within 5 km of a substation, terrain, protected areas and flood-prone farmland; built from Overture Maps ' + meta.overture + ', ' + meta.dem + ' and ' + meta.water + '.' : 'not loaded.'}</li>
  </ul></div>

  <div class="card"><h2>Agro-climatic zone and typology (handbook Table 2.5)</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zone</th><th>Rainfall</th><th>Typology</th><th>Key crops</th></tr></thead><tbody>
    <tr><td>Indo-Gangetic Plains</td><td>600–1,000 mm</td><td>Overhead fixed</td><td>Vegetables, soybean, fodder</td></tr>
    <tr><td>Peninsular Plateau (rainfed)</td><td>500–800 mm</td><td>Interspace fixed</td><td>Soybean, vegetables, pulses</td></tr>
    <tr><td>Semi-arid (Rajasthan, Gujarat)</td><td>300–600 mm</td><td>Vertical east–west</td><td>Fodder, cash crops, vegetables</td></tr>
    <tr><td>Western Ghats and coastal</td><td>&gt;2,000 mm</td><td>Structure-integrated (greenhouse)</td><td>Spices, floriculture, orchards</td></tr>
  </tbody></table></div></div>

  <div class="card"><h2>Reference configurations (handbook Table 9.7)</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Configuration</th><th>Crop</th><th>GCR</th><th>Clearance</th><th>Row spacing</th><th>Module</th><th>Expected LER</th></tr></thead><tbody>
    <tr><td>Elevated stilt, fixed tilt</td><td>Turmeric, leafy vegetables, coriander</td><td>30%</td><td>4.0 m</td><td>5.0 m</td><td>370 Wp bifacial mono</td><td>1.5–1.8</td></tr>
    <tr><td>Inter-row, canopy height</td><td>Grape (trellis)</td><td>12%</td><td>Canopy height</td><td>1.8 m</td><td>310 Wp poly</td><td>1.1–1.3</td></tr>
    <tr><td>Vertical east–west bifacial</td><td>Pulses, cotton (rainfed)</td><td>35%</td><td>n/a</td><td>7.0 m</td><td>400 Wp bifacial</td><td>1.2–1.5</td></tr>
  </tbody></table></div></div>

  <div class="card"><h2>Business models and farmer rights (handbook Section 1.4)</h2>
  <ul>
    <li><b>Farmer-owned:</b> the farmer is landowner, generator and cultivator, and keeps all income; capex from equity, loans or state subsidy. For farmers with ≥2 acres, credit access and an 11 kV feeder within 5 km.</li>
    <li><b>Community-owned (FPO, cooperative, panchayat, WUA):</b> pooled land and finance (NABARD, cooperative banks); electricity revenue shared by a disclosed formula.</li>
    <li><b>Developer-led:</b> the developer owns the plant on leased land; the farmer farms (sub-variant A) or the developer also farms (B). Lease at least fair market rent, indexed to WPI or CPI (Rural), secured by a bank guarantee; RESCO variant shares revenue with the farmer.</li>
    <li><b>DISCOM / public utility:</b> the public entity owns or contracts the plant on leased land; lease rates notified by the SNA; suited to remote or hilly areas.</li>
    <li><b>Rights in every model:</b> land ownership, the right to farm, all crop income, annual generation reports, and recourse without a lawyer for claims under ₹5 lakh.</li>
  </ul></div>

  <div class="card"><h2>Monitoring targets (handbook MRV reporting card, Table 10.8)</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicator</th><th>Target</th></tr></thead><tbody>
    <tr><td>Performance ratio</td><td>≥0.75</td></tr><tr><td>CUF</td><td>≥17%</td></tr><tr><td>PAR reduction at the crop</td><td>15–35%</td></tr>
    <tr><td>Crop yield</td><td>≥80% of baseline</td></tr><tr><td>Irrigation water productivity</td><td>≥ baseline WUE (kg/m³); irrigation saving ≥10% desirable</td></tr>
    <tr><td>Cultivable area</td><td>≥85–90% of the project area</td></tr><tr><td>Cropping intensity</td><td>≥80% of the regional baseline</td></tr>
    <tr><td>LER</td><td>&gt;1</td></tr><tr><td>Soil</td><td>pH within ±0.5, SOC ≥90% of baseline, no significant rise in EC or compaction</td></tr>
    <tr><td>Farm operations</td><td>Operation time ≤120% of baseline; ≥90% of area accessible</td></tr><tr><td>Data completeness</td><td>≥95%</td></tr>
  </tbody></table></div>
  <p class="footer-note">Source: MNRE (2026) Agri-Photovoltaics Policy Handbook for India, V1.0. The handbook's provisions are advisory; statutory and regulatory provisions prevail.</p></div>`;
}
