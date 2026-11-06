"""Site-screening layers from the MNRE Agri-Photovoltaics Policy Handbook (2026), Chapter 2.

For every district, the share of its compact farmland (GLAD 2024 cropland in ~300 m cells that are at
least half cropland, the dashboard's default land base) that passes each GIS screen of Table 2.1 and
the 5 km substation rule of Section 1.2:

  sub5  within 5 km (straight line) of any mapped substation, any voltage   (OSM via Overture Maps)
  slope on slopes under 8 degrees                                             (Copernicus DEM GLO-90)
  terr  slope under 8 degrees and, where sloping (>= 2 degrees), facing S/SE/SW
  prot  inside a protected area or within 1 km of one                       (OSM via Overture Maps land_use)
  flood flooded more than 0.1 m in a 100-year river or coastal flood        (WRI Aqueduct Floods, historical)
        or, without the Aqueduct files, in or next to land seasonally under water in 1984-2021 (JRC GSW v1.4)
  ok    passes terrain, protected-area and flood screens together
  ok5   ok and within 5 km of a substation

Usage: python build_screens.py INDIA_DISTRICTS.geojson docs/data cache 2026-10-21.0 [RIVER.tif COAST.tif]
  RIVER.tif  inunriver_historical_000000000WATCH_1980_rp00100.tif   (Aqueduct Floods, from wri.org)
  COAST.tif  inuncoast_historical_nosub_hist_rp0100_0.tif
Output: docs/data/screens.json  {district id: {...shares 0-1...}, "_meta": {...}}
"""
import json, os, sys, math
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.windows import Window
from affine import Affine
from rasterio import features
from scipy.ndimage import maximum_filter
from scipy.spatial import cKDTree
import shapely
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc
import s3fs

sys.path.insert(0, os.path.dirname(__file__))
from districts import load_districts, id_grid, W, S, E, N, RES, NX, NY, TF  # noqa: E402

GEO, OUT, CACHE, REL = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
AQ = sys.argv[5:7] if len(sys.argv) >= 7 else None
AQ_DEPTH = 0.1  # m
os.makedirs(CACHE, exist_ok=True)
g = load_districts(GEO)
ids, rows, cols, pid = id_grid(g)
nd = len(g) + 1
print("districts", len(g), flush=True)
land = ids > 0


def cached(name, fn):
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        return np.load(p)
    a = fn()
    np.save(p, a)
    return a


# ---------------------------------------------------------------- GLAD cropland 2024 (as build_data.py)
GLAD_URL = "https://storage.googleapis.com/earthenginepartners-hansen/Annual_Layers_2015_2024/cropland/{y}/{t}.tif"


def glad(year=2024):
    acc = np.full((NY, NX), 255, dtype=np.uint8)
    for top in (10, 20, 30, 40):
        for left in (60, 70, 80, 90):
            t = f"{top:02d}N_{left:03d}E"
            try:
                src = rasterio.open(GLAD_URL.format(y=year, t=t))
            except Exception:
                continue
            with src:
                part = np.full((NY, NX), 255, dtype=np.uint8)
                reproject(rasterio.band(src, 1), part, src_transform=src.transform, src_crs=src.crs, dst_transform=TF,
                          dst_crs="EPSG:4326", resampling=Resampling.average, src_nodata=None, dst_nodata=255,
                          init_dest_nodata=False, num_threads=4)
            acc = np.where(part != 255, part, acc)
            print("glad", t, flush=True)
    acc[acc == 255] = 0
    return acc


crop = cached("glad_cropland_2024.npy", glad).astype(np.float32) / 100
compact = np.where(crop >= 0.5, crop, 0).astype(np.float32)  # cropland in compact cells
cc_d = np.bincount(pid, weights=compact[rows, cols], minlength=nd)


def share(mask):
    """Share of each district's compact farmland lying in cells where mask is True (or weight 0-1)."""
    w = compact[rows, cols] * mask[rows, cols]
    return np.bincount(pid, weights=w, minlength=nd) / np.maximum(cc_d, 1e-9)


# ---------------------------------------------------------------- Overture Maps (OSM): substations, protected areas
fs = s3fs.S3FileSystem(anon=True)


