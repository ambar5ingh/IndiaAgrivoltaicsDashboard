"""District boundaries and the ~300 m district-id grid, shared by the build scripts.

Same cleaning as build_data.py (names, slivers, dissolve, ids sorted by state and district),
so ids match docs/data/districts.json.
"""
import numpy as np
import geopandas as gpd
from rasterio import features
from rasterio.transform import from_origin

W, S, E, N = 68.0, 6.5, 97.5, 37.5
RES = 3.0 / 1125
NX, NY = int(round((E - W) / RES)), int(round((N - S) / RES))
TF = from_origin(W, N, RES, RES)

KA = {"0555": "BELAGAVI", "0556": "BAGALKOTE", "0558": "BIDAR", "0562": "DHARWAD", "0564": "HAVERI", "0565": "BALLARI",
      "0567": "DAVANAGERE", "0574": "HASSAN", "0578": "CHAMARAJANAGAR", "0580": "YADGIR", "0581": "KOLAR",
      "0582": "CHIKKABALLAPURA", "0584": "RAMANAGARA"}


def load_districts(path):
    g = gpd.read_file(path)
    named = g[g["district"].notna()]
    for i in g.index[g["district"].isna()]:
        geom = g.at[i, "geometry"].buffer(0)
        cand = named[named.intersects(geom.buffer(0.01))]
        if len(cand) == 0:
            cand = named.iloc[[named.distance(geom).argmin()]]
        best = cand.geometry.buffer(0).intersection(geom.buffer(0.01)).area.idxmax()
        g.loc[i, ["state", "district", "dist_code"]] = g.loc[best, ["state", "district", "dist_code"]].values
    ka = g["state"].str.upper().str.strip().eq("KARNATAKA") & g["dist_code"].isin(list(KA))
    g.loc[ka, "district"] = g.loc[ka, "dist_code"].map(KA)
    g["state"] = g["state"].str.strip().str.upper()
    g["district"] = g["district"].str.strip().str.upper()
    for a, b in {">": "A", "|": "I", "\\": "I", "#": "U", "@": "U", "_": "-"}.items():
        g["district"] = g["district"].str.replace(a, b, regex=False)
    g["district"] = g["district"].str.replace(r"\s+", " ", regex=True).str.replace("24PARGANAS", "24 PARGANAS")
    g.loc[g.state == "GUJARAT AND DNH & DD ISLANDS", ["state", "district"]] = ["GUJARAT", "ISLANDS (GUJARAT COAST)"]
    g["geometry"] = g.geometry.make_valid()
    g = g.dissolve(by=["state", "district"], as_index=False)[["state", "district", "geometry"]]
    g = g.sort_values(["state", "district"]).reset_index(drop=True)
    g["id"] = np.arange(1, len(g) + 1)
    cen = g.to_crs("ESRI:102028").representative_point().to_crs(4326)
    g["lat"], g["lon"] = cen.y, cen.x
    return g


def id_grid(g):
    """District id per ~300 m cell, plus the (row, col, id) list of district cells."""
    ids = features.rasterize(((geom, i) for geom, i in zip(g.geometry, g.id)), out_shape=(NY, NX),
                             transform=TF, fill=0, dtype="int32", all_touched=False)
    missing = set(g.id) - set(np.unique(ids))
    if missing:
        sub = g[g.id.isin(missing)]
        extra = features.rasterize(((geom, i) for geom, i in zip(sub.geometry, sub.id)), out_shape=(NY, NX),
                                   transform=TF, fill=0, dtype="int32", all_touched=True)
        ids = np.where((ids == 0) & (extra > 0), extra, ids)
    rows, cols = np.nonzero(ids)
    pid = ids[rows, cols]
    for d in sorted(set(g.id) - set(np.unique(ids))):
        r = g[g.id == d].iloc[0]
        rows = np.append(rows, int((N - r.lat) / RES)); cols = np.append(cols, int((r.lon - W) / RES)); pid = np.append(pid, d)
    return ids, rows, cols, pid
