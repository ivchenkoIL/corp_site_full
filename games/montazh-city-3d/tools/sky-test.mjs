#!/usr/bin/env node
/* =====================================================================
   sky-test.mjs — сверка двух реализаций модели неба.

   Формула однократного рассеяния Рэлея и Ми написана один раз, но живёт в
   двух исполнениях: GLSL (шейдер кубмапы) и JS (SkyJS — по нему считаются
   сферические гармоники, потому что читать нарисованную кубмапу обратно
   нельзя). Тест берёт сетку направлений, считает обе версии и сравнивает.

     node tools/sky-test.mjs                 # часы 8, 12, 17, 22
     node tools/sky-test.mjs --hours=6,12    # свои часы
     node tools/sky-test.mjs --tol=0.02      # допуск по относительной ошибке

   GLSL считается настоящим шейдером: собирается программа из GLSL_SKY,
   рисуется в RGBA32F-текстуру по одному текселю на направление и читается
   обратно. Это единственное место, где readPixels уместен, — тест, а не кадр.
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

let playwright;
try { playwright = loadPlaywright().pw; } catch (e) { console.error(e.message); process.exit(2); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const HOURS = (argv.hours || '8,12,17,22').split(',').map(Number);
const TOL = +(argv.tol || 0.02);
const GRID = +(argv.grid || 8);

const browser = await playwright.chromium.launch({ headless: true, args: ['--use-angle=default', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e && e.message || e)));
await page.goto(pathToFileURL(GAME).href + '?mc3d-test', { waitUntil: 'load' });
/* Ждём именно крючок, а не кнопку «продолжить»: сохранения тест не кладёт,
   и в меню её нет. */
await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });

