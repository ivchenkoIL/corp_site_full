#!/usr/bin/env node
/* =====================================================================
   pack-textures.mjs — готовит материалы и небо для веба.

   Материалы: из assets-src/polyhaven/textures/<id>/ (diffuse, nor_gl, arm в
   JPG) в public/assets/textures/<id>/{albedo,normal,arm}.webp нужного
   размера. WebP заметно меньше JPG при том же качестве, Babylon его ест.

   Небо: HDR-панорама превращается в две вещи.
   • sky_<N>.jpg — видимое небо. Хранится линейным светом, умноженным на
     экспозицию и уложенным в sRGB: всё небо, кроме диска солнца, влезает в
     [0,1], а шейдер неба делит обратно и отдаёт сцене настоящий HDR — поэтому
     небо проходит через тот же тонмаппинг и то же свечение, что и мир.
   • env.json — где на панораме солнце (направление для DirectionalLight),
     экспозиция неба и средний цвет горизонта для тумана.
   Освещение (IBL) Babylon строит сам из маленькой .hdr, её просто копируем.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'assets-src', 'polyhaven');
const OUT = path.join(ROOT, 'public', 'assets');
const SOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets-src', 'sources.json'), 'utf8'));

/* сколько пикселей держать в вебе; по умолчанию 1024 */
const SIZE = { asphalt_02: 2048, concrete_pavers: 2048 };
const MAPS = [['diffuse.jpg', 'albedo.webp', 84], ['nor_gl.jpg', 'normal.webp', 90], ['arm.jpg', 'arm.webp', 86]];

let total = 0;
for (const id of Object.keys(SOURCES.polyhaven.textures)) {
  const dir = path.join(SRC, 'textures', id);
  if (!fs.existsSync(dir)) { console.warn('нет ' + id + ' — сначала npm run assets'); continue; }
  const out = path.join(OUT, 'textures', id);
  fs.mkdirSync(out, { recursive: true });
  const size = SIZE[id] || 1024;
  let sum = 0;
  for (const [src, dst, q] of MAPS) {
    const f = path.join(dir, src);
    if (!fs.existsSync(f)) continue;
    const s = dst === 'albedo.webp' ? size : Math.min(size, 1024);
    await sharp(f).resize(s, s, { kernel: 'lanczos3' }).webp({ quality: q, effort: 5 }).toFile(path.join(out, dst));
    sum += fs.statSync(path.join(out, dst)).size;
  }
  total += sum;
  console.log('материал ' + id.padEnd(26) + size + ' px  ' + (sum / 1048576).toFixed(2) + ' МБ');
}

