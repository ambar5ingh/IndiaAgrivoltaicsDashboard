"""Build per-district data for the India Agrivoltaics Dashboard.

Inputs (all fetched over the network, nothing hand-entered):
  - District boundaries: datta07/INDIAN-SHAPEFILES INDIA_DISTRICTS.geojson
  - Köppen-Geiger: kgcpy (Rubel et al. 2017, 1986-2010, 100 arc-second grid)
  - Climate: NASA POWER v10 monthly MERRA-2 (0.5x0.625 deg), climatology computed here for 2001-2025
  - Solar: NASA POWER v10 monthly CERES SYN1deg (1 deg), climatology computed here for 2001-2025
  - Land cover: ESA WorldCover 2021 v200 (read at ~300 m from COG overviews)
  - Agricultural land: UMD GLAD annual cropland 2024 and 2019 (Potapov et al.; 30 m, averaged to ~300 m)
Outputs: docs/data/districts.geojson (simplified), districts.json and climate_years.json
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
# unnamed slivers: give each the name of the named district it borders most
named = g[g["district"].notna()]
for i in g.index[g["district"].isna()]:
    geom = g.at[i, "geometry"].buffer(0)
    cand = named[named.intersects(geom.buffer(0.01))]
    if len(cand) == 0:
        cand = named.iloc[[named.distance(geom).argmin()]]
    best = cand.geometry.buffer(0).intersection(geom.buffer(0.01)).area.idxmax()
    g.loc[i, ["state", "district", "dist_code"]] = g.loc[best, ["state", "district", "dist_code"]].values
# the source truncates several Karnataka names; restore them from Census district codes
KA = {"0555": "BELAGAVI", "0556": "BAGALKOTE", "0558": "BIDAR", "0562": "DHARWAD", "0564": "HAVERI", "0565": "BALLARI",
      "0567": "DAVANAGERE", "0574": "HASSAN", "0578": "CHAMARAJANAGAR", "0580": "YADGIR", "0581": "KOLAR",
      "0582": "CHIKKABALLAPURA", "0584": "RAMANAGARA"}
ka = g["state"].str.upper().str.strip().eq("KARNATAKA") & g["dist_code"].isin(list(KA))
g.loc[ka, "district"] = g.loc[ka, "dist_code"].map(KA)
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

# ---------------------------------------------------------------- GLAD annual cropland (latest: 2024)
# Potapov et al. (2022, Nature Food) cropland method, annual 30 m maps 2015-2024 from UMD GLAD.
# Each 10x10 degree tile is 0 (other) / 100 (cropland); averaging onto the ~300 m id grid gives cropland %.
from rasterio.warp import reproject
GLAD_URL = "https://storage.googleapis.com/earthenginepartners-hansen/Annual_Layers_2015_2024/cropland/{y}/{t}.tif"

def glad_cropland(year):
    path = os.path.join(CACHE, f"glad_cropland_{year}.npy")
    if os.path.exists(path):
        return np.load(path)
    acc = np.full((ny, nx), 255, dtype=np.uint8)
    for top in (10, 20, 30, 40):
        for left in (60, 70, 80, 90):
            t = f"{top:02d}N_{left:03d}E"
            local = os.path.join(CACHE, "glad", f"{year}_{t}.tif")
            src_path = local if os.path.exists(local) else GLAD_URL.format(y=year, t=t)
            try:
                src = rasterio.open(src_path)
            except Exception:
                continue  # all-ocean tiles do not exist
            with src:
                part = np.full((ny, nx), 255, dtype=np.uint8)
                reproject(rasterio.band(src, 1), part, src_transform=src.transform, src_crs=src.crs,
                          dst_transform=tf, dst_crs="EPSG:4326", resampling=Resampling.average,
                          src_nodata=None, dst_nodata=255, init_dest_nodata=False, num_threads=4)
            acc = np.where(part != 255, part, acc)
            print("glad", year, t, flush=True)
    acc[acc == 255] = 0
    np.save(path, acc)
    return acc

def cropland_shares(pct):
    """District share of cropland, and share in compact farmland (~300 m cells at least half cropland)."""
    f = pct[rows, cols].astype(float) / 100
    share = np.bincount(pid, weights=f, minlength=len(g) + 1) / np.maximum(npx, 1)
    compact = np.bincount(pid, weights=np.where(f >= 0.5, f, 0), minlength=len(g) + 1) / np.maximum(npx, 1)
    return share, compact

c24, cc24 = cropland_shares(glad_cropland(2024))
c19, _ = cropland_shares(glad_cropland(2019))

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

Y0, Y1 = 2001, 2025  # CERES SYN1deg starts in 2001; MERRA-2 and SYN1deg are complete through 2025
MONTH_W = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]) / 365.25
# T2M_MAX / T2M_MIN in POWER's climatology product are the extremes over all years; keep that meaning
EXTREME = {"T2M_MAX": "max", "T2M_MIN": "min"}

def monthly_climatology(url, var_list, cache_name):
    """12 monthly means over Y0..Y1 plus an annual value (index 12), shaped like POWER's climatology zarr.
    Also returns the per-year annual means (Y0..Y1) for the year-by-year charts."""
    cp = os.path.join(CACHE, cache_name)
    if os.path.exists(cp):
        mon = xr.open_dataset(cp)
    else:
        ds = xr.open_zarr(url, storage_options={"anon": True})
        have = [v for v in var_list if v in ds]
        mon = ds[have].sel(lat=slice(S - 1, N + 1), lon=slice(W - 1, E + 1), time=slice(f"{Y0}-01", f"{Y1}-12")).load()
        mon.to_netcdf(cp)
    assert mon.sizes["time"] == 12 * (Y1 - Y0 + 1), mon.sizes
    for v in mon.data_vars:
        assert bool(np.isfinite(mon[v].values).any(axis=(1, 2)).all()), f"{v}: a month has no data"
    out = {}
    wts = xr.DataArray(MONTH_W, dims="month", coords={"month": np.arange(1, 13)})
    for v in mon.data_vars:
        grp = mon[v].groupby("time.month")
        how = EXTREME.get(v, "mean")
        m12 = getattr(grp, how)("time")
        ann = m12.max("month") if how == "max" else m12.min("month") if how == "min" else (m12 * wts).sum("month")
        out[v] = xr.concat([m12, ann.expand_dims(month=[13])], dim="month").rename(month="time")
    clim_ds = xr.Dataset(out)
    yearly = {}
    for v in mon.data_vars:
        mw = xr.DataArray(np.tile(MONTH_W, Y1 - Y0 + 1), dims="time", coords={"time": mon.time})
        yearly[v] = (mon[v] * mw).groupby("time.year").sum("time")  # day-weighted annual mean
    return clim_ds, xr.Dataset(yearly)

mer_vars = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "WS10M", "WS50M", "FROST_DAYS", "EVPTRNS", "GWETROOT"]
mer, mer_y = monthly_climatology("s3://nasa-power/merra2/spatial/power_merra2_monthly_spatial_utc.zarr", mer_vars,
                                 f"merra2_monthly_{Y0}_{Y1}.nc")
syn_vars = ["ALLSKY_SFC_SW_DWN", "ALLSKY_SFC_SW_DNI", "ALLSKY_SFC_SW_DIFF", "ALLSKY_SFC_PAR_TOT", "ALLSKY_KT", "CLRSKY_SFC_SW_DWN"]
syn, syn_y = monthly_climatology("s3://nasa-power/syn1deg/spatial/power_syn1deg_monthly_spatial_utc.zarr", syn_vars,
                                 f"syn1deg_monthly_{Y0}_{Y1}.nc")
print("merra", dict(mer.sizes), list(mer.data_vars), "syn", dict(syn.sizes), list(syn.data_vars))
print("time coord", mer.time.values[:13])


def district_mean(ds, var):  # noqa: E302
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
yr = {v: district_mean(mer_y.rename(year="time"), v) for v in ["T2M", "PRECTOTCORR", "WS10M", "WS50M"]}
yr["GHI"] = district_mean(syn_y.rename(year="time"), "ALLSKY_SFC_SW_DWN")

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
        ws10=round(float(clim["WS10M"][d][12]), 2),
        ws50=round(float(clim["WS50M"][d][12]), 2),
        wsm=[round(float(x), 1) for x in clim["WS10M"][d][:12]],
        frost=round(float(clim["FROST_DAYS"][d][:12].sum()), 1) if "FROST_DAYS" in clim else None,
        gwet=round(float(clim["GWETROOT"][d][12]), 3) if "GWETROOT" in clim else None,
        lc={k: round(float(v[d]), 4) for k, v in lc.items() if v[d] > 0},
        lu=dict(c24=round(float(c24[d]), 4), cc=round(float(cc24[d]), 4), c19=round(float(c19[d]), 4)),
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
# year-by-year annual values for the district charts (loaded on demand)
years = {"years": list(range(Y0, Y1 + 1)), "d": {}}
for r in recs:
    d = r["id"]
    years["d"][d] = dict(
        g=[round(float(x) * 0.024, 2) for x in yr["GHI"][d]],
        r=[round(float(x) * 365.25) for x in yr["PRECTOTCORR"][d]],
        t=[round(float(x), 1) for x in yr["T2M"][d]],
        w=[round(float(x), 2) for x in yr["WS10M"][d]],
        w50=[round(float(x), 2) for x in yr["WS50M"][d]],
    )
with open(os.path.join(OUT, "climate_years.json"), "w") as f:
    json.dump(clean(years), f, separators=(",", ":"), allow_nan=False)

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