const res = await page.evaluate(async ({ hours, grid }) => {
  const M = window.__MC3D, gl = M.GL.gl;
  /* направления: равномерная сетка по граням куба, как в computeSH */
  const F = [
    { o: [1,0,0], u: [0,0,-1], v: [0,-1,0] }, { o: [-1,0,0], u: [0,0,1], v: [0,-1,0] },
    { o: [0,1,0], u: [1,0,0], v: [0,0,1] },   { o: [0,-1,0], u: [1,0,0], v: [0,0,-1] },
    { o: [0,0,1], u: [1,0,0], v: [0,-1,0] },  { o: [0,0,-1], u: [-1,0,0], v: [0,-1,0] }
  ];
  const dirs = [];
  for (const f of F) for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
    const a = (x + 0.5) / grid * 2 - 1, b = (y + 0.5) / grid * 2 - 1;
    const d = [f.o[0] + f.u[0]*a + f.v[0]*b, f.o[1] + f.u[1]*a + f.v[1]*b, f.o[2] + f.u[2]*a + f.v[2]*b];
    const l = Math.hypot(d[0], d[1], d[2]);
    dirs.push([d[0]/l, d[1]/l, d[2]/l]);
  }
  const N = dirs.length;

  /* программа: тексель = направление из юниформа-массива нельзя (их много),
     поэтому направление приходит атрибутом, а рисуем точками */
  const vs = `#version 300 es
  layout(location=0) in vec3 aDir;
  layout(location=1) in float aIdx;
  out vec3 vD;
  uniform float uN;
  void main(){ vD = aDir; gl_PointSize = 1.0;
    gl_Position = vec4(((aIdx + 0.5) / uN) * 2.0 - 1.0, 0.0, 0.0, 1.0); }`;
  const fs = `#version 300 es
  precision highp float;
  in vec3 vD;
  uniform vec3 uSun; uniform float uNight;
  out vec4 o;
  ${M.GLSL_SKY}
  void main(){ o = vec4(skyColor(normalize(vD), uSun, uNight), 1.0); }`;
  function sh(t, src){ const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));

  gl.getExtension('EXT_color_buffer_float');
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, N, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('нет RGBA32F-мишени');

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const bd = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bd);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dirs.flat()), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const bi = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bi);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dirs.map((_, i) => i)), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);

  const out = [];
  const px = new Float32Array(N * 4), c = [0, 0, 0];
  for (const h of hours) {
    M.Env.update(h);
    const sun = M.Env.sun.slice(), night = M.Env.night;
    gl.useProgram(pr);
    gl.viewport(0, 0, N, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(gl.getUniformLocation(pr, 'uN'), N);
    gl.uniform3fv(gl.getUniformLocation(pr, 'uSun'), sun);
    gl.uniform1f(gl.getUniformLocation(pr, 'uNight'), night);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.readPixels(0, 0, N, 1, gl.RGBA, gl.FLOAT, px);

    let maxRel = 0, maxAbs = 0, sumRel = 0, worst = null, refMax = 0;
    for (let i = 0; i < N; i++) {
      M.SkyJS.color(c, dirs[i], sun, night);
      for (let k = 0; k < 3; k++) {
        const a = px[i * 4 + k], b = c[k];
        refMax = Math.max(refMax, b);
        const abs = Math.abs(a - b);
        const rel = abs / Math.max(Math.abs(b), 1e-4);
        sumRel += rel;
        if (abs > maxAbs) maxAbs = abs;
        if (rel > maxRel && abs > 1e-5) { maxRel = rel; worst = { dir: dirs[i].map(v => +v.toFixed(3)), k, glsl: a, js: b }; }
      }
    }
    /* заодно опорные значения модели: зенит, горизонт и в сторону солнца */
    const probe = {};
    for (const [name, d] of [['зенит', [0, 1, 0]], ['горизонт', [1, 0.02, 0]],
                             ['на солнце', sun.slice()], ['от солнца', [-sun[0], Math.max(sun[1], 0.02), -sun[2]]]]) {
      const l = Math.hypot(d[0], d[1], d[2]);
      M.SkyJS.color(c, [d[0]/l, d[1]/l, d[2]/l], sun, night);
      probe[name] = c.map(v => +v.toFixed(4));
    }
    out.push({ hour: h, altDeg: +(M.Env.alt * 180 / Math.PI).toFixed(2), night: +night.toFixed(3),
               sunIrr: M.Env.sunIrr.map(v => +v.toFixed(3)), exposure: +M.Env.exposure.toFixed(3),
               n: N, maxRel: +maxRel.toFixed(5), maxAbs: +maxAbs.toFixed(6),
               meanRel: +(sumRel / (N * 3)).toFixed(5), refMax: +refMax.toFixed(4), worst, probe });
  }
  return out;
}, { hours: HOURS, grid: GRID });

await browser.close();

let bad = 0;
for (const r of res) {
  const ok = r.maxRel <= TOL;
  if (!ok) bad++;
  console.log(`\nчас ${r.hour}  высота солнца ${r.altDeg}°  ночь ${r.night}  экспозиция ${r.exposure}`);
  console.log(`  освещённость солнца ${r.sunIrr.join(' / ')}`);
  console.log(`  небо: зенит ${r.probe['зенит'].join(' / ')}   горизонт ${r.probe['горизонт'].join(' / ')}`);
  console.log(`        на солнце ${r.probe['на солнце'].join(' / ')}   от солнца ${r.probe['от солнца'].join(' / ')}`);
  console.log(`  сверка GLSL и JS по ${r.n} направлениям: макс. отн. ${(r.maxRel * 100).toFixed(3)} %, ` +
              `средняя ${(r.meanRel * 100).toFixed(3)} %, макс. абс. ${r.maxAbs}  ${ok ? '✓' : '✗ РАСХОЖДЕНИЕ'}`);
  if (!ok && r.worst) console.log(`  худшее: направление ${r.worst.dir.join(', ')} канал ${r.worst.k}: GLSL ${r.worst.glsl} против JS ${r.worst.js}`);
}
if (errors.length) { console.log('\nошибки страницы:'); for (const e of errors) console.log('  ' + e); }
console.log(bad ? `\n${bad} из ${res.length} часов расходятся сверх допуска ${TOL}` : `\nвсе ${res.length} часов сходятся в пределах ${(TOL*100).toFixed(1)} %`);
process.exit(bad ? 1 : 0);
