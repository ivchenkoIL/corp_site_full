const ids = process.argv.slice(2);
let total = 0;
for (const id of ids) {
  const r = await fetch('https://api.polyhaven.com/files/' + id);
  const j = await r.json();
  const g = j.gltf && (j.gltf['1k'] || j.gltf['2k']);
  if (!g) { console.log(id, 'нет gltf'); continue; }
  const res = j.gltf['1k'] ? '1k' : '2k';
  let sz = g.gltf.size;
  for (const [f, v] of Object.entries(g.gltf.include || {})) sz += v.size;
  total += sz;
  console.log(id.padEnd(30), res, (sz / 1048576).toFixed(2) + ' MB', Object.keys(g.gltf.include || {}).length + ' files');
}
console.log('TOTAL', (total / 1048576).toFixed(1) + ' MB');
