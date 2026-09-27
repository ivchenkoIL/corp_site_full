/* =====================================================================
   materials.js — библиотека PBR-материалов района.

   Поверхности берутся с Poly Haven (CC0) и упакованы tools/assets/
   pack-textures.mjs в public/assets/textures/<id>/{albedo,normal,arm}.webp.
   arm — это AO, шероховатость и металличность в каналах R, G, B, как в glTF.
   UV геометрии района — в метрах, поэтому масштаб текстуры задаётся здесь,
   размером одного повтора в метрах (tile).
   ===================================================================== */
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

/* Земля без «плитки»: вторая текстура (трава) подмешивается пятнами по
   шуму от мировых координат, а крупные пятна тона ломают повтор первой. */
class TerrainBlend extends MaterialPluginBase {
  constructor(material, tex2, scale2) {
    super(material, 'McTerrain', 210, { MC_TERRAIN: false });
    this.tex2 = tex2; this.scale2 = scale2;
    this._enable(true);
  }
  prepareDefines(d) { d.MC_TERRAIN = true; }
  getClassName() { return 'McTerrainBlend'; }
  getSamplers(s) { s.push('mcTex2'); }
  getUniforms() { return { ubo: [{ name: 'mcScale2', size: 1, type: 'float' }], fragment: '#ifdef MC_TERRAIN\nuniform float mcScale2;\n#endif' }; }
  bindForSubMesh(ubo) { ubo.updateFloat('mcScale2', this.scale2); ubo.setTexture('mcTex2', this.tex2); }
  getCustomCode(type) {
    if (type !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef MC_TERRAIN
uniform sampler2D mcTex2;
float mcH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mcN(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mcH(i), mcH(i + vec2(1, 0)), u.x), mix(mcH(i + vec2(0, 1)), mcH(i + vec2(1, 1)), u.x), u.y); }
float mcF(vec2 p) { return mcN(p) * 0.55 + mcN(p * 2.07) * 0.28 + mcN(p * 4.3) * 0.17; }
#endif`,
      CUSTOM_FRAGMENT_UPDATE_ALBEDO: `#ifdef MC_TERRAIN
  vec2 mcW = vPositionW.xz;
  float mcK = smoothstep(0.42, 0.66, mcF(mcW * 0.06));
  vec3 mcG = texture2D(mcTex2, mcW * mcScale2).rgb;
  mcG = pow(mcG, vec3(2.2));
  surfaceAlbedo = mix(surfaceAlbedo, mcG, mcK * 0.85);
  surfaceAlbedo *= 0.82 + 0.36 * mcF(mcW * 0.013 + 3.1);
#endif`
    };
  }
}

export class MaterialLib {
  constructor(scene, base, quality) {
    this.scene = scene; this.base = base; this.quality = quality || {};
    this.textures = new Map(); this.mats = new Map();
  }
  tex(rel, opts = {}) {
    const key = rel + (opts.invertY === false ? '|n' : '');
    let t = this.textures.get(key);
    if (!t) {
      t = new Texture(this.base + rel, this.scene, { noMipmap: false, invertY: opts.invertY !== false, samplingMode: Texture.TRILINEAR_SAMPLINGMODE });
      t.anisotropicFilteringLevel = this.quality.aniso || 8;
      this.textures.set(key, t);
    }
    return t;
  }
  /* копия с собственным масштабом: GPU-текстура общая, матрица своя */
  scaled(rel, tile, opts) {
    const t = this.tex(rel, opts).clone();
    t.uScale = t.vScale = 1 / tile;
    t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
    return t;
  }
  /* поверхность с Poly Haven: id, размер повтора в метрах, оттенок */
  surface(id, o = {}) {
    const key = 's:' + id + ':' + JSON.stringify(o);
    if (this.mats.has(key)) return this.mats.get(key);
    const tile = o.tile || 2;
    const m = new PBRMaterial(o.name || id, this.scene);
    m.albedoTexture = this.scaled('textures/' + id + '/albedo.webp', tile);
    if (o.normal !== false) {
      m.bumpTexture = this.scaled('textures/' + id + '/normal.webp', tile);
      m.bumpTexture.level = o.bump ?? 1;
    }
    m.metallicTexture = this.scaled('textures/' + id + '/arm.webp', tile);
    m.useAmbientOcclusionFromMetallicTextureRed = true;
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useMetallnessFromMetallicTextureBlue = true;
    m.metallic = o.metal ?? 1;
    m.roughness = o.rough ?? 1;
    if (o.tint) m.albedoColor = new Color3(...o.tint);
    m.ambientTextureStrength = 1;
    m.environmentIntensity = o.env ?? 1;
    if (o.cull === false) m.backFaceCulling = false;
    this.mats.set(key, m);
    return m;
  }
  /* земля двора: основная текстура + пятна второй */
  terrain(id, id2, o = {}) {
    const m = this.surface(id, o);
    const t2 = this.tex('textures/' + id2 + '/albedo.webp');
    t2.wrapU = t2.wrapV = Texture.WRAP_ADDRESSMODE;
    new TerrainBlend(m, t2, 1 / (o.tile2 || 2.5));
    return m;
  }
  /* однотонный материал: краска, резина, металл */
  color(name, rgb, rough = 0.7, metal = 0, o = {}) {
    const key = 'c:' + name + ':' + rgb.join(',') + ':' + rough + ':' + metal + ':' + JSON.stringify(o);
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new PBRMaterial(name, this.scene);
    m.albedoColor = new Color3(...rgb);
    m.metallic = metal; m.roughness = rough;
    if (o.emissive) { m.emissiveColor = new Color3(...o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; }
    if (o.cull === false) m.backFaceCulling = false;
    if (o.env != null) m.environmentIntensity = o.env;
    this.mats.set(key, m);
    return m;
  }
  /* стекло окна: отражает небо, внутрь почти не видно — как днём с улицы */
  glass(name = 'glass', tint = [0.05, 0.07, 0.08]) {
    const key = 'g:' + name + tint.join(',');
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new PBRMaterial(name, this.scene);
    m.albedoColor = new Color3(...tint);
    m.metallic = 0; m.roughness = 0.04;
    m.indexOfRefraction = 1.52;
    m.environmentIntensity = 1.25;
    m.useVertexColors = true;
    this.mats.set(key, m);
    return m;
  }
}
