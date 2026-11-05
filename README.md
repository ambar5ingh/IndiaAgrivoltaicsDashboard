# India Agrivoltaics Dashboard

A district-level agrivoltaics (agri-PV) screening dashboard for all 791 districts of India, published with GitHub Pages from the `docs/` folder.

**Live site:** https://ambar5ingh.github.io/IndiaAgrivoltaicsDashboard/

## What it shows

- **Map (centre):** every district coloured by one of 20 layers: Köppen-Geiger climate class, agro-climatic region, agrivoltaic suitability, project IRR, payback, distance to a substation, grid line density, aridity index, length of growing period, scenario capacity, Land Equivalent Ratio (LER), relative crop yield, GHI, specific yield, LCOE, land base, cropland 2024, compact farmland 2024, cropland change 2019–2024, WorldCover cropland 2021, water saving, rainfall, temperature, hot months and wind speed at 10 and 50 m. Filter by state, search a district, toggle a basemap, a latitude/longitude grid and the **power grid** (33–765 kV lines and substations from OpenStreetMap, with an On/Off switch per voltage in the legend).
- **Left panel, Scenario & levers:** four scenarios (KUSUM-scale 2030, Moderate 2035, Ambitious 2047, Technical potential), agricultural land base (compact farmland 2024 by default, all cropland 2024, or WorldCover 2021), adoption share, suitability threshold, system configuration (elevated, interspace, tracker, vertical bifacial, PV greenhouse, or auto by climate zone), GCR, clearance height, module technology (monocrystalline TOPCon, PERC or HJT, or polycrystalline), bifacial modules, crop group, crop margin, capex, tariff, discount rate, O&M and suitability weights.
- **Left panel, District specs:** Köppen class and area shares, key indicators, LER split, agro-climatic conditions (Planning Commission region, aridity, growing period, monthly water deficit), grid access, a shadow summary, financials (IRR, payback, NPV, 25-year cash flow), the recommended design (configuration, GCR, clearance, tilt, row pitch, MWp/ha, energy per ha), suitable crops, monthly solar, rain, temperature and wind charts, year-by-year sun, rain, temperature and wind for 2001–2025 with the trend, agricultural land use (cropland 2024, compact farmland, change since 2019), land cover, design risks and the district's scenario result.
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
| Solar (GHI, DNI, diffuse, PAR) | NASA POWER v10 CERES SYN1deg monthly, averaged here over 2001–2025 (AWS Open Data) |
| Climate (temperature, rainfall, humidity, wind at 2/10/50 m) | NASA POWER v10 MERRA-2 monthly, averaged here over 2001–2025; the same MERRA-2 reanalysis as [IDEEA](https://github.com/wri-india/IDEEA-public) / [merra2ools](https://github.com/optimal2050/merra2ools) |
| Agricultural land (default land base) | UMD GLAD annual cropland 2024 and 2019 (30 m; Potapov et al. 2022, *Nature Food*) |
| Land cover | ESA WorldCover 2021 v200 |
| Power grid | © OpenStreetMap contributors, via Overture Maps `base/infrastructure` (ODbL) |
| Agro-climatic regions | Planning Commission (1989) 15 regions; PET by Hargreaves (1975) |

## Rebuild the data

```bash
python -m venv venv && . venv/bin/activate
pip install -r pipeline/requirements.txt
curl -LO https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/INDIA/INDIA_DISTRICTS.geojson
python pipeline/build_data.py INDIA_DISTRICTS.geojson docs/data cache
python pipeline/build_grid.py 2026-10-21.0 docs/data cache   # Overture release
```

The script reads NASA POWER (monthly MERRA-2 and CERES, 2001–2025), ESA WorldCover and the GLAD cropland tiles directly from their public cloud buckets (about 15 minutes; everything is cached). To change the climate period, edit `Y0, Y1` in `build_data.py`. The GLAD tiles are about 900 MB; put copies named `<year>_<tile>.tif` in `cache/glad/` to avoid streaming them. `build_grid.py` reads Overture Maps from S3 and must be rerun whenever the district file changes.

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
  data/               districts.json, climate_years.json, districts.geojson, states.geojson, grid.json, grid_lines.geojson, substations.json
  vendor/leaflet/     Leaflet 1.9.4
  vendor/three/       three.js 0.160.0
pipeline/             data build scripts
```

Indicative screening results only; check site conditions before investing.
