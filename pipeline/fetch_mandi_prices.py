"""Download today's Agmarknet mandi prices from the data.gov.in API.

Usage: DATA_GOV_IN_KEY=<key> python fetch_mandi_prices.py
Writes pipeline/sources/markets/agmarknet_prices_<arrival date>.csv.gz in the same columns as the
data.gov.in CSV download, then build_markets.py picks it up.

The resource ("Current Daily Price of Various Commodities from Various Markets (Mandi)",
9ef84268-d588-465a-a308-a864a43d0070) only holds the latest day, so history builds up only if this
runs every day. Get a key from data.gov.in -> My Account; the sample key on the API page returns 10 rows.
Exit codes: 0 = new day saved, 3 = nothing new (that day is already saved), 1 = error.
"""
import csv, gzip, io, json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime

URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
PAGE = 1000
COLS = [("State", "state"), ("District", "district"), ("Market", "market"), ("Commodity", "commodity"), ("Variety", "variety"),
        ("Grade", "grade"), ("Arrival_Date", "arrival_date"), ("Min_x0020_Price", "min_price"), ("Max_x0020_Price", "max_price"),
        ("Modal_x0020_Price", "modal_price")]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "markets")


def get(offset, key):
    q = urllib.parse.urlencode({"api-key": key, "format": "json", "offset": offset, "limit": PAGE})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{URL}?{q}", headers={"User-Agent": "agripv-dashboard"}), timeout=90) as r:
                return json.load(r)
        except Exception as e:  # the API is slow and drops connections now and then
            if attempt == 4:
                raise
            print(f"offset {offset}: {e}; retrying", file=sys.stderr)
            time.sleep(10 * (attempt + 1))


def main():
    key = os.environ.get("DATA_GOV_IN_KEY", "").strip()
    if not key:
        sys.exit("DATA_GOV_IN_KEY is not set")
    rows, offset, total = [], 0, None
    while True:
        d = get(offset, key)
        if d.get("status") == "error" or "records" not in d:
            sys.exit(f"API error: {d.get('message') or str(d)[:300]}")
        total = int(d.get("total") or 0)
        rows += d["records"]
        offset += PAGE
        if not d["records"] or offset >= total:
            break
    print(f"{len(rows)} records (API total {total})")
    if len(rows) < 100:
        sys.exit("too few records: is this the sample key? Use your own key from data.gov.in -> My Account")
    rows = [{c: r.get(f, "") for c, f in COLS} for r in rows]
    days = sorted({r["Arrival_Date"] for r in rows}, key=lambda s: datetime.strptime(s, "%d/%m/%Y"))
    day = datetime.strptime(days[-1], "%d/%m/%Y").strftime("%Y-%m-%d")
    path = os.path.join(OUT, f"agmarknet_prices_{day}.csv.gz")
    for old in (path, path[:-3]):
        if os.path.exists(old):
            with (gzip.open(old, "rt", newline="") if old.endswith(".gz") else open(old, newline="")) as f:
                n = sum(1 for _ in csv.DictReader(f))
            if n >= len(rows):
                print(f"{os.path.basename(old)} already has {n} rows; nothing new")
                sys.exit(3)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=[c for c, _ in COLS])
    w.writeheader()
    w.writerows(rows)
    with gzip.GzipFile(path, "wb", mtime=0) as f:
        f.write(buf.getvalue().encode("utf-8"))
    if os.path.exists(path[:-3]):  # an uncompressed upload of the same day, now superseded
        os.remove(path[:-3])
    print(f"saved {os.path.basename(path)} ({len(rows)} rows; arrival dates {', '.join(days)})")


if __name__ == "__main__":
    main()
