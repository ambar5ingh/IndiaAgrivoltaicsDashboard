"""Extract India's power grid (OpenStreetMap via Overture Maps base/infrastructure) and
derive per-district grid-access indicators.

Usage: python build_grid.py <overture release, e.g. 2026-10-21.0> <docs/data dir> <cache dir>
Outputs: docs/data/grid_lines.geojson, docs/data/substations.geojson, docs/data/grid.json
"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pyarrow.parquet as pq
import pyarrow.compute as pc
import s3fs
import shapely
import geopandas as gpd

REL, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
W, S, E, N = 68.0, 6.5, 97.5, 37.5
fs = s3fs.S3FileSystem(anon=True)
base = f"overturemaps-us-west-2/release/{REL}/theme=base/type=infrastructure/"
cache_file = os.path.join(CACHE, f"power_{REL}.parquet")


def stats_overlap(rg):
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
    for g in range(f.metadata.num_row_groups):
        if not stats_overlap(f.metadata.row_group(g)):
            continue
        t = f.read_row_group(g, columns=["id", "geometry", "subtype", "class", "source_tags", "names", "bbox"])
        m = pc.and_(pc.equal(t["subtype"], "power"),
                    pc.and_(pc.and_(pc.greater(pc.struct_field(t["bbox"], "xmax"), W), pc.less(pc.struct_field(t["bbox"], "xmin"), E)),
                            pc.and_(pc.greater(pc.struct_field(t["bbox"], "ymax"), S), pc.less(pc.struct_field(t["bbox"], "ymin"), N))))
        t = t.filter(m)
        if t.num_rows:
            out.append(t)
    print(path.rsplit("/", 1)[-1][:12], sum(x.num_rows for x in out), flush=True)
    return out


if os.path.exists(cache_file):
    import pyarrow as pa
    tab = pq.read_table(cache_file)
else:
    import pyarrow as pa
    files = [f["name"] for f in fs.ls(base, detail=True) if f["name"].endswith(".parquet")]
    with ThreadPoolExecutor(8) as ex:
        parts = [t for r in ex.map(scan, files) for t in r]
    tab = pa.concat_tables(parts)
    pq.write_table(tab, cache_file)
print("power features", tab.num_rows)

geom = shapely.from_wkb(tab["geometry"].to_numpy(zero_copy_only=False))
cls = tab["class"].to_pylist()
tags = tab["source_tags"].to_pylist()
names = [(n or {}).get("primary") for n in tab["names"].to_pylist()]


def voltage(tg):
    if not tg:
        return None
    v = dict(tg).get("voltage")
    if not v:
        return None
    try:
        return max(float(x) for x in str(v).replace(",", ";").split(";") if x.strip().replace(".", "").isdigit()) / 1000.0
    except ValueError:
        return None

kv = [voltage(t) for t in tags]
gdf = gpd.GeoDataFrame({"cls": cls, "kv": kv, "name": names}, geometry=geom, crs=4326)
print(gdf.cls.value_counts().head(15))

# India mask from the district file
dist = gpd.read_file(os.path.join(OUT, "districts.geojson"))
india = shapely.union_all(dist.geometry.buffer(0)).buffer(0.05)
gdf = gdf[gdf.intersects(india)]

lines = gdf[gdf.cls.isin(["power_line", "minor_line", "cable"]) & gdf.geom_type.isin(["LineString", "MultiLineString"])].copy()
lines = lines[(lines.cls == "power_line") | (lines.kv.fillna(0) >= 33)]
subs = gdf[gdf.cls.isin(["substation", "plant", "generator"]) & ~gdf.geom_type.isin(["LineString", "MultiLineString"])].copy()
subs = subs[subs.cls == "substation"].copy()
subs["geometry"] = subs.geometry.representative_point()
print("lines", len(lines), "substations", len(subs))

def band(v):
    if v is None or not np.isfinite(v):
        return 0
    return 765 if v >= 700 else 400 if v >= 380 else 220 if v >= 200 else 132 if v >= 110 else 66 if v >= 60 else 33
lines["b"] = [band(v) for v in lines.kv]
subs["b"] = [band(v) for v in subs.kv]

# web layers: lines merged per voltage band (33 kV and up, plus unknown-voltage transmission lines)
web = lines  # all bands incl. 33 kV; each band is a separate feature the map can toggle
feats = []
for b, grp in web.groupby("b"):
    merged = shapely.line_merge(shapely.union_all(grp.geometry.values))
    merged = shapely.simplify(merged, 0.008)
    parts = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    parts = [p for p in parts if not p.is_empty and p.length > 0.01]
    feats.append({"b": int(b), "geometry": shapely.MultiLineString(parts)})
gpd.GeoDataFrame(feats, crs=4326).to_file(os.path.join(OUT, "grid_lines.geojson"), driver="GeoJSON", COORDINATE_PRECISION=3)
s_web = subs[subs.b >= 66][["b", "name", "geometry"]].copy()
s_web["name"] = [n if (b >= 220 and isinstance(n, str) and n) else "" for n, b in zip(s_web.name, s_web.b)]
with open(os.path.join(OUT, "substations.json"), "w") as f:  # compact [lon, lat, kV band, name]
    json.dump([[round(p.x, 3), round(p.y, 3), int(b), n] for p, b, n in zip(s_web.geometry, s_web.b, s_web.name)], f, separators=(",", ":"), allow_nan=False)

# per-district indicators in an equal-area / metric projection
P = "ESRI:102028"
d_m = dist.to_crs(P)
l_m = lines.to_crs(P)
s_m = subs.to_crs(P)
res = {}
sidx = s_m.sindex
lidx = l_m.sindex
cent = d_m.geometry.representative_point()
hv = s_m[s_m.b >= 66]
hv_tree = shapely.STRtree(hv.geometry.values)
for i, row in d_m.iterrows():
    g = row.geometry
    did = int(row["id"])
    cand = list(lidx.query(g, predicate="intersects"))
    length = {}
    if cand:
        clip = shapely.intersection(l_m.geometry.values[cand], g)
        for b, ln in zip(l_m.b.values[cand], shapely.length(clip)):
            length[int(b)] = length.get(int(b), 0) + ln / 1000
    sc = list(sidx.query(g, predicate="intersects"))
    near = hv_tree.query_nearest(cent[i], return_distance=True)
    dkm = float(near[1][0]) / 1000 if len(near[1]) else None
    area = g.area / 1e6
    res[did] = {"sub": len(sc), "subhv": int(sum(1 for j in sc if s_m.b.values[j] >= 66)),
                "lkm": round(sum(length.values()), 1), "lhv": round(sum(v for k, v in length.items() if k >= 132 or k == 0), 1),
                "dsub": round(dkm, 1) if dkm is not None else None,
                "dens": round(sum(length.values()) / max(area, 1) * 100, 2)}  # km per 100 km2
with open(os.path.join(OUT, "grid.json"), "w") as f:
    json.dump(res, f, separators=(",", ":"), allow_nan=False)
print("districts with grid stats", len(res))
