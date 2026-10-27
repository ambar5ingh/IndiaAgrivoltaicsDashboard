"""Build per-district data for the India Agrivoltaics Dashboard.

Inputs (all fetched over the network, nothing hand-entered):
  - District boundaries: datta07/INDIAN-SHAPEFILES INDIA_DISTRICTS.geojson
  - Köppen-Geiger: kgcpy (Rubel et al. 2017, 1986-2010, 100 arc-second grid)
  - Climate: NASA POWER v10 climatology (MERRA-2 0.5x0.625 deg, 2001-2020)
  - Solar: NASA POWER v10 climatology (CERES SYN1deg 1 deg, 2001-2020)
  - Land cover: ESA WorldCover 2021 v200 (read at ~300 m from COG overviews)
Outputs: site/data/districts.geojson (simplified) and site/data/districts.json
"""
import json, math, os, sys
import numpy as np
import geopandas as gpd
import pandas as pd
import xarray as xr
import rasterio
from rasterio import features
from rasterio.enums import Resampling
from rasterio.transform import from_origin

GEO = sys.argv[1]
OUT = sys.argv[2]
CACHE = sys.argv[3]
os.makedirs(CACHE, exist_ok=True)

# ---------------------------------------------------------------- districts
g = gpd.read_file(GEO)
g["state"] = g["state"].str.strip().str.upper()
g["district"] = g["district"].str.strip().str.upper()
# the source encodes long vowels with symbols (a-macron '>', i-macron '|' or '\\', u-macron '#' or '@')
for a, b in {">": "A", "|": "I", "\\": "I", "#": "U", "@": "U", "_": "-"}.items():
    g["district"] = g["district"].str.replace(a, b, regex=False)
g["district"] = g["district"].str.replace(r"\s+", " ", regex=True).str.replace("24PARGANAS", "24 PARGANAS")
g.loc[g.state == "GUJARAT AND DNH & DD ISLANDS", ["state", "district"]] = ["GUJARAT", "ISLANDS (GUJARAT COAST)"]
g["geometry"] = g.geometry.make_valid()
g = g.dissolve(by=["state", "district"], as_index=False)[["state", "district", "geometry"]]
g = g.sort_values(["state", "district"]).reset_index(drop=True)
g["id"] = np.arange(1, len(g) + 1)
g["area_km2"] = g.to_crs("ESRI:102028").area / 1e6  # Asia South Albers equal area
cen = g.to_crs("ESRI:102028").representative_point().to_crs(4326)
g["lat"], g["lon"] = cen.y, cen.x
print("districts", len(g))

W, S, E, N = 68.0, 6.5, 97.5, 37.5

# ---------------------------------------------------------------- id raster (fine, ~300 m)
RES = 3.0 / 1125
nx, ny = int(round((E - W) / RES)), int(round((N - S) / RES))
tf = from_origin(W, N, RES, RES)
ids = features.rasterize(((geom, i) for geom, i in zip(g.geometry, g.id)), out_shape=(ny, nx),
                         transform=tf, fill=0, dtype="int32", all_touched=False)
# small districts that miss every pixel centre: burn with all_touched
missing = set(g.id) - set(np.unique(ids))
if missing:
    sub = g[g.id.isin(missing)]
    extra = features.rasterize(((geom, i) for geom, i in zip(sub.geometry, sub.id)), out_shape=(ny, nx),
                               transform=tf, fill=0, dtype="int32", all_touched=True)
    ids = np.where((ids == 0) & (extra > 0), extra, ids)
print("id raster", ids.shape, "missing after all_touched:", set(g.id) - set(np.unique(ids)))
rows, cols = np.nonzero(ids)
pid = ids[rows, cols]
# districts too small for the grid (island specks): use the pixel at their interior point
for d in sorted(set(g.id) - set(np.unique(ids))):
    r = g[g.id == d].iloc[0]
    rows = np.append(rows, int((N - r.lat) / RES)); cols = np.append(cols, int((r.lon - W) / RES)); pid = np.append(pid, d)
plat = N - (rows + 0.5) * RES
plon = W + (cols + 0.5) * RES
npx = np.bincount(pid, minlength=len(g) + 1)