def overture(theme, typ, subtypes, cols_):
    def overlap(rg):
        st = {}
        for i in range(rg.num_columns):
            c = rg.column(i)
            if c.path_in_schema.startswith("bbox.") and c.statistics is not None and c.statistics.has_min_max:
                st[c.path_in_schema] = (c.statistics.min, c.statistics.max)
        if len(st) < 4:
            return True
        return not (st["bbox.xmin"][0] > E or st["bbox.xmax"][1] < W or st["bbox.ymin"][0] > N or st["bbox.ymax"][1] < S)

    def scan(path):
        f = pq.ParquetFile(fs.open(path))
        out = []
        for k in range(f.metadata.num_row_groups):
            if not overlap(f.metadata.row_group(k)):
                continue
            t = f.read_row_group(k, columns=cols_)
            b = t["bbox"]
            m = pc.and_(pc.is_in(t["subtype"], pa.array(subtypes)),
                        pc.and_(pc.and_(pc.greater(pc.struct_field(b, "xmax"), W), pc.less(pc.struct_field(b, "xmin"), E)),
                                pc.and_(pc.greater(pc.struct_field(b, "ymax"), S), pc.less(pc.struct_field(b, "ymin"), N))))
            t = t.filter(m)
            if t.num_rows:
                out.append(t)
        return out

    base = f"overturemaps-us-west-2/release/{REL}/theme={theme}/type={typ}/"
    files = [x["name"] for x in fs.ls(base, detail=True) if x["name"].endswith(".parquet")]
    with ThreadPoolExecutor(8) as ex:
        parts = [t for r in ex.map(scan, files) for t in r]
    return pa.concat_tables(parts)


def cached_table(name, fn):
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        return pq.read_table(p)
    t = fn()
    pq.write_table(t, p)
    return t


power = cached_table(f"power_{REL}.parquet", lambda: overture("base", "infrastructure", ["power"],
                                                               ["id", "geometry", "subtype", "class", "source_tags", "names", "bbox"]))
cls = np.array(power["class"].to_pylist(), dtype=object)
sub_geom = shapely.from_wkb(power["geometry"].to_numpy(zero_copy_only=False)[cls == "substation"])
sub_pt = shapely.get_coordinates(shapely.point_on_surface(sub_geom))
print("substations (all voltages)", len(sub_pt), flush=True)

# distance from each district cell to the nearest substation, in km (local equirectangular)
lat0 = np.deg2rad(22.0)
def km_xy(lon, lat):
    return np.c_[np.asarray(lon) * 111.32 * np.cos(np.deg2rad(lat)), np.asarray(lat) * 110.57]
tree = cKDTree(km_xy(sub_pt[:, 0], sub_pt[:, 1]))
plat = N - (rows + 0.5) * RES
plon = W + (cols + 0.5) * RES
dkm, _ = tree.query(km_xy(plon, plat), k=1, workers=4)
near5 = np.zeros((NY, NX), dtype=bool)
near5[rows, cols] = dkm <= 5.0
w = compact[rows, cols]


def weighted_median_by(pid_, val, wt):
    out = np.full(nd, np.nan)
    o = np.lexsort((val, pid_))
    p, v, ww = pid_[o], val[o], wt[o]
    starts = np.searchsorted(p, np.arange(nd))
    ends = np.searchsorted(p, np.arange(nd), side="right")
    for d in range(1, nd):
        a, b = starts[d], ends[d]
        if b <= a or ww[a:b].sum() <= 0:
            continue
        cw = np.cumsum(ww[a:b])
        out[d] = v[a:b][np.searchsorted(cw, cw[-1] / 2)]
    return out
dsub_farm = weighted_median_by(pid, dkm, w)  # median distance from compact farmland to a substation, km

prot = cached_table(f"protected_{REL}.parquet", lambda: overture("base", "land_use", ["protected"],
                                                                 ["id", "geometry", "subtype", "class", "bbox"]))
