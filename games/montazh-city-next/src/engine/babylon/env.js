/* =====================================================================
   env.js — небо, солнце, тени, туман и постобработка.

   Небо — настоящая фотопанорама (Poly Haven, CC0), разложенная
   pack-textures.mjs: видимая часть в JPG, освещение (IBL) — из маленькой
   HDR. Солнце на панораме найдено при упаковке; здесь панорама
   доворачивается так, чтобы солнце стояло там, где ему положено в пять
   вечера (запад-юго-запад), и туда же смотрит DirectionalLight — тени и
   блики сходятся с картинкой неба.
   ===================================================================== */
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { hdrUrl } from './source.js';

Effect.ShadersStore.mcSkyVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 world, viewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = viewProjection * world * vec4(position, 1.0);
  gl_Position = p.xyww;            /* глубина = 1: небо за всем, порядок не важен */
  gl_Position.z *= 0.99999;
}`;
Effect.ShadersStore.mcSkyFragmentShader = `
precision highp float;
varying vec3 vDir;
uniform sampler2D skyTex;
uniform float skyScale, coverage, rotC, rotS;
uniform vec3 sunDir, sunColor, horizon;
const float PI = 3.14159265;
void main() {
  vec3 d = normalize(vDir);
  /* обратный поворот панорамы: мир → её собственные координаты */
  vec3 r = vec3(rotC * d.x - rotS * d.z, d.y, rotS * d.x + rotC * d.z);
  float theta = atan(r.z, r.x), phi = acos(clamp(r.y, -1.0, 1.0));
  float v = phi / PI / coverage;
  vec3 col;
  if (v < 0.995) {
    vec3 s = texture2D(skyTex, vec2(theta / (2.0 * PI) + 0.5, v)).rgb;
    col = pow(s, vec3(2.2)) * skyScale;
  } else col = horizon;
  /* ниже горизонта — ровная дымка, её всё равно закрывает земля */
  col = mix(col, horizon, smoothstep(-0.02, -0.12, d.y));
  float cd = max(dot(d, sunDir), 0.0);
  col += sunColor * (smoothstep(0.99997, 0.999993, cd) * 60.0 + pow(cd, 900.0) * 2.5 + pow(cd, 60.0) * 0.08);
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createEnvironment(scene, camera, base, envId, Q) {
  const meta = await (await fetch(base + 'env/env_' + envId + '.json')).json();
  /* куда хотим солнце: азимут запад-юго-запад (x — восток, z — юг) */
  const want = Math.atan2(0.38, -0.92);
  const have = Math.atan2(meta.sunDir[2], meta.sunDir[0]);
  const rot = have - want;                          /* поворот панорамы вокруг Y */
  const c = Math.cos(rot), s = Math.sin(rot);
  const sd = meta.sunDir;
  /* R_y(-rot) в шейдере переводит мир в панораму; здесь обратное — R_y(rot) */
  const sun = new Vector3(c * sd[0] + s * sd[2], sd[1], -s * sd[0] + c * sd[2]).normalize();

  /* --- освещение из панорамы --- */
  const ibl = new HDRCubeTexture(await hdrUrl(base + 'env/' + meta.ibl), scene, Q.iblSize || 256, false, true, false, true);
  ibl.rotationY = -rot;
  scene.environmentTexture = ibl;
  scene.environmentIntensity = Q.envIntensity ?? 1.0;

  /* --- видимое небо --- */
  const skyTex = new Texture(base + 'env/' + meta.sky, scene, { noMipmap: true, invertY: false, samplingMode: Texture.BILINEAR_SAMPLINGMODE });
  skyTex.wrapU = Texture.WRAP_ADDRESSMODE; skyTex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const skyMat = new ShaderMaterial('sky', scene, { vertex: 'mcSky', fragment: 'mcSky' }, {
    attributes: ['position'], uniforms: ['world', 'viewProjection', 'skyScale', 'coverage', 'rotC', 'rotS', 'sunDir', 'sunColor', 'horizon'], samplers: ['skyTex']
  });
  skyMat.setTexture('skyTex', skyTex);
  skyMat.setFloat('skyScale', (Q.skyIntensity ?? 1) / meta.skyExposure);
  skyMat.setFloat('coverage', meta.skyCoverage);
  skyMat.setFloat('rotC', c); skyMat.setFloat('rotS', s);
  skyMat.setVector3('sunDir', sun);
  skyMat.setColor3('sunColor', new Color3(1.0, 0.93, 0.82));
  const hz = meta.horizon.map(x => x * (Q.skyIntensity ?? 1));
  skyMat.setColor3('horizon', new Color3(...hz));
  skyMat.backFaceCulling = false;
  skyMat.disableDepthWrite = true;
  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 900, segments: 24, sideOrientation: 1 }, scene);
  dome.material = skyMat; dome.infiniteDistance = true; dome.isPickable = false;
  dome.applyFog = false;

  /* --- солнце и тени --- */
  const light = new DirectionalLight('sun', sun.scale(-1), scene);
  light.position = sun.scale(120);
  light.intensity = Q.sunIntensity ?? 3.2;
  light.diffuse = new Color3(1.0, 0.94, 0.84);
  light.shadowMinZ = 0; light.shadowMaxZ = 400;
  let shadows = null;
  if (Q.shadows !== false) {
    shadows = new CascadedShadowGenerator(Q.shadowSize || 2048, light);
    shadows.numCascades = Q.cascades || 4;
    shadows.lambda = 0.82;
    shadows.shadowMaxZ = Q.shadowDist || 110;
    shadows.stabilizeCascades = true;
    shadows.depthClamp = true;
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = Q.shadowFilter ?? 1;       /* 0 — высокое, 1 — среднее */
    shadows.bias = 0.0025; shadows.normalBias = 0.018;
    shadows.cascadeBlendPercentage = 0.08;
    shadows.darkness = 0;
    shadows.transparencyShadow = true;
    shadows.enableSoftTransparentShadow = true;
  }

  /* --- туман в цвет горизонта: даль тает в небе, а не обрывается --- */
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = Q.fog ?? 0.0036;
  scene.fogColor = new Color3(...hz.map(x => x * 0.92));
  scene.clearColor = new Color4(hz[0], hz[1], hz[2], 1);

  /* --- постобработка --- */
  let ssao = null;
  if (Q.ssao) {
    ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: Q.ssaoRatio || 0.5, blurRatio: 0.5 }, [camera], true);
    ssao.radius = 1.1; ssao.totalStrength = 1.05; ssao.base = 0.08;
    ssao.samples = Q.ssaoSamples || 16; ssao.maxZ = 90; ssao.minZAspect = 0.4;
    ssao.expensiveBlur = false; ssao.bilateralSamples = 8;
  }
  const pp = new DefaultRenderingPipeline('post', true, scene, [camera]);
  pp.samples = Q.msaa ?? 4;
  pp.fxaaEnabled = !!Q.fxaa;
  pp.imageProcessingEnabled = true;
  const ip = pp.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = Q.exposure ?? 1.0;
  ip.contrast = 1.08;
  ip.vignetteEnabled = true; ip.vignetteWeight = 1.4; ip.vignetteStretch = 0.45; ip.vignetteColor = new Color4(0, 0, 0, 0);
  pp.bloomEnabled = Q.bloom !== false;
  pp.bloomThreshold = 1.1; pp.bloomWeight = 0.18; pp.bloomKernel = 64; pp.bloomScale = 0.5;
  pp.sharpenEnabled = true; pp.sharpen.edgeAmount = 0.22; pp.sharpen.colorAmount = 1;
  pp.grainEnabled = true; pp.grain.intensity = 3.5; pp.grain.animated = true;

  return { meta, sun, light, shadows, ibl, dome, skyMat, pipeline: pp, ssao, rot };
}