# ---------------------------------------------------------------- ESA WorldCover
wc_path = os.path.join(CACHE, "worldcover_india.npy")
if os.path.exists(wc_path):
    wc = np.load(wc_path)
else:
    wc = np.zeros((ny, nx), dtype=np.uint8)
    for la in range(6, 37, 3):
        for lo in range(66, 99, 3):
            name = f"ESA_WorldCover_10m_2021_v200_{'N' if la >= 0 else 'S'}{la:02d}E{lo:03d}_Map.tif"
            url = f"https://esa-worldcover.s3.amazonaws.com/v200/2021/map/{name}"
            try:
                with rasterio.open(url) as src:
                    a = src.read(1, out_shape=(1125, 1125), resampling=Resampling.nearest)
            except Exception as e:  # ocean tiles do not exist
                continue
            # tile covers lat la..la+3, lon lo..lo+3 ; paste into mosaic
            r0 = int(round((N - (la + 3)) / RES)); c0 = int(round((lo - W) / RES))
            r1, c1 = r0 + 1125, c0 + 1125
            rr0, cc0 = max(r0, 0), max(c0, 0)
            rr1, cc1 = min(r1, ny), min(c1, nx)
            if rr1 <= rr0 or cc1 <= cc0:
                continue
            wc[rr0:rr1, cc0:cc1] = a[rr0 - r0:rr1 - r0, cc0 - c0:cc1 - c0]
            print("worldcover", name, flush=True)
    np.save(wc_path, wc)

lc_codes = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built", 60: "bare", 70: "snow", 80: "water", 90: "wetland", 95: "mangrove", 100: "moss"}
pwc = wc[rows, cols]
lc = {}
for code, nm in lc_codes.items():
    lc[nm] = np.bincount(pid, weights=(pwc == code).astype(float), minlength=len(g) + 1) / np.maximum(npx, 1)

# ---------------------------------------------------------------- Köppen (kgcpy)
import kgcpy
kimg = np.array(kgcpy.img)
kzones = dict(zip(kgcpy.kg_zoneNum_df.zoneNum, kgcpy.kg_zoneNum_df.kg_zone))
kh, kw = kimg.shape
kx = np.clip(np.round((plon + 180) * kw / 360 - 0.5).astype(int), 0, kw - 1)
ky = np.clip(np.round(-(plat - 90) * kh / 180 - 0.5).astype(int), 0, kh - 1)
pk = kimg[ky, kx]
kcount = np.zeros((len(g) + 1, 33))
np.add.at(kcount, (pid, pk), 1)

# ---------------------------------------------------------------- NASA POWER climatology
def power(ds_url, var_list):
    ds = xr.open_zarr(ds_url, storage_options={"anon": True})
    ds = ds[var_list].sel(lat=slice(S - 1, N + 1), lon=slice(W - 1, E + 1)).load()
    return ds

mer_vars = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "FROST_DAYS", "EVPTRNS", "GWETROOT"]
mer = None
mp = os.path.join(CACHE, "merra.nc")
if os.path.exists(mp):
    mer = xr.open_dataset(mp)
else:
    ds = xr.open_zarr("s3://nasa-power/merra2/spatial/power_merra2_climatology_spatial_utc.zarr", storage_options={"anon": True})
    have = [v for v in mer_vars if v in ds]
    mer = ds[have].sel(lat=slice(S - 1, N + 1), lon=slice(W - 1, E + 1)).load()
    mer.to_netcdf(mp)
syn_vars = ["ALLSKY_SFC_SW_DWN", "ALLSKY_SFC_SW_DNI", "ALLSKY_SFC_SW_DIFF", "ALLSKY_SFC_PAR_TOT", "ALLSKY_KT", "CLRSKY_SFC_SW_DWN"]
sp = os.path.join(CACHE, "syn.nc")
if os.path.exists(sp):
    syn = xr.open_dataset(sp)
else:
    ds = xr.open_zarr("s3://nasa-power/syn1deg/spatial/power_syn1deg_climatology_spatial_utc.zarr", storage_options={"anon": True})
    have = [v for v in syn_vars if v in ds]
    syn = ds[have].sel(lat=slice(S - 1, N + 1), lon=slice(W - 1, E + 1)).load()
    syn.to_netcdf(sp)