/* --- HDR (Radiance RGBE, новый RLE) ------------------------------------ */
function readHDR(file) {
  const buf = fs.readFileSync(file);
  let pos = 0;
  const line = () => { let s = ''; while (buf[pos] !== 0x0a) s += String.fromCharCode(buf[pos++]); pos++; return s; };
  let l; do { l = line(); } while (l.length);
  const res = line().split(' ');
  const H = +res[1], W = +res[3];
  const data = new Float32Array(W * H * 3);
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (buf[pos] === 2 && buf[pos + 1] === 2 && !(buf[pos + 2] & 0x80)) {
      pos += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < W) {
          let n = buf[pos++];
          if (n > 128) { n -= 128; const v = buf[pos++]; for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = v; }
          else for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = buf[pos++];
        }
      }
    } else { for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) scan[x * 4 + c] = buf[pos++]; }
    for (let x = 0; x < W; x++) {
      const e = scan[x * 4 + 3], i = (y * W + x) * 3;
      if (!e) continue;
      const f = Math.pow(2, e - 136);
      data[i] = scan[x * 4] * f; data[i + 1] = scan[x * 4 + 1] * f; data[i + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { W, H, data };
}
const lin2srgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

for (const [id, resList] of Object.entries(SOURCES.polyhaven.hdris || {})) {
  const big = resList[resList.length - 1], small = resList[0];
  const hdr = readHDR(path.join(SRC, 'hdris', id + '_' + big + '.hdr'));
  const { W, H, data } = hdr;
  /* солнце: центр самого яркого пятна */
  let best = 0, bx = 0, by = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum > best) { best = lum; bx = x; by = y; }
  }
  let sx = 0, sy = 0, sw = 0;
  for (let y = Math.max(0, by - 40); y < Math.min(H, by + 40); y++) for (let x = bx - 40; x < bx + 40; x++) {
    const xx = (x + W) % W, i = (y * W + xx) * 3, lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum > best * 0.25) { sx += x * lum; sy += y * lum; sw += lum; }
  }
  const u = (sx / sw + 0.5) / W, v = (sy / sw + 0.5) / H;
  /* та же развёртка, что у Babylon: theta = atan2(z, x), phi = acos(y) */
  const theta = (u - 0.5) * 2 * Math.PI, phi = v * Math.PI;
  const sun = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
  /* экспозиция: 99.5-й перцентиль яркости неба без солнца → 0.92 */
  const lums = [];
  for (let i = 0; i < W * H * 3; i += 3 * 7) lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  lums.sort((a, b) => a - b);
  const p995 = lums[Math.floor(lums.length * 0.995)];
  const E = 0.92 / p995;
  /* цвет горизонта для тумана: полоса 2° над горизонтом */
  let hr = 0, hg = 0, hb = 0, hn = 0;
  for (let y = Math.floor(H * 0.47); y < Math.floor(H * 0.49); y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; hr += data[i]; hg += data[i + 1]; hb += data[i + 2]; hn++; }
  const horizon = [hr / hn, hg / hn, hb / hn];
  /* видимое небо: только верхняя полусфера и чуть ниже горизонта — землю
     рисует район, а нижняя половина панорамы пустая и тяжёлая */
  const outW = Math.min(W, 4096), outH = Math.round(outW / 2 * 0.56);
  const rgb = Buffer.alloc(outW * outH * 3);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    /* билинейно из исходника */
    const fx = (x + 0.5) / outW * W - 0.5, fy = (y + 0.5) / (outW / 2) * H - 0.5;
    const x0 = Math.floor(fx), y0 = Math.max(0, Math.floor(fy)), tx = fx - x0, ty = fy - y0;
    for (let c = 0; c < 3; c++) {
      const g = (xx, yy) => data[(Math.min(H - 1, yy) * W + ((xx % W) + W) % W) * 3 + c];
      const val = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      rgb[(y * outW + x) * 3 + c] = Math.round(255 * lin2srgb(Math.min(1, Math.max(0, val * E))));
    }
  }
  const envDir = path.join(OUT, 'env');
  fs.mkdirSync(envDir, { recursive: true });
  const skyFile = 'sky_' + id + '.jpg';
  await sharp(rgb, { raw: { width: outW, height: outH, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(envDir, skyFile));
  /* IBL: маленькая HDR без солнца. Солнце светит DirectionalLight'ом с
     тенями; если оставить его и в панораме, рассеянный свет посчитает его
     второй раз — и под машинами, и в тени дома станет светло, как днём. */
  {
    const src = readHDR(path.join(SRC, 'hdris', id + '_' + small + '.hdr'));
    const w = src.W / 2, h = src.H / 2, CLAMP = 12;
    const head = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ' + h + ' +X ' + w + '\n', 'ascii');
    const px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = ((y * 2 + dy) * src.W + x * 2 + dx) * 3; r += src.data[i] / 4; g += src.data[i + 1] / 4; b += src.data[i + 2] / 4; }
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > CLAMP) { const k = CLAMP / lum; r *= k; g *= k; b *= k; }
      const m = Math.max(r, g, b), o = (y * w + x) * 4;
      if (m < 1e-32) continue;
      const e = Math.ceil(Math.log2(m) + 1e-9), f = 256 / Math.pow(2, e);
      px[o] = Math.min(255, Math.floor(r * f)); px[o + 1] = Math.min(255, Math.floor(g * f)); px[o + 2] = Math.min(255, Math.floor(b * f)); px[o + 3] = e + 128;
    }
    fs.writeFileSync(path.join(envDir, 'ibl_' + id + '.hdr'), Buffer.concat([head, px]));
  }
  const meta = {
    id, source: 'https://polyhaven.com/a/' + id, license: 'CC0',
    sky: skyFile, skyCoverage: 0.56, skyExposure: +E.toFixed(5), ibl: 'ibl_' + id + '.hdr',
    sunUV: [+u.toFixed(5), +v.toFixed(5)], sunDir: sun.map(x => +x.toFixed(5)), sunElevationDeg: +(90 - phi * 180 / Math.PI).toFixed(2),
    horizon: horizon.map(x => +x.toFixed(4)), peak: +best.toFixed(1)
  };
  fs.writeFileSync(path.join(envDir, 'env_' + id + '.json'), JSON.stringify(meta, null, 1) + '\n');
  total += fs.statSync(path.join(envDir, skyFile)).size + fs.statSync(path.join(envDir, 'ibl_' + id + '.hdr')).size;
  console.log('небо     ' + id + ': солнце на высоте ' + meta.sunElevationDeg + '°, экспозиция ' + meta.skyExposure + ', ' + outW + '×' + outH);
}
console.log('Итого ' + (total / 1048576).toFixed(1) + ' МБ в public/assets');
