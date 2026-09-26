# закладки по заголовкам + сжатие без потерь (Chromium без tagged PDF закладок не даёт)
import pymupdf, json, re, html, sys
pdf, src_html, pages_json, out = sys.argv[1:5]
d = pymupdf.open(pdf)
pages = json.load(open(pages_json))
h = open(src_html, encoding='utf-8').read()
toc, prev = [], 0
for lvl, inner in re.findall(r'<h([1-4]) id="[^"]+"[^>]*>(.*?)</h\1>', h, flags=re.S):
    t = html.unescape(re.sub(r'<[^>]+>', '', inner)).replace('­', '').strip()
    if t not in pages: continue
    lvl = int(lvl) if toc else 1
    lvl = min(lvl, prev + 1) if toc else 1
    toc.append([lvl, t, 1 if not toc else pages[t]]); prev = lvl
d.set_toc(toc)
d.save(out, garbage=4, deflate=True, deflate_fonts=True, use_objstms=1, compression_effort=100)
print('закладок', len(toc))
