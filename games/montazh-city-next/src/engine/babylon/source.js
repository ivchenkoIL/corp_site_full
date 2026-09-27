/* =====================================================================
   source.js — откуда брать бинарные ассеты.

   Обычная сборка отдаёт GLB и HDR как есть. Артефакт Claude таких типов
   файлов не раздаёт, поэтому для него tools/pack-artifact.mjs кладёт рядом
   текстовые копии (base64, *.glb.txt) и ставит на странице метку
   <meta name="mc-packed" content="1"> (метка, а не скрипт: встроенные
   скрипты строгая CSP может и запретить). Тогда модели читаются из текста
   и отдаются загрузчику Babylon прямо байтами.
   ===================================================================== */
const packed = () => typeof document !== 'undefined' && !!document.querySelector('meta[name="mc-packed"]');

function b64bytes(text) {
  const bin = atob(text.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* источник для LoadAssetContainerAsync: адрес или байты GLB */
export async function glbSource(url) {
  if (!packed()) return url;
  const r = await fetch(url + '.txt');
  if (!r.ok) throw new Error('Нет ' + url + '.txt');
  return b64bytes(await r.text());
}

/* адрес HDR для HDRCubeTexture: обычный или data: (Babylon разбирает его сам) */
export async function hdrUrl(url) {
  if (!packed()) return url;
  const r = await fetch(url + '.txt');
  if (!r.ok) throw new Error('Нет ' + url + '.txt');
  return 'data:application/octet-stream;base64,' + (await r.text()).trim();
}