pg = shapely.from_wkb(prot["geometry"].to_numpy(zero_copy_only=False))
pcls = np.array(prot["class"].to_pylist(), dtype=object)
keep = shapely.get_type_id(pg) >= 3  # polygons only
pg, pcls = pg[keep], pcls[keep]
print("protected polygons", len(pg), dict(zip(*np.unique(pcls, return_counts=True))), flush=True)
pbuf = shapely.buffer(pg, 1.0 / 111.0)  # ~1 km
protm = features.rasterize(((p, 1) for p in pbuf if not p.is_empty), out_shape=(NY, NX), transform=TF, fill=0,
                           dtype="uint8", all_touched=True).astype(bool)


# ---------------------------------------------------------------- Copernicus DEM GLO-90: slope and aspect
def dem_tile(la, lo, r0, r1, c0, c1):
    name = f"Copernicus_DSM_COG_30_N{la:02d}_00_E{lo:03d}_00_DEM"
    url = f"https://copernicus-dem-90m.s3.amazonaws.com/{name}/{name}.tif"
    try:
        with rasterio.open(url) as src:
            z = src.read(1).astype(np.float32)
            t = src.transform
    except Exception:
        return None
    # pad by edge so gradients near tile edges stay defined
    h, wd = z.shape
    latc = la + 0.5
    dx = abs(t.a) * 111320 * math.cos(math.radians(latc))
    dy = abs(t.e) * 110540
    gy, gx = np.gradient(z, dy, dx)  # gy: change per metre going down rows (southward)
    dzdx, dzdn = gx, -gy
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdn)))
    aspect = (np.degrees(np.arctan2(-dzdx, -dzdn)) + 360) % 360  # direction the slope faces
    s8 = slope < 8
    south = (aspect >= 112.5) & (aspect <= 247.5)
    ok = s8 & ((slope < 2) | south)
    res = []
    dtf = TF * Affine.translation(c0, r0)  # write only this tile's window of the national grid
    for arr in (s8, ok):
        part = np.full((r1 - r0, c1 - c0), np.nan, dtype=np.float32)
        reproject(arr.astype(np.float32), part, src_transform=t, src_crs="EPSG:4326", dst_transform=dtf, dst_crs="EPSG:4326",
                  resampling=Resampling.average, src_nodata=None, dst_nodata=np.nan, init_dest_nodata=False)
        res.append(part)
    return res


def dem_screens():
    s8 = np.full((NY, NX), np.nan, dtype=np.float32)
    ok = np.full((NY, NX), np.nan, dtype=np.float32)
    jobs = []
    for la in range(6, 38):
        for lo in range(68, 98):
            r0 = max(0, int((N - (la + 1)) / RES)); r1 = min(NY, int((N - la) / RES) + 1)
            c0 = max(0, int((lo - W) / RES)); c1 = min(NX, int((lo + 1 - W) / RES) + 1)
            if r1 > r0 and c1 > c0 and land[r0:r1, c0:c1].any():
                jobs.append((la, lo, r0, r1, c0, c1))
    print("dem tiles", len(jobs), flush=True)
    done = 0
    with ThreadPoolExecutor(4) as ex:
        for (la, lo, r0, r1, c0, c1), res in zip(jobs, ex.map(lambda j: dem_tile(*j), jobs)):
            done += 1
            if res is None:
                continue
            a, b = res
            m = np.isfinite(a)
            s8[r0:r1, c0:c1][m] = a[m]; ok[r0:r1, c0:c1][m] = b[m]
            if done % 50 == 0:
                print("dem", done, "/", len(jobs), flush=True)
    return np.stack([s8, ok])


dem = cached("dem_screens.npy", dem_screens)
slope8 = np.nan_to_num(dem[0], nan=1.0)
terr = np.nan_to_num(dem[1], nan=1.0)


# ---------------------------------------------------------------- JRC Global Surface Water v1.4: seasonally inundated land
GSW = "https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_{lo}E_{la}Nv1_4_2021.tif"


