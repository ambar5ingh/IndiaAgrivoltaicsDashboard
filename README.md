# India Agrivoltaics Dashboard

A district-level agrivoltaics (agri-PV) screening dashboard for all 791 districts of India, published with GitHub Pages from the `docs/` folder.

**Live site:** https://ambar5ingh.github.io/IndiaAgrivoltaicsDashboard/

## What it shows

- **Rules switch:** at the top of the levers panel, switch between **International** rules (DIN SPEC 91434, France, Japan, Italy: 2.1 m clearance, 66% yield floor) and **India (MNRE 2026)** rules from the MNRE Agri-Photovoltaics Policy Handbook (3 m clearance, 80% yield floor, Negative List crops kept to inter-row strips, districts under 4.0 kWh/m²/day excluded, design by agro-climatic zone from Table 2.5, and the Chapter 2 land screens). The **Policy** page compares the two and summarises the handbook.
- **Map (centre):** every district coloured by one of 36 layers: Köppen-Geiger climate class, agro-climatic region, agrivoltaic suitability, project IRR, payback, distance to a substation, grid line density, aridity index, length of growing period, scenario capacity, Land Equivalent Ratio (LER), relative crop yield, GHI, specific yield, LCOE, land base, cropland 2024, compact farmland 2024, cropland change 2019–2024, WorldCover cropland 2021, water saving, rainfall, temperature, hot months, wind speed at 10 and 50 m, and the handbook layers: GHI class, the 600 mm rainfall rule, R-value (screened farmland share), farmland within 5 km of a substation, median distance to a substation, slope and aspect, protected areas, flood exposure, rainwater from panels and the number of 2 MW projects. Filter by state, search a district, toggle a basemap, a latitude/longitude grid and the **power grid** (33–765 kV lines and substations from OpenStreetMap, with an On/Off switch per voltage in the legend).
- **Left panel, Scenario & levers:** four scenarios (KUSUM-scale 2030, Moderate 2035, Ambitious 2047, Technical potential), agricultural land base (compact farmland 2024 by default, all cropland 2024, or WorldCover 2021), adoption share, suitability threshold, system configuration (elevated, interspace, tracker, vertical bifacial, PV greenhouse, or auto by climate zone), GCR, clearance height, module technology (monocrystalline TOPCon, PERC or HJT, or polycrystalline), bifacial modules, crop group, crop margin, capex, tariff, discount rate, O&M and suitability weights.
- **Left panel, District specs:** Köppen class and area shares, key indicators, LER split, agro-climatic conditions (Planning Commission region, aridity, growing period, monthly water deficit), grid access, seasonal GHI (Kharif, Rabi, Zaid), CUF, performance ratio, land loss ratio, rainwater harvest, design checks against the active rule set, the handbook site screens, a shadow summary, financials (IRR, payback, NPV, 25-year cash flow), the recommended design (configuration, GCR, clearance, tilt, row pitch, MWp/ha, energy per ha), suitable crops, monthly solar, rain, temperature and wind charts, year-by-year sun, rain, temperature and wind for 2001–2020 with the trend, agricultural land use (cropland 2024, compact farmland, change since 2019), land cover, design risks and the district's scenario result.
- **Left panel, Rankings:** top districts by suitability, capacity, LER, LCOE or IRR.
- **Shadow analysis page:** sun path and shadows for any district, month and hour: a 2D cross-section of the rows, a 3D view (three.js) with live shadows, light across the row for the crops and row-to-row shading loss for the modules, by month.
- **KPIs above the map:** capacity, generation, land shared, average LER, project IRR, investment and CO₂ avoided for India or the selected state.
- Every lever and metric has an (i) button explaining it. The Köppen guide, Methodology and Data & sources pages document the model and cite the research.
- **Copy link** saves the full view in the URL; **Download CSV** exports all district results for the current scenario.

## Data

