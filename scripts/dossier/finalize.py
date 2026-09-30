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
# служебная метка конца оглавления нужна только для счёта страниц: убрать из текстового слоя
for page in d:
    rects = [pymupdf.Rect(sp['bbox']) for b in page.get_text('dict')['blocks'] for l in b.get('lines', [])
             for sp in l['spans'] if sp['size'] < 2 and sp['text'].strip()]
    for r in rects: page.add_redact_annot(r)
    if rects: page.apply_redactions(images=0, graphics=0)
d.set_toc(toc)
d.save(out, garbage=4, deflate=True, deflate_fonts=True, use_objstms=1, compression_effort=100)
print('закладок', len(toc))