def gsw():
    acc = np.full((NY, NX), np.nan, dtype=np.float32)
    for la in (10, 20, 30, 40):
        for lo in (60, 70, 80, 90):
            try:
                src = rasterio.open(GSW.format(lo=lo, la=la))
            except Exception:
                continue
            with src:
                step = 4000
                for r in range(0, src.height, step):
                    win = Window(0, r, src.width, min(step, src.height - r))
                    occ = src.read(1, window=win)
                    m = ((occ >= 1) & (occ < 50)).astype(np.float32)  # water some of the time, not permanent
                    if not m.any():
                        continue
                    wt = src.window_transform(win)
                    x0, y0 = wt.c, wt.f
                    x1, y1 = x0 + wt.a * win.width, y0 + wt.e * win.height
                    r0 = max(0, int((N - y0) / RES) - 1); r1 = min(NY, int((N - y1) / RES) + 2)
                    c0 = max(0, int((x0 - W) / RES) - 1); c1 = min(NX, int((x1 - W) / RES) + 2)
                    if r1 <= r0 or c1 <= c0:
                        continue
                    part = np.full((r1 - r0, c1 - c0), np.nan, dtype=np.float32)
                    reproject(m, part, src_transform=wt, src_crs=src.crs, dst_transform=TF * Affine.translation(c0, r0),
                              dst_crs="EPSG:4326", resampling=Resampling.average, src_nodata=None, dst_nodata=np.nan,
                              init_dest_nodata=False)
                    sub = acc[r0:r1, c0:c1]
                    f = np.isfinite(part)
                    sub[f] = np.fmax(sub[f], part[f])
            print("gsw", lo, la, flush=True)
    return np.nan_to_num(acc, nan=0.0)


def aqueduct(path):
    """100-year inundation depth (m) on the ~300 m grid; each cell takes the ~1 km Aqueduct value it falls in."""
    with rasterio.open(path) as src:
        win = src.window(W, S, E, N).round_offsets().round_lengths()
        z = src.read(1, window=win)
        z = np.where((z == src.nodata) | ~np.isfinite(z), 0, z).astype(np.float32)
        out = np.zeros((NY, NX), dtype=np.float32)
        reproject(z, out, src_transform=src.window_transform(win), src_crs=src.crs, dst_transform=TF, dst_crs="EPSG:4326",
                  resampling=Resampling.nearest)
    return out


if AQ:
    floodm = (aqueduct(AQ[0]) > AQ_DEPTH) | (aqueduct(AQ[1]) > AQ_DEPTH)
    FLOOD_SRC = f"WRI Aqueduct Floods, historical 100-year riverine and coastal (no subsidence), depth > {AQ_DEPTH} m"
else:
    seasonal = cached("gsw_seasonal.npy", gsw)
    floodm = maximum_filter(seasonal >= 0.02, size=3)  # cell or its neighbours at least 2% seasonal water
    FLOOD_SRC = "JRC Global Surface Water v1.4 (1984-2021), seasonal water proxy"
print("flood source:", FLOOD_SRC, flush=True)

# ---------------------------------------------------------------- per-district shares of compact farmland
okm = terr * (~protm) * (~floodm)
res = {
    "sub5": share(near5), "slope": share(slope8), "terr": share(terr), "prot": share(protm),
    "flood": share(floodm), "ok": share(okm), "ok5": share(okm * near5),
}
out = {"_meta": {"overture": REL, "substations": int(len(sub_pt)), "protected": int(len(pg)),
                 "dem": "Copernicus DEM GLO-90", "water": FLOOD_SRC,
                 "land": "GLAD cropland 2024, compact cells"}}
for d in range(1, nd):
    if cc_d[d] <= 0:
        out[str(d)] = {"none": 1, "dsub": None if not np.isfinite(dsub_farm[d]) else round(float(dsub_farm[d]), 1)}
        continue
    out[str(d)] = {k: round(float(v[d]), 3) for k, v in res.items()}
    out[str(d)]["dsub"] = round(float(dsub_farm[d]), 1)
with open(os.path.join(OUT, "screens.json"), "w") as f:
    json.dump(out, f, separators=(",", ":"), allow_nan=False)
tot = cc_d[1:].sum() * (RES * 111.32) ** 2
print("compact farmland cells (sum)", round(cc_d[1:].sum()), "ok share", round(float((okm[rows, cols] * compact[rows, cols]).sum() / cc_d[1:].sum()), 3),
      "ok5 share", round(float((okm * near5)[rows, cols].dot(compact[rows, cols]) / cc_d[1:].sum()), 3))
