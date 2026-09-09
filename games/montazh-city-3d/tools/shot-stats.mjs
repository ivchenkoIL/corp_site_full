#!/usr/bin/env node
/* =====================================================================
   shot-stats.mjs — яркость и контраст скриншотов, монтаж «до | после».

     node tools/shot-stats.mjs a.png b.png            # статистика по двум кадрам
     node tools/shot-stats.mjs a.png b.png --out=cmp.png   # плюс монтаж рядом

   Без зависимостей: PNG читается и пишется своими силами (zlib из node).
   Для каждого кадра — средняя яркость (Rec.709, в sRGB-байтах), разброс,
   доли тёмных и светлых пикселей, и то же по трём горизонтальным полосам
   (небо / середина / низ). HUD в расчёт не идёт: отсекаются рамки по краям.
   ===================================================================== */
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readPNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('не PNG: ' + file);
  let p = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12]) throw new Error('interlaced PNG не поддерживается'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('только 8 бит на канал');
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], off = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const x = raw[off + i], a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (ch >= 3) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = ch === 4 ? cur[i + 3] : 255; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = ch === 2 ? cur[i + 1] : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, data: out };
}
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
export function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}
/* уменьшение в k раз усреднением — для монтажа */
export function downscale(img, k) {
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const o = ((y * k + dy) * img.w + x * k + dx) * 4; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; }
    const o = (y * w + x) * 4, n = k * k; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return { w, h, data: out };
}
export function stats(img, inset) {
  inset = inset || { l: 0.18, r: 0.18, t: 0.08, b: 0.16 };      /* HUD по краям не считаем */
  const x0 = Math.floor(img.w * inset.l), x1 = Math.floor(img.w * (1 - inset.r));
  const y0 = Math.floor(img.h * inset.t), y1 = Math.floor(img.h * (1 - inset.b));
  const band = (ya, yb) => {
    let n = 0, s = 0, s2 = 0, dark = 0, bright = 0, sr = 0, sg = 0, sb = 0;
    for (let y = ya; y < yb; y++) for (let x = x0; x < x1; x++) {
      const o = (y * img.w + x) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++; s += l; s2 += l * l; sr += r; sg += g; sb += b;
      if (l < 40) dark++; if (l > 215) bright++;
    }
    const m = s / n;
    return { mean: +m.toFixed(1), std: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1), dark: +(dark / n * 100).toFixed(1), bright: +(bright / n * 100).toFixed(1), rgb: [sr / n, sg / n, sb / n].map(v => +v.toFixed(1)) };
  };
  const third = (y1 - y0) / 3;
  return { all: band(y0, y1), top: band(y0, Math.floor(y0 + third)), mid: band(Math.floor(y0 + third), Math.floor(y0 + 2 * third)), bottom: band(Math.floor(y0 + 2 * third), y1) };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1].endsWith('shot-stats.mjs')) {
  const args = process.argv.slice(2), files = args.filter(a => !a.startsWith('--'));
  const outArg = args.find(a => a.startsWith('--out='));
  const scale = +((args.find(a => a.startsWith('--scale=')) || '--scale=2').slice(8));
  if (!files.length) { console.error('нужен хотя бы один PNG'); process.exit(2); }
  const imgs = files.map(readPNG);
  const rows = [];
  imgs.forEach((im, i) => {
    const st = stats(im);
    rows.push({ file: files[i], size: im.w + '×' + im.h, ...Object.fromEntries(Object.entries(st).map(([k, v]) => [k, `${v.mean} ±${v.std} (тёмных ${v.dark}%, светлых ${v.bright}%)`])) });
  });
  console.table(rows);
  if (imgs.length === 2) {
    const a = stats(imgs[0]), b = stats(imgs[1]);
    for (const k of ['all', 'top', 'mid', 'bottom'])
      console.log(`${k.padEnd(7)} яркость ${a[k].mean} → ${b[k].mean} (${(b[k].mean / a[k].mean * 100 - 100).toFixed(1)} %), разброс ${a[k].std} → ${b[k].std}, rgb ${a[k].rgb.join('/')} → ${b[k].rgb.join('/')}`);
  }
  if (outArg && imgs.length >= 2) {
    const small = imgs.map(im => downscale(im, scale));
    const w = small.reduce((s, im) => s + im.w, 0) + (small.length - 1) * 8, h = Math.max(...small.map(im => im.h));
    const out = new Uint8Array(w * h * 4).fill(20);
    let ox = 0;
    for (const im of small) {
      for (let y = 0; y < im.h; y++) out.set(im.data.subarray(y * im.w * 4, (y + 1) * im.w * 4), (y * w + ox) * 4);
      ox += im.w + 8;
    }
    writePNG(outArg.slice(6), w, h, out);
    console.log('→ ' + outArg.slice(6));
  }
}