print("merra", dict(mer.sizes), list(mer.data_vars), "syn", dict(syn.sizes), list(syn.data_vars))
print("time coord", mer.time.values[:13])


def district_mean(ds, var):
    """Area mean over district pixels using nearest grid cell for each ~300 m pixel. Returns (n+1, T)."""
    da = ds[var]
    lats, lons = da.lat.values, da.lon.values
    iy = np.abs(plat[:, None] - lats[None, :]).argmin(1) if len(plat) < 0 else None
    # nearest index via searchsorted on regular grids
    dlat = lats[1] - lats[0]; dlon = lons[1] - lons[0]
    iy = np.clip(np.round((plat - lats[0]) / dlat).astype(int), 0, len(lats) - 1)
    ix = np.clip(np.round((plon - lons[0]) / dlon).astype(int), 0, len(lons) - 1)
    arr = da.transpose("time", "lat", "lon").values  # (T, lat, lon)
    out = np.zeros((len(g) + 1, arr.shape[0]))
    # aggregate unique cells first for speed
    cell = iy * len(lons) + ix
    key = pid.astype(np.int64) * (len(lats) * len(lons)) + cell
    uk, cnt = np.unique(key, return_counts=True)
    d_of = uk // (len(lats) * len(lons)); c_of = uk % (len(lats) * len(lons))
    vals = arr.reshape(arr.shape[0], -1)[:, c_of].T  # (U, T)
    np.add.at(out, d_of, vals * cnt[:, None])
    return out / np.maximum(npx, 1)[:, None]

clim = {v: district_mean(mer, v) for v in mer.data_vars}
sol = {v: district_mean(syn, v) for v in syn.data_vars}

# ---------------------------------------------------------------- Köppen from POWER (cross-check)
MONTH_DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])

def koppen(T, P, lat):
    """Köppen-Geiger (Peel/Kottek rules) from 12 monthly mean temps (C) and precip (mm)."""
    Tann, Pann = T.mean(), P.sum()
    Tmax, Tmin = T.max(), T.min()
    summer = np.array([3, 4, 5, 6, 7, 8]) if lat >= 0 else np.array([9, 10, 11, 0, 1, 2])
    winter = np.setdiff1d(np.arange(12), summer)
    Ps, Pw = P[summer], P[winter]
    if Pann > 0 and Ps.sum() >= 0.7 * Pann: pth = 2 * Tann + 28
    elif Pann > 0 and Pw.sum() >= 0.7 * Pann: pth = 2 * Tann
    else: pth = 2 * Tann + 14
    if Tmax < 10:
        return "ET" if Tmax > 0 else "EF"
    if Pann < 10 * pth:
        return ("BW" if Pann < 5 * pth else "BS") + ("h" if Tann >= 18 else "k")
    if Tmin >= 18:
        Pdry = P.min()
        if Pdry >= 60: return "Af"
        if Pdry >= 100 - Pann / 25: return "Am"
        return "Aw" if P[winter].min() <= P[summer].min() else "As"
    third = "a" if Tmax >= 22 else ("b" if (T >= 10).sum() >= 4 else "c")
    s_ok = Ps.min() < 40 and Ps.min() < Pw.max() / 3
    w_ok = Pw.min() < Ps.max() / 10
    if s_ok and w_ok: second = "w" if Ps.sum() >= Pw.sum() else "s"  # Peel et al. 2007 precedence
    elif s_ok: second = "s"
    elif w_ok: second = "w"
    else: second = "f"
    return ("C" if Tmin > 0 else "D") + second + third  # 0 C threshold (Kottek/Rubel)

