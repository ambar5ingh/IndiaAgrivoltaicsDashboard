"""Mandi (agricultural market) and cold storage points for the map.

Usage: python build_markets.py <docs dir>
Inputs in pipeline/sources/markets/:
  agmarknet_prices_*.csv[.gz] data.gov.in "Current Daily Price of Various Commodities from Various Markets
                             (Mandi)" (Agmarknet), one file per download day; more days = more mandis.
                             Each mandi shows its latest day, plus the change from its previous report.
                             fetch_mandi_prices.py can download a day, but only from a machine in India
  enam_directory_*.txt       text of the SFAC "e-NAM Directory" PDF (1,000 eNAM mandis, July 2021)
  nhb_icap_gis.csv           the point feed behind NHB's "Cold Storage Map of India"
                             (https://nhb.gov.in/Handlers/GeoIndiaHandlerGis.ashx), saved from a browser
Outputs: docs/data/mandis.json, docs/data/cold_storage.json

Neither mandi source has coordinates. Each mandi is placed by matching its town name against
OpenStreetMap place names (Overture Maps divisions) and OSM market-yard POIs (Overture places)
inside its district, widened by about 12 km and then 30 km for renamed or split districts.
Mandis that match nothing are left off the map and counted in the metadata.
The Overture extracts for India are cached in pipeline/.cache (first run downloads ~200 MB, ~25 min).
"""
import glob, json, os, re, sys, warnings
import numpy as np, pandas as pd, geopandas as gpd
from rapidfuzz import fuzz, process
from shapely import wkb

warnings.filterwarnings("ignore")
DOCS = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sources", "markets")
CACHE = os.path.join(HERE, ".cache")
OVERTURE = "overturemaps-us-west-2/release/2026-10-21.0"
os.makedirs(CACHE, exist_ok=True)

# ------------------------------------------------------------------ districts
dist = gpd.read_file(os.path.join(DOCS, "data", "districts.geojson")).merge(
    pd.DataFrame(json.load(open(os.path.join(DOCS, "data", "districts.json"))))[["id", "st", "d"]], on="id")


def key(s):
    """Loose transliteration key: Devariya ~ Deoria is still too far, but Ballabhgarh = Ballabgarh."""
    s = re.sub(r"[^a-z]", "", str(s).lower())
    for a, b in [("aa", "a"), ("ee", "i"), ("oo", "u"), ("w", "v"), ("z", "j"), ("ph", "f"), ("sh", "s"), ("th", "t"),
                 ("dh", "d"), ("kh", "k"), ("gh", "g"), ("bh", "b"), ("ch", "c"), ("jh", "j"), ("y", "i"), ("q", "k")]:
        s = s.replace(a, b)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s.rstrip("h") or s


def key2(k):  # drop a trailing vowel or -am/-um (Hindupur = Hindupuram)
    return re.sub(r"(am|um|u|a|e|i|o)$", "", k)


dist["k"] = dist.d.map(key)
ST_ALIAS = {"keralam": "Kerala", "chattisgarh": "Chhattisgarh", "nct of delhi": "Delhi", "andaman and nicobar": "Andaman and Nicobar Islands",
            "maharastra": "Maharashtra", "uttrakhand": "Uttarakhand", "pondicherry": "Puducherry", "jammu & kashmir": "Jammu and Kashmir",
            "jammu and kashmir": "Jammu and Kashmir", "orissa": "Odisha"}
DALIAS = {"khurda": "khordha", "sonepur": "subarnapur", "spsr nellore": "nellore", "bengaluru": "bengaluru urban", "bangalore": "bengaluru urban",
          "bengaluru south": "ramanagara", "markapuram": "prakasam", "tirupathi": "tirupati", "palakad": "palakkad", "kasargod": "kasaragod",
          "bhatinda": "bathinda", "sundergarh": "sundargarh", "mewat": "nuh", "allahabad": "prayagraj", "faizabad": "ayodhya", "gurgaon": "gurugram",
          "mysore": "mysuru", "bellary": "ballari", "bijapur": "vijayapura", "gulbarga": "kalaburagi", "belgaum": "belagavi", "shimoga": "shivamogga",
          "tumkur": "tumakuru", "chittor": "chittoor", "ahmadnagar": "ahmednagar", "cooch behar": "koch bihar", "howrah": "haora", "hooghly": "hugli",
          "calicut": "kozhikode", "trichur": "thrissur", "thirssur": "thrissur", "quilon": "kollam", "trivandrum": "thiruvananthapuram",
          "kancheepuram": "kanchipuram", "tuticorin": "thoothukkudi", "nawanshahr": "shahid bhagat singh nagar", "ropar": "rupnagar",
          "mohali": "sas nagar", "east champaran": "purbi champaran", "west champaran": "pashchim champaran", "sabar kantha": "sabarkantha",
          "banas kantha": "banaskantha", "panch mahals": "panchmahal", "osmanabad": "dharashiv"}


