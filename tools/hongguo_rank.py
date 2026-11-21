#!/usr/bin/env python3
"""抓紅果短劇官網的 AI 劇熱播榜（公開頁面上的 schema.org ItemList），寫成 hongguo.json。
只抓排行榜的劇名、熱度、封面與官網連結；不抓、不下載、不解密任何影片。"""
import json, re, sys, urllib.request, datetime
URL = "https://hongguoduanju.com/rank/hot-ai-drama"
req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36", "Accept-Language": "zh-TW,zh;q=0.9"})
s = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
items = []
for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
    try: d = json.loads(m.group(1))
    except Exception: continue
    if isinstance(d, dict) and d.get("@type") == "ItemList":
        items = [{"name": it.get("name", "").strip(), "url": it.get("url", ""), "img": it.get("image", "")} for it in d.get("itemListElement", [])]
        break
heat = re.findall(r'([\d.]+[万亿])热度', s)
for i, it in enumerate(items):
    if i < len(heat): it["heat"] = heat[i].replace("万", "萬").replace("亿", "億")
items = [x for x in items if x["name"]][:30]
if len(items) < 5: sys.exit("too few items: %d" % len(items))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
out = {"source": URL, "updated": now.strftime("%Y-%m-%d %H:%M") + "（台灣時間）", "items": items}
open(sys.argv[1] if len(sys.argv) > 1 else "hongguo.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print(len(items), "items")
