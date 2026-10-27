# India Agrivoltaics Dashboard

A district-level agrivoltaics (agri-PV) screening dashboard for all 790 districts of India, published with GitHub Pages from the `docs/` folder.

**Live site:** https://ambar5ingh.github.io/IndiaAgrivoltaicsDashboard/

## What it shows

- **Map (centre):** every district coloured by one of 13 layers: Köppen-Geiger climate class, agrivoltaic suitability, scenario capacity, Land Equivalent Ratio (LER), relative crop yield, GHI, specific yield, LCOE, cropland share, water saving, rainfall, temperature and hot months. Filter by state, search a district, toggle a basemap.
- **Left panel, Scenario & levers:** four scenarios (KUSUM-scale 2030, Moderate 2035, Ambitious 2047, Technical potential), adoption share, suitability threshold, system configuration (elevated, interspace, tracker, vertical bifacial, PV greenhouse, or auto by climate zone), GCR, clearance height, module efficiency, bifacial modules, crop group, crop margin, capex, tariff, discount rate, O&M and suitability weights.
- **Left panel, District specs:** Köppen class and area shares, key indicators, LER split, the recommended design (configuration, GCR, clearance, tilt, row pitch, MWp/ha, energy per ha), suitable crops, monthly solar, rain and temperature charts, land cover, design risks and the district's scenario result.
- **Left panel, Rankings:** top districts by suitability, capacity, LER or LCOE.
- **KPIs above the map:** capacity, generation, land shared, average LER, investment and CO₂ avoided for India or the selected state.
- Every lever and metric has an (i) button explaining it. The Köppen guide, Methodology and Data & sources pages document the model and cite the research.
- **Copy link** saves the full view in the URL; **Download CSV** exports all district results for the current scenario.

## Data

| Data | Source |
|---|---|
| District boundaries | [datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) |
| Köppen-Geiger class | Rubel et al. (2017), 1986–2010, via [kgcpy](https://pypi.org/project/kgcpy/); s/w precedence harmonised with Peel et al. (2007) |
| Solar (GHI, DNI, diffuse, PAR) | NASA POWER v10 CERES SYN1deg climatology 2001–2020 (AWS Open Data) |
| Climate | NASA POWER v10 MERRA-2 climatology 2001–2020 |
| Cropland and land cover | ESA WorldCover 2021 v200 |

## Rebuild the data

```bash
python -m venv venv && . venv/bin/activate
pip install -r pipeline/requirements.txt
curl -LO https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/INDIA/INDIA_DISTRICTS.geojson
python pipeline/build_data.py INDIA_DISTRICTS.geojson docs/data cache
```

The script reads NASA POWER and ESA WorldCover directly from their public cloud buckets (about 5 minutes; the WorldCover mosaic is cached).

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
  js/model.js         energy, crop, LER, water and economics model
  js/app.js           map, levers, district panel, rankings
  js/pages.js         methodology and sources pages
  data/               districts.json, districts.geojson, states.geojson
  vendor/leaflet/     Leaflet 1.9.4
pipeline/             data build script
```

Indicative screening results only; check site conditions before investing.