def state_of(s):
    s0 = str(s).strip()
    if s0.lower() in ST_ALIAS:
        return ST_ALIAS[s0.lower()]
    best = process.extractOne(s0, dist.st.unique(), scorer=fuzz.ratio)
    return best[0] if best and best[1] >= 80 else None


def district_of(st, d):
    if d is None:
        return None
    d0 = re.sub(r"\(.*?\)", "", str(d)).strip().lower()
    cand = dist[dist.st == st] if st else dist
    keys = [key(d0)] + ([key(DALIAS[d0])] if d0 in DALIAS else [])
    for k in keys:
        hit = cand[cand.k == k]
        if len(hit):
            return hit.iloc[0]
    best = process.extractOne(keys[0], cand.k.tolist(), scorer=fuzz.ratio)
    if best and best[1] >= 82:
        return cand.iloc[best[2]]
    for k in keys:
        if len(k) >= 5:
            hit = cand[cand.k.str.startswith(k[:5])]
            if len(hit) == 1:
                return hit.iloc[0]
    return None


# ------------------------------------------------------------------ Overture gazetteer (OSM place names) and market POIs
def overture(name, theme, cols, flt):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        import s3fs, pyarrow.dataset as ds, pyarrow.parquet as pq
        print("downloading", name, "from Overture (slow) ...")
        d = ds.dataset(f"{OVERTURE}/{theme}/", filesystem=s3fs.S3FileSystem(anon=True), format="parquet")
        pq.write_table(d.to_table(columns=cols, filter=flt), path)
    return pd.read_parquet(path)


import pyarrow.compute as pc
g = overture("india_divisions.parquet", "theme=divisions/type=division",
             {"name": pc.field("names", "primary"), "subtype": pc.field("subtype"), "class": pc.field("class"), "geometry": pc.field("geometry")},
             pc.field("country") == "IN")
g = g[g.subtype.isin(["locality", "neighborhood", "macrohood", "county"])]
g = gpd.GeoDataFrame(g.drop(columns="geometry"), geometry=[wkb.loads(b) for b in g.geometry], crs=4326)
g["geometry"] = g.geometry.representative_point()
g["k"] = g.name.map(key)
g["k2"] = g.k.map(key2)
g["rank"] = g["class"].map({"city": 4, "town": 3, "village": 2, "hamlet": 1})
g["rank"] = g["rank"].fillna(pd.Series(np.where(g.subtype.eq("county"), 3, 1), index=g.index))

P = overture("india_places.parquet", "theme=places/type=place",
             {"name": pc.field("names", "primary"), "x": pc.field("bbox", "xmin"), "y": pc.field("bbox", "ymin"), "conf": pc.field("confidence")},
             (pc.field("bbox", "xmin") > 68) & (pc.field("bbox", "xmax") < 98) & (pc.field("bbox", "ymin") > 6) & (pc.field("bbox", "ymax") < 37.5))
MARKET_RE = (r"(?i)\bapmc\b|market ?yard|mandi samiti|krishi upaj|krishi utpadan|krushi utpanna|agricultural market|regulated market|"
             r"market committee|grain market|anaj mandi|sabzi mandi|uzhavar|vfpck|bazar samiti|agricultural produce")
P = P[P.name.fillna("").str.contains(MARKET_RE) & (P.conf >= 0.4)]
P = gpd.GeoDataFrame(P, geometry=gpd.points_from_xy(P.x, P.y), crs=4326)
print("gazetteer", len(g), "place names;", len(P), "market-yard POIs")