| Data | Source |
|---|---|
| District boundaries | [datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) |
| Köppen-Geiger class | Rubel et al. (2017), 1986–2010, via [kgcpy](https://pypi.org/project/kgcpy/); s/w precedence harmonised with Peel et al. (2007) |
| Solar (GHI, diffuse share) | NASA POWER v10 CERES SYN1deg monthly, averaged here over 2001–2020 (AWS Open Data) |
| Climate (temperature, rainfall, humidity, wind at 2/10/50 m) | NASA POWER v10 MERRA-2 monthly (0.5° × 0.625°), averaged here over 2001–2020 |
| Agricultural land (default land base) | UMD GLAD annual cropland 2024 and 2019 (30 m; Potapov et al. 2022, *Nature Food*) |
| Land cover | ESA WorldCover 2021 v200 |
| Power grid | © OpenStreetMap contributors, via Overture Maps `base/infrastructure` (ODbL) |
| Agro-climatic regions | Planning Commission (1989) 15 regions; PET by Hargreaves (1975) |
| Substations for the 5 km rule (all voltages) and protected areas | © OpenStreetMap contributors, via Overture Maps `base/infrastructure` and `base/land_use` (release 2026-10-21.0) |
| Slope and aspect | Copernicus DEM GLO-90 (COGs on AWS Open Data) |
| Flood hazard | [WRI Aqueduct Floods](https://www.wri.org/data/aqueduct-floods-hazard-maps) historical 100-year riverine and coastal maps (depth > 0.1 m); JRC Global Surface Water v1.4 as a fallback |
| Rules, screens, typologies | MNRE Agri-Photovoltaics Policy Handbook (October 2026); TERI (2025) GIS method |

## Rebuild the data

```bash
python -m venv venv && . venv/bin/activate
pip install -r pipeline/requirements.txt
curl -LO https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/INDIA/INDIA_DISTRICTS.geojson
python pipeline/build_data.py INDIA_DISTRICTS.geojson docs/data cache
python pipeline/build_grid.py 2026-10-21.0 docs/data cache   # Overture release
python pipeline/build_screens.py INDIA_DISTRICTS.geojson docs/data cache 2026-10-21.0 \
  inunriver_historical_000000000WATCH_1980_rp00100.tif inuncoast_historical_nosub_hist_rp0100_0.tif   # handbook site screens
```

The script reads NASA POWER (monthly MERRA-2 and CERES, 2001–2020), ESA WorldCover and the GLAD cropland tiles directly from their public cloud buckets (about 15 minutes; everything is cached). To change the climate period, edit `Y0, Y1` in `build_data.py`. The GLAD tiles are about 900 MB; put copies named `<year>_<tile>.tif` in `cache/glad/` to avoid streaming them. `build_grid.py` reads Overture Maps from S3 and must be rerun whenever the district file changes. `build_screens.py` computes, for each district, the share of compact farmland that passes the handbook's Chapter 2 screens (slope under 8° with south-facing aspect, outside protected areas plus 1 km, outside seasonally flooded land, and within 5 km of a substation) on the same ~300 m grid; it needs about 6 GB of memory and streams the Copernicus DEM and JRC water tiles (about 40 minutes the first time). Download the two Aqueduct GeoTIFFs from the WRI Aqueduct Floods page; without them the flood screen falls back to JRC seasonal water.

## Run locally

```bash
cd docs && python -m http.server 8000   # open http://localhost:8000
```

## Publish

Settings → Pages → Build and deployment → Source: **GitHub Actions** (the workflow in `.github/workflows/main.yml` publishes `docs/` on every push to `main`). "Deploy from a branch" with **main** and **/docs** also works; with **/(root)** the root `index.html` redirects to `docs/`.

## Structure

```
docs/                 GitHub Pages site (no build step)
  index.html
  css/app.css         styles (ASCENT palette: dark green, mint, amber, cream, navy; Inter)
  js/knowledge.js     Köppen classes, crops, configurations, scenarios, info texts
  js/model.js         energy, crop, LER, water, economics and IRR model
  js/agroclimate.js   agro-climatic region, PET, aridity, growing period
  js/shadow.js        sun position and 2D shadow ray tracing
  js/shadow3d.js      3D view
  js/shadowpage.js    shadow analysis page
  js/app.js           map, levers, district panel, rankings
  js/pages.js         methodology and sources pages
  data/               districts.json, climate_years.json, districts.geojson, states.geojson, grid.json, grid_lines.geojson, substations.json, screens.json
  vendor/leaflet/     Leaflet 1.9.4
  vendor/three/       three.js 0.160.0
pipeline/             data build scripts
```

Indicative screening results only; check site conditions before investing.
