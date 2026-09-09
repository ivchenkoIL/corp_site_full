/* =====================================================================
   ext-probe.js — что умеет WebGL2 в этом браузере.

   Отдельный файл, потому что в Safari автоматику не подцепить: Playwright
   работает со сборкой WebKit, а не с настоящим Safari, и подсунуть скрипт до
   загрузки страницы там нечем. Зато это можно просто вставить в консоль —
   снимок ни от чего в игре не зависит, он про сам браузер.

   Как снять в Safari:
     1. Safari → Настройки → Дополнения → «Показывать меню Разработка».
     2. Открыть игру, Разработка → Показать веб-инспектор → Консоль.
     3. Вставить содержимое этого файла, Enter.
     4. Скопировать выведенный JSON в docs/RENDER-STATE.md.

   В Chrome ровно так же, либо автоматом: node tools/perf-probe.mjs.
   ===================================================================== */
(function () {
  const need = ['EXT_texture_filter_anisotropic', 'EXT_color_buffer_float',
                'EXT_disjoint_timer_query_webgl2', 'OES_texture_float_linear'];
  const nice = ['EXT_color_buffer_half_float', 'EXT_float_blend', 'WEBGL_debug_renderer_info',
                'KHR_parallel_shader_compile', 'WEBGL_multi_draw', 'OVR_multiview2',
                'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_s3tc',
                'EXT_texture_compression_bptc', 'WEBGL_provoking_vertex'];

  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { console.log(JSON.stringify({ webgl2: false, ua: navigator.userAgent }, null, 2)); return; }

  const all = gl.getSupportedExtensions() || [];
  const has = n => all.indexOf(n) >= 0;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const an = gl.getExtension('EXT_texture_filter_anisotropic');

  const out = {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio,
    screen: [screen.width, screen.height],
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    version: gl.getParameter(gl.VERSION),
    glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    /* четыре расширения, от которых зависит план следующих этапов */
    required: Object.fromEntries(need.map(n => [n, has(n)])),
    optional: Object.fromEntries(nice.map(n => [n, has(n)])),
    maxAnisotropy: an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : null,
    limits: {
      MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      MAX_SAMPLES: gl.getParameter(gl.MAX_SAMPLES),
      MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      MAX_VARYING_VECTORS: gl.getParameter(gl.MAX_VARYING_VECTORS),
      MAX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      MAX_UNIFORM_BLOCK_SIZE: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
      MAX_3D_TEXTURE_SIZE: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),
      MAX_ARRAY_TEXTURE_LAYERS: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
    },
    extensionCount: all.length,
    all: all.slice().sort()
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
})();
