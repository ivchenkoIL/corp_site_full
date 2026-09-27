import sharp from 'sharp';
import fs from 'node:fs';
const [,, out, dir, ...ids] = process.argv;
const T = 160, cols = 8;
const tiles = [];
for (const id of ids) {
  const f = `${dir}/${id}.png`;
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=${T}&height=${T}`);
    if (!r.ok) { console.log('miss', id); continue; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const img = await sharp(f).resize(T, T, { fit: 'cover' }).toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="18"><rect width="${T}" height="18" fill="#000a"/><text x="3" y="13" font-family="Helvetica" font-size="11" fill="#fff">${id}</text></svg>`);
  tiles.push(await sharp(img).composite([{ input: label, top: T - 18, left: 0 }]).toBuffer());
}
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * T, height: rows * T, channels: 3, background: '#333' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * T, top: Math.floor(i / cols) * T }))).png().toFile(out);
console.log('ok', tiles.length);
