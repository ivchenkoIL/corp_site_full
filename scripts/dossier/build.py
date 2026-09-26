# md -> html для досье: якоря разделов, §-ссылки, оглавление, вёрстка A4.
import re, sys, html, markdown, pathlib

import json
SRC, OUT = sys.argv[1], sys.argv[2]
PAGES = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
FONTS = pathlib.Path(__file__).parent / 'fonts'
t = open(SRC, encoding='utf-8').read()

md = markdown.Markdown(extensions=['tables', 'sane_lists'])
body = md.convert(t)

# якоря заголовков
toc = []
sec_ids = set()
def head(m):
    lvl, inner = int(m.group(1)), m.group(2)
    plain = re.sub(r'<[^>]+>', '', inner)
    mm = re.match(r'([IVX]+\.[0-9]+(?:\.[0-9]+)?)\.', plain)
    if mm:
        hid = 's-' + mm.group(1); sec_ids.add(mm.group(1))
    else:
        hid = 'h-%d' % len(toc)
    toc.append((lvl, hid, plain))
    cls = ' class="part"' if lvl == 1 and len(toc) > 1 else ''
    return '<h%d id="%s"%s>%s</h%d>' % (lvl, hid, cls, inner, lvl)
body = re.sub(r'<h([1-4])>(.*?)</h\1>', head, body, flags=re.S)

# §-ссылки -> гиперссылки (не внутри заголовков и code)
def link_refs(seg):
    return re.sub(r'§\s?([IVX]+\.[0-9]+(?:\.[0-9]+)?)',
                  lambda m: '<a class="ref" href="#s-%s">%s</a>' % (m.group(1), m.group(0))
                  if m.group(1) in sec_ids else m.group(0), seg)
parts = re.split(r'(<h[1-4][^>]*>.*?</h[1-4]>|<code>.*?</code>)', body, flags=re.S)
body = ''.join(p if (p.startswith('<h') or p.startswith('<code>')) else link_refs(p) for p in parts)

import pyphen
_hy = pyphen.Pyphen(lang='ru')
def _hyph_text(txt):
    return re.sub(r'[А-Яа-яЁё\u0301]{7,}', lambda m: _hy.inserted(m.group(0), hyphen='\u00ad') if '\u0301' not in m.group(0) else m.group(0), txt)
def hyph(seg):
    return re.sub(r'>([^<]+)<', lambda m: '>' + _hyph_text(m.group(1)) + '<', seg)
parts = re.split(r'(<h[1-4][^>]*>.*?</h[1-4]>|<code>.*?</code>)', body, flags=re.S)
body = ''.join(p if (p.startswith('<h') or p.startswith('<code>')) else hyph(p) for p in parts)

# оглавление: части и разделы до уровня 3
items = []
for lvl, hid, plain in toc[1:]:
    if lvl > 3: continue
    pg = PAGES.get(plain.strip(), '')
    items.append('<li class="t%d"><a href="#%s"><span class="tt">%s</span><span class="pg">%s</span></a></li>' % (lvl, hid, html.escape(plain), pg))
toc_html = '<nav class="toc"><h2 class="toch">Содержание</h2><ul>%s</ul><span class="tocend">TOCENDMARK</span></nav>' % ''.join(items)

# титул = первый h1 + подзаголовок; оглавление после вводного блока (до первого h2)
first_h2 = body.find('<h2')
body = body[:first_h2] + toc_html + body[first_h2:]

def ff(name, file, weight, style):
    return ("@font-face{font-family:'%s';src:url('file://%s') format('truetype');"
            "font-weight:%s;font-style:%s}" % (name, FONTS / file, weight, style))