STOP = (r"\b(apmc|a\.?p\.?m\.?c|f\s*&\s*v|ff\s*&\s*v|fruit\s*&?\s*veg\w*|veg\.?|vegetables?|market|mandi|samiti|krishi|upaj|utpadan|uzhavar|sandhai|"
        r"vfpck|vfpc|grain|new|old|yard|sub|main|principal|kvk|fruits?|and|amc|rmc|rythu|bazar|bazaar|union|naveen|nayi|cattle|onion|potato|"
        r"cotton|coconut|copra|banana|chilli|turmeric|green|wholesale|retail|ltd|centre|center|private|pvt|ksk|sabzi|subzi|sabji|anaj|dana|"
        r"kisan|krushi|utpanna|samithi|committee|of|the|at|chowk|road|unit|smy|pmy|hq|h/q|rbz)\b")


def town(m):
    s = re.sub(r"\(.*?\)", "", str(m))
    s = re.sub(r"[,./-]", " ", s)
    s = re.sub(STOP, " ", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip()


_state_gaz = {}


def locate(st, dname, mname):
    """Return dict with lat/lon/prec ('market' yard POI, 'town', 'village') or why it failed."""
    D = district_of(st, dname)
    t = town(mname) or str(dname or "")
    tk = key(t)
    first = key(t.split()[0]) if t.split() else tk
    out = {"town": t, "state": st}

    def pick(c, note=None):
        r = c.sort_values("rank", ascending=False).iloc[0]
        o = {**out, "lat": r.geometry.y, "lon": r.geometry.x, "prec": "town" if r["rank"] >= 3 else "village", "matched": r["name"]}
        if note:
            o["note"] = note
        return o

    if D is None:  # district unknown: accept a name that is unique (or clearly the biggest place) in the state
        if st and len(tk) >= 4:
            if st not in _state_gaz:
                _state_gaz[st] = g[g.geometry.within(dist[dist.st == st].union_all())]
            ex = _state_gaz[st][_state_gaz[st].k == tk].sort_values("rank", ascending=False)
            if len(ex) and (len(ex) == 1 or ex["rank"].iloc[0] > ex["rank"].iloc[1]):
                return pick(ex, "district not recognised; unique place name in the state")
        return {**out, "why": "district not found"}
    out["district"] = D.d
    out["state"] = D.st
    area = gpd.GeoSeries([D.geometry], crs=4326).buffer(0.12).iloc[0]
    cand = P[P.geometry.within(area)]
    if len(cand) and len(tk) >= 5:
        sc = [max(fuzz.partial_ratio(tk, key(n)), fuzz.partial_ratio(first, key(n)) if len(first) >= 5 else 0) for n in cand.name]
        i = int(np.argmax(sc))
        if sc[i] >= 92:
            r = cand.iloc[i]
            return {**out, "lat": r.y, "lon": r.x, "prec": "market", "matched": r["name"]}
    for buf in (0.12, 0.3):
        area = gpd.GeoSeries([D.geometry], crs=4326).buffer(buf).iloc[0]
        cand = g[g.geometry.within(area)]
        if not len(cand):
            continue
        for kk in (tk, first):
            if len(kk) < 3:
                continue
            ex = cand[cand.k == kk]
            if len(ex):
                inside = ex[ex.geometry.within(D.geometry)]
                return pick(inside if len(inside) else ex)
        k2 = key2(tk)
        if len(k2) >= 4:
            ex = cand[cand.k2 == k2]
            if len(ex):
                return pick(ex)
        if len(tk) >= 5:
            sc = np.array([fuzz.ratio(tk, k) if k[:2] == tk[:2] else 0 for k in cand.k])
            if sc.max() >= 86:
                return pick(cand[sc == sc.max()], "close spelling match")
    return {**out, "why": "no place match"}


# ------------------------------------------------------------------ Agmarknet daily prices
KEEP_DAYS = 30  # mandis whose last report is older than this drop off the price layer
frames = [pd.read_csv(f) for f in sorted(glob.glob(os.path.join(SRC, "agmarknet_prices_*.csv*")))]
pr = pd.concat(frames, ignore_index=True)
pr.columns = [c.replace("_x0020_", "_") for c in pr.columns]
pr["date"] = pd.to_datetime(pr.Arrival_Date, dayfirst=True)
for c in ("Min_Price", "Max_Price", "Modal_Price"):
    pr[c] = pd.to_numeric(pr[c], errors="coerce")
pr = pr.dropna(subset=["Min_Price", "Max_Price", "Modal_Price", "Market", "Commodity"])
pr = pr[pr.date > pr.date.max() - pd.Timedelta(days=KEEP_DAYS)]
pr[["Variety", "Grade"]] = pr[["Variety", "Grade"]].fillna("")
pr = pr.sort_values("date").drop_duplicates(["State", "District", "Market", "Commodity", "Variety", "Grade", "date"], keep="last")
LOT = ["Commodity", "Variety", "Grade"]
agm, prevp = {}, {}
for (s, d, m), grp in pr.groupby(["State", "District", "Market"]):
    last = grp.date.max()
    agm[(s, d, m)] = grp[grp.date == last]  # a mandi shows only its latest reporting day
    older = grp[grp.date < last]
    if len(older):  # modal price at the mandi's previous report, for the day-on-day change
        o = older[older.date == older.date.max()]
        prevp[(s, d, m)] = (older.date.max(), {tuple(r[:3]): int(r[3]) for r in o[LOT + ["Modal_Price"]].itertuples(index=False)})
print("Agmarknet:", len(agm), "markets reporting on", pr.date.dt.date.nunique(), "day(s)")

# ------------------------------------------------------------------ eNAM directory
ENAM_STATES = ["ANDHRA PRADESH", "CHANDIGARH", "CHHATTISGARH", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR", "JHARKHAND",
               "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "ODISHA", "PUDUCHERRY", "PUNJAB", "RAJASTHAN", "TELANGANA",
               "TAMIL NADU", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"]
GROUP_RE = (r"^(Cereals|Oil ?Seeds|Pulses|Fib(?:er|re) Crops|Vegetables|Fruits|Spices|Forest\s*Products?|Minor\s*Forest|Dry Fruits|Other|"
            r"Flowers|Live ?stock|Beverages|Plantation|Condiments)\b")


def parse_enam(path):
    L = [l.replace("\r", "").rstrip() for l in open(path, encoding="utf-8")]
    start = next(i for i, l in enumerate(L) if l.strip() == "ANDHRA PRADESH" and i > 300)
    skip = re.compile(r"^(Page No.*|Uttam fasal.*|www\.enam.*|S\.|Sr\.|No\.?|no|Mandi|Mandi Postal|Mandi District Mandi Postal|Mandi Postal Address|"
                      r"Contact|contact|Commodit|Commodity|y Group|Group|Name|Commodity Name|number|Number|Address|Mandi contact|Mandi Contact|"
                      r"Mandi District Mandi Postal Address|Mandi\s+contact\s+number|Commodity\s*Group)\s*$")
    state, exp, cur, out = None, 1, None, []
    for l in L[start:]:
        s = l.strip()
        if s in ENAM_STATES:
            state, exp = s.title().replace("&", "and"), 1
            continue
        if s == "HEAD OFFICE":
            break
        m = re.match(r"^(\d{1,3})(?:\s+(\S.*))?$", s)
        if m and int(m.group(1)) > 0 and (exp - 2 <= int(m.group(1)) <= exp + 3 or int(m.group(1)) == 1):
            exp = int(m.group(1)) + 1
            cur = {"state": state, "lines": [m.group(2)] if m.group(2) else []}
            out.append(cur)
            continue
        if cur is not None and s and not skip.match(s):
            cur["lines"].append(s)
    return out


def split_head(e):
    ls = [x for x in e["lines"] if x]
    if not ls or re.match(GROUP_RE, ls[0]):
        return None, None, []
    t, rest = ls[0], ls[1:]
    if rest and (rest[0][:1].islower() or (len(t.split()) == 1 and len(rest[0]) <= 6)):
        t, rest = t + rest[0], rest[1:]
    st = state_of(e["state"])
    w = t.split()
    for i in range(1, len(w)):
        if district_of(st, " ".join(w[i:])) is not None:
            return " ".join(w[:i]), " ".join(w[i:]), rest
    if rest:
        w2 = (t + " " + rest[0]).split()
        for i in range(1, len(w)):
            if district_of(st, " ".join(w2[i:])) is not None:
                return " ".join(w2[:i]), " ".join(w2[i:]), rest[1:]
    return t, None, rest


PIN_ZONE = {"Delhi": "1", "Haryana": "1", "Punjab": "1", "Himachal Pradesh": "1", "Jammu and Kashmir": "1", "Chandigarh": "1",
            "Uttar Pradesh": "2", "Uttarakhand": "2", "Rajasthan": "3", "Gujarat": "3", "Maharashtra": "4", "Madhya Pradesh": "4",
            "Chhattisgarh": "4", "Goa": "4", "Andhra Pradesh": "5", "Telangana": "5", "Karnataka": "5", "Tamil Nadu": "6", "Kerala": "6",
            "Puducherry": "6", "West Bengal": "7", "Odisha": "7", "Assam": "7", "Bihar": "8", "Jharkhand": "8"}
enam = []
for e in parse_enam(glob.glob(os.path.join(SRC, "enam_directory_*.txt"))[0]):
    m, d, rest = split_head(e)
    if not m:
        continue
    addr, comm, prev = [], [], ""
    for x in rest:
        if re.match(GROUP_RE, x) or comm:
            comm.append(x)
        elif prev.endswith("-") and re.fullmatch(r"\d{5,8}\s*", x):
            pass  # second half of a landline number split over two lines
        elif not re.search(r"\d{7,}|\d{2,5}-\s*$|/\s*$", x) and len(addr) < 7:
            addr.append(x)
        prev = x.strip()
    zone = PIN_ZONE.get(state_of(e["state"]))
    pins = [a + b for a, b in re.findall(r"(?<![\d-])([1-8]\d{2}) ?(\d{3})(?![\d-])", " ".join(addr))
            if zone is None or a[0] == zone]
    groups = {}
    ctext = re.sub(r"\s+", " ", " ".join(comm))
    ctext = re.sub(GROUP_RE.replace("^", r"\b"), lambda mm: "|" + mm.group(1).strip() + ":", ctext)
    for part in ctext.split("|"):
        if ":" in part:
            gname, items = part.split(":", 1)
            items = [i.strip(" ,") for i in re.split(r",", items) if i.strip(" ,")]
            if items:
                groups.setdefault(gname.strip(), []).extend(items)
    a = re.sub(r"[\x00-\x1f]", "-", " ".join(addr))
    a = re.sub(r"\s*\(?\d{3,5}\)?\d[\d ]*$|\s*Pin\s*-?\s*:?\s*$", "", re.sub(r"\s+", " ", a)).strip(" ,-")
    enam.append(dict(state=e["state"], market=m, district=d, addr=a,
                     pin=pins[0] if pins else None, comm=groups))
print("eNAM directory:", len(enam), "mandis parsed")

# ------------------------------------------------------------------ geocode and merge
mandis = []
fails = {"agm": 0, "enam": 0}
for (s, d, m), grp in agm.items():
    loc = locate(state_of(s), d, m)
    if "lat" not in loc:
        fails["agm"] += 1
        continue
    pdate, pmod = prevp.get((s, d, m), (None, {}))
    prices = []
    for r in grp.sort_values("Commodity").itertuples():
        row = [r.Commodity, r.Variety if r.Variety != r.Commodity else "", int(r.Min_Price), int(r.Max_Price), int(r.Modal_Price)]
        if (r.Commodity, r.Variety, r.Grade) in pmod:
            row.append(pmod[(r.Commodity, r.Variety, r.Grade)])  # 6th field: previous modal price
        prices.append(row)
    mandis.append(dict(n=m, st=loc["state"], d=loc.get("district") or d, lat=round(loc["lat"], 5), lon=round(loc["lon"], 5), p=loc["prec"],
                       at=str(loc["matched"]), agm=1, date=grp.date.max().strftime("%Y-%m-%d"), prices=prices, note=loc.get("note"),
                       pdate=pdate.strftime("%Y-%m-%d") if pdate is not None and any(len(x) == 6 for x in prices) else None))
for e in enam:
    st = state_of(e["state"])
    loc = locate(st, e["district"], e["market"])
    if "lat" not in loc:
        fails["enam"] += 1
        continue
    tk = key(town(e["market"]))
    hit = None
    for x in mandis:  # same mandi already listed from Agmarknet?
        if x.get("agm") and x["st"] == loc["state"] and not re.search(r"(?i)uzhavar|vfpck", x["n"]) and abs(x["lat"] - loc["lat"]) < 0.05 and abs(x["lon"] - loc["lon"]) < 0.05 \
                and fuzz.ratio(key(town(x["n"])), tk) >= 85:
            hit = x
            break
    rec = dict(enam=1, addr=e["addr"], pin=e["pin"], comm=e["comm"])
    if hit:
        if hit.get("enam"):
            continue
        hit.update(rec)
    else:
        mandis.append(dict(n=e["market"], st=loc["state"], d=loc.get("district") or e["district"], lat=round(loc["lat"], 5),
                           lon=round(loc["lon"], 5), p=loc["prec"], at=str(loc["matched"]), note=loc.get("note"), **rec))
for x in mandis:
    for k in [k for k, v in x.items() if v is None or (isinstance(v, (str, dict, list)) and not v) or (isinstance(v, float) and v != v)]:
        del x[k]
meta = dict(
    agm_markets=len(agm), agm_days=sorted({d.strftime("%Y-%m-%d") for d in pr.date}),
    agm_latest=sum(1 for g_ in agm.values() if g_.date.max() == pr.date.max()), enam_parsed=len(enam), unplaced=fails,
    placed=len(mandis), placed_latest=sum(1 for x in mandis if x.get("date") == pr.date.max().strftime("%Y-%m-%d")), on_enam=sum(1 for x in mandis if x.get("enam")), with_prices=sum(1 for x in mandis if x.get("agm")),
    prec={p: sum(1 for x in mandis if x["p"] == p) for p in ("market", "town", "village")},
    source="Agmarknet daily prices via data.gov.in (OGD licence); SFAC e-NAM Directory (July 2021); "
           "positions from OpenStreetMap place names via Overture Maps (ODbL)")
json.dump(dict(meta=meta, mandis=mandis), open(os.path.join(DOCS, "data", "mandis.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("mandis:", json.dumps(meta)[:400])

# ------------------------------------------------------------------ NHB cold storage
cs = pd.read_csv(os.path.join(SRC, "nhb_icap_gis.csv"), encoding_errors="replace").dropna(subset=["latitude", "longitude"])
cs = cs[cs.latitude.between(6, 37.5) & cs.longitude.between(68, 98)].copy()
for c in ("NameofProject", "StateName", "DistrictName"):
    cs[c] = cs[c].astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
pts = gpd.GeoDataFrame(cs, geometry=gpd.points_from_xy(cs.longitude, cs.latitude), crs=4326)
j = gpd.sjoin(pts, dist[["st", "d", "geometry"]], how="left", predicate="within")
j = j[~j.index.duplicated()]
states = dist.dissolve("st").to_crs(7755)
SAME = {"Andhra Pradesh": {"Telangana"}, "Uttrakhand": {"Uttarakhand"}, "Maharastra": {"Maharashtra"}}
cold = []
for i, r in j.iterrows():
    stn = state_of(r.StateName)
    ok = isinstance(r.st, str) and (r.st == stn or r.st in SAME.get(r.StateName, set()))
    flag = None
    if not ok:
        if stn and stn in states.index:
            dkm = states.loc[[stn]].distance(gpd.GeoSeries([r.geometry], crs=4326).to_crs(7755).iloc[0]).iloc[0] / 1000
            flag = None if dkm <= 25 else "check"
        else:
            flag = "check"
    rounded = len(str(r.latitude).split(".")[-1]) <= 2 and len(str(r.longitude).split(".")[-1]) <= 2
    rec = dict(n=r.NameofProject.title() if r.NameofProject.isupper() else r.NameofProject, st=r.StateName, d=r.DistrictName,
               lat=round(float(r.latitude), 5), lon=round(float(r.longitude), 5))
    if isinstance(r.st, str) and r.d != r.DistrictName:
        rec["in"] = f"{r.d}, {r.st}"
    if flag:
        rec["f"] = flag
    if rounded:
        rec["r"] = 1
    cold.append(rec)
cmeta = dict(n=len(cold), check=sum(1 for c in cold if c.get("f")), rounded=sum(1 for c in cold if c.get("r")),
             source="National Horticulture Board, Integrated Cold Chain Availability Platform (ICAP) cold storage map, downloaded 2026-11-09")
json.dump(dict(meta=cmeta, sites=cold), open(os.path.join(DOCS, "data", "cold_storage.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("cold storage:", cmeta)