# ---------------------------------------------------------------- assemble
recs = []
for i, r in g.iterrows():
    d = r.id
    kc = kcount[d]
    tot = kc[1:32].sum()
    order = np.argsort(-kc)
    kshares = [(kzones[int(z)], round(kc[z] / tot, 3)) for z in order if z >= 1 and z <= 31 and kc[z] > 0][:4] if tot > 0 else []
    T = clim["T2M"][d][:12]; P = clim["PRECTOTCORR"][d][:12] * MONTH_DAYS
    kp = koppen(T, P, r.lat)
    # Rubel/Kottek gives "s" precedence over "w"; in monsoon India the pre-monsoon months make both
    # true. Harmonise with Peel et al. 2007 / Beck et al. 2018: wetter warm half-year -> winter-dry.
    summer_wet = P[3:9].sum() >= P[[0, 1, 2, 9, 10, 11]].sum()
    fix = {"As": "Aw", "Csa": "Cwa", "Csb": "Cwb", "Csc": "Cwc", "Dsa": "Dwa", "Dsb": "Dwb", "Dsc": "Dwc"}
    if summer_wet:
        merged = {}
        for z, sh in kshares:
            z = fix.get(z, z); merged[z] = round(merged.get(z, 0) + sh, 3)
        kshares = sorted(merged.items(), key=lambda x: -x[1])
    kmain = kshares[0][0] if kshares else kp
    rec = dict(
        id=int(d), st=r.state.title().replace(" And ", " and "), d=r.district.title().replace("'S", "'s"), area=round(r.area_km2, 1),
        lat=round(r.lat, 3), lon=round(r.lon, 3),
        kg=kmain, kgs=kshares, kgp=kp,
        # POWER spatial zarr stores irradiance as W/m2 daily means; x0.024 -> kWh/m2/day
        ghi=round(float(sol["ALLSKY_SFC_SW_DWN"][d][12]) * 0.024, 3),
        ghim=[round(float(x) * 0.024, 2) for x in sol["ALLSKY_SFC_SW_DWN"][d][:12]],
        dni=round(float(sol["ALLSKY_SFC_SW_DNI"][d][12]) * 0.024, 2),
        dif=round(float(sol["ALLSKY_SFC_SW_DIFF"][d][12]) * 0.024, 2),
        par=round(float(sol["ALLSKY_SFC_PAR_TOT"][d][12]), 1),
        kt=round(float(sol["ALLSKY_KT"][d][12]), 3) if "ALLSKY_KT" in sol else None,
        t=round(float(clim["T2M"][d][12]), 1),
        tm=[round(float(x), 1) for x in T],
        tmax=round(float(clim["T2M_MAX"][d][:12].max()), 1),
        tmin=round(float(clim["T2M_MIN"][d][:12].min()), 1),
        hot=int((clim["T2M_MAX"][d][:12] >= 35).sum()),
        rain=round(float(P.sum())),
        rm=[round(float(x)) for x in P],
        rh=round(float(clim["RH2M"][d][12]), 1),
        ws=round(float(clim["WS2M"][d][12]), 2) if "WS2M" in clim else None,
        frost=round(float(clim["FROST_DAYS"][d][:12].sum()), 1) if "FROST_DAYS" in clim else None,
        gwet=round(float(clim["GWETROOT"][d][12]), 3) if "GWETROOT" in clim else None,
        lc={k: round(float(v[d]), 4) for k, v in lc.items() if v[d] > 0},
    )
    recs.append(rec)

os.makedirs(OUT, exist_ok=True)
def clean(o):
    if isinstance(o, float) and not math.isfinite(o): return None
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    return o
with open(os.path.join(OUT, "districts.json"), "w") as f:
    json.dump(clean(recs), f, separators=(",", ":"), allow_nan=False)

# simplified geometry for the web map (~1 km tolerance), ids only
gs = g[["id", "geometry"]].copy()
gs["geometry"] = gs.geometry.simplify(0.01, preserve_topology=True)
gs.to_file(os.path.join(OUT, "districts.geojson"), driver="GeoJSON", COORDINATE_PRECISION=3)
st = g.dissolve(by="state", as_index=False)[["state", "geometry"]]
st["geometry"] = st.geometry.simplify(0.02, preserve_topology=True)
st["state"] = st.state.str.title()
st.to_file(os.path.join(OUT, "states.geojson"), driver="GeoJSON", COORDINATE_PRECISION=3)

agree = sum(r["kg"] == r["kgp"] for r in recs)
print("Köppen agreement kgcpy vs POWER-derived:", agree, "/", len(recs))
print(pd.Series([r["kg"] for r in recs]).value_counts())