fonts = ''.join([
    ff('PT Serif', 'PT_Serif-Web-Regular.ttf', 400, 'normal'),
    ff('PT Serif', 'PT_Serif-Web-Bold.ttf', 700, 'normal'),
    ff('PT Serif', 'PT_Serif-Web-Italic.ttf', 400, 'italic'),
    ff('PT Serif', 'PT_Serif-Web-BoldItalic.ttf', 700, 'italic'),
    ff('PT Sans', 'PT_Sans-Web-Regular.ttf', 400, 'normal'),
    ff('PT Sans', 'PT_Sans-Web-Bold.ttf', 700, 'normal'),
])
css = fonts + """
@page { size: A4; margin: 20mm 19mm 22mm 19mm; }
html { font-family: 'PT Serif', 'DejaVu Serif', serif; font-size: 10.6pt; line-height: 1.5;
       color: #1d1d1f; hyphens: auto; -webkit-hyphens: auto; }
body { margin: 0; text-rendering: optimizeLegibility; font-kerning: normal; }
p { margin: 0 0 .62em; text-align: justify; orphans: 3; widows: 3; }
h1, h2, h3, h4 { font-family: 'PT Sans', 'DejaVu Sans', sans-serif; color: #14213d;
       line-height: 1.25; hyphens: manual; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 24pt; margin: 0 0 .5em; letter-spacing: -.01em; }
h1.part { break-before: page; font-size: 17pt; text-transform: none; border-bottom: 2px solid #c9a227;
          padding-bottom: .35em; margin: 0 0 1em; }
h2 { font-size: 13.5pt; margin: 1.6em 0 .55em; border-bottom: .6pt solid #d0d4dc; padding-bottom: .2em; }
h3 { font-size: 11.6pt; margin: 1.3em 0 .45em; }
h4 { font-size: 10.8pt; margin: 1.1em 0 .4em; }
h1 + p em:only-child { color: #555; }
blockquote { margin: .8em 0; padding: .55em .9em; background: #f5f3ec; border-left: 3px solid #c9a227;
             border-radius: 2px; break-inside: avoid-page; }
blockquote p { margin: .3em 0; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: .86em; background: #f1f2f5;
       padding: 0 .22em; border-radius: 2px; hyphens: none; }
table { border-collapse: collapse; width: 100%; margin: .8em 0 1.1em; font-size: 8.9pt; line-height: 1.35;
        font-family: 'PT Sans', 'DejaVu Sans', sans-serif; }
thead { display: table-header-group; }
th { background: #14213d; color: #fff; font-weight: 700; text-align: left; }
th, td { padding: .35em .5em; vertical-align: top; border: .5pt solid #cfd4dd; }
tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #f7f8fa; }
ul, ol { margin: .2em 0 .7em; padding-left: 1.4em; }
li { margin: .15em 0; text-align: justify; }
a { color: inherit; text-decoration: none; }
a.ref { color: #1f4e9c; }
strong { font-weight: 700; }
hr { border: 0; border-top: .6pt solid #d0d4dc; margin: 1.2em 0; }
span.tocend { color: #fff; font-size: 1px; }
nav.toc { break-before: page; break-after: page; font-family: 'PT Sans', 'DejaVu Sans', sans-serif; }
nav.toc h2.toch { border: 0; font-size: 16pt; margin-top: 0; }
nav.toc ul { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 8mm; font-size: 8.8pt; line-height: 1.3; }
nav.toc li { margin: 0 0 .18em; text-align: left; break-inside: avoid; }
nav.toc li.t1 { font-weight: 700; margin-top: .6em; color: #14213d; }
nav.toc li.t3 { padding-left: 1.2em; color: #444; }
nav.toc li a { display: flex; align-items: flex-end; gap: .3em; }
nav.toc li a .tt { flex: 0 1 auto; }
nav.toc li a::after { content: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .'; flex: 1 1 0; order: 1; min-width: 1em; overflow: hidden; white-space: nowrap; color: #aab; font-size: .85em; }
nav.toc li a .pg { order: 2; flex: 0 0 auto; font-variant-numeric: tabular-nums; color: #555; }
"""
doc = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>%s</title><style>%s</style></head>'
       '<body>%s</body></html>') % (html.escape(toc[0][2]), css, body)
open(OUT, 'w', encoding='utf-8').write(doc)
print('headings', len(toc), 'sections', len(sec_ids), 'refs', body.count('class="ref"'))
