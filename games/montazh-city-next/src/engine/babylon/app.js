/* =====================================================================
   app.js — отрисовка «Монтаж-Сити» на Babylon.js.

   Это бэкенд моста (src/engine/bridge.js): логика старой игры живёт как
   жила и меняет состояние S, а здесь по этому состоянию собирается кадр.
   Камера берётся прямо из S.cam — та же камера за спиной, с той же
   логикой уклонения от стен, что и в старой игре. Жители, машины и
   велосипед берутся из снимка сущностей (bridge.collectEntities).
   ===================================================================== */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import '@babylonjs/core/Helpers/sceneHelpers';
import { createEnvironment } from './env.js';
import { MaterialLib } from './materials.js';
import { buildGround } from './ground.js';
import { buildBuildings } from './buildings.js';
import { PropLib, buildPoles, buildYard, buildFence, scatterWeeds } from './props.js';
import { buildTrees } from './vegetation.js';
import { buildDistance } from './distance.js';
import { buildDressing } from './dressing.js';
import { Dog } from './critters.js';
import { CharacterModel, Actor } from './actors.js';
import { CarModel, Car, buildBike, bikePoints, updateBike } from './vehicles.js';
import { collectEntities } from '../bridge.js';
import { MANIFEST } from '../../assets/manifest.js';

export const QUALITY = {
  high:   { dprMax: 1.5, msaa: 4, shadowSize: 2048, cascades: 3, shadowDist: 90, ssao: true, ssaoSamples: 8, bloom: true, iblSize: 256, aniso: 8, actorDist: 75, weeds: 1 },
  medium: { dprMax: 1.25, msaa: 4, shadowSize: 2048, cascades: 2, shadowDist: 70, ssao: false, bloom: true, iblSize: 128, aniso: 4, actorDist: 60, weeds: 0.7 },
  low:    { dprMax: 1, msaa: 0, fxaa: true, shadowSize: 1024, cascades: 2, shadowDist: 60, ssao: false, bloom: false, iblSize: 64, aniso: 2, actorDist: 45, weeds: 0.4 }
};

/* массовка на одно лицо: хоть одежду чуть разведём по тону */
const PED_TINTS = [[1, 1, 1], [0.92, 0.95, 1.08], [1.08, 1.0, 0.9], [0.9, 0.9, 0.9], [1.05, 0.94, 0.94], [0.95, 1.05, 0.95]];
const pedIds = new WeakMap(); let pedNext = 0;
const pedIndex = k => { if (!pedIds.has(k)) pedIds.set(k, pedNext++); return pedIds.get(k); };

export class BabylonBackend {
  constructor() { this.actors = new Map(); this.cars = new Map(); this.pool = {}; this.carPool = []; this.stats = {}; }

  async init({ canvas, legacy, base, quality = 'high', progress = () => {} }) {
    const Q = this.Q = { ...QUALITY[quality] || QUALITY.high, sunIntensity: 3.1, envIntensity: 1.5, skyIntensity: 1.0, exposure: 1.0, fog: 0.0032 };
    this.L = legacy; this.base = base;
    const engine = this.engine = new Engine(canvas, false, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false, alpha: false }, false);
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, Q.dprMax));
    const scene = this.scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.skipPointerMovePicking = true;
    scene.constantlyUpdateMeshUnderPointer = false;
    const cam = this.camera = new TargetCamera('cam', new Vector3(12, 3, 58), scene);
    cam.fov = 62 * Math.PI / 180; cam.minZ = 0.12; cam.maxZ = 1500;
    cam.setTarget(new Vector3(12, 1.4, 51));

    progress('небо и свет', 0.05);
    const env = this.env = await createEnvironment(scene, cam, base, MANIFEST.env.id, Q);
    const mats = this.mats = new MaterialLib(scene, base, Q);
    const { W, ROADS_X, ROADS_Z, ROAD_W, SIDE_W, BUILDINGS, POLES, PROPS, surfY } = legacy.world;
    this.surfY = surfY;

    progress('земля и дороги', 0.12);
    buildGround(scene, mats, W, ROADS_X, ROADS_Z, ROAD_W, SIDE_W, BUILDINGS, env.shadows);
    progress('дома', 0.2);
    const bld = buildBuildings(scene, mats, BUILDINGS, env);

    progress('реквизит', 0.32);
    const lib = this.props = new PropLib(scene, base, env.shadows);
    await lib.init();
    await buildPoles(scene, lib, mats, POLES, surfY, env.shadows);
    await buildYard(scene, lib, bld.anchors, surfY);
    await buildFence(lib, 0.9, 34.2, 56.0, surfY);
    await buildDressing(scene, mats, lib, PROPS, surfY, env.shadows);
    progress('деревья', 0.5);
    const trees = buildTrees(scene, PROPS.filter(p => p.kind === 'tree'), surfY, env.shadows);
    buildDistance(scene, mats, W, ROADS_X, ROADS_Z, trees, env.shadows);
    const free = (x, z) => legacy.isYardFree(x, z);
    await scatterWeeds(lib, surfY, free, 4242, [0.6, 33, 19, 62], Math.round(150 * Q.weeds));
    await scatterWeeds(lib, surfY, free, 777, [-30, -30, 230, 180], Math.round(420 * Q.weeds));

    progress('люди', 0.62);
    this.models = {};
    const loads = Object.entries(MANIFEST.characters).map(async ([id, a]) => {
      this.models[id] = await CharacterModel.load(scene, base + a.file, base + a.meta);
    });
    await Promise.all(loads);
    progress('машины', 0.82);
    const car = MANIFEST.vehicles.sedan;
    this.carModel = await CarModel.load(scene, base + car.file, base + car.meta, base + car.paint);
    this.bike = buildBike(scene, mats, env.shadows);

    progress('шейдеры', 0.9);
    await scene.whenReadyAsync();
    progress('готово', 1);
    this.resize();
  }

  resize() {
    this.engine.resize();
    const G = this.L.GL;
    const c = this.engine.getRenderingCanvas();
    G.w = c.clientWidth || innerWidth; G.h = c.clientHeight || innerHeight;
    G.uiDpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  /* кадр: камера из S.cam, сущности из снимка, отрисовка, матрицы для 2D-слоя */
  render(dt) {
    const S = this.L.S, cam = this.camera;
    const dc = this.debugCam;             /* для снимков и сравнения: камера с заданной точки */
    if (dc) { cam.position.set(dc[0], dc[1], dc[2]); cam.setTarget(new Vector3(dc[3], dc[4], dc[5])); }
    else { cam.position.set(S.cam.x, S.cam.y, S.cam.z); cam.setTarget(new Vector3(S.cam.tx, S.cam.ty, S.cam.tz)); }
    this.syncEntities(dt, S);
    if (this.autoRes !== false) this.adapt(dt);
    this.scene.render();
    /* 2D-слой старой игры (реплики, метки) проецирует точки сам: даём ему наши матрицы */
    const R3 = this.L.R3;
    if (R3) {
      R3.view = R3.view || new Float32Array(16); R3.proj = R3.proj || new Float32Array(16);
      R3.view.set(cam.getViewMatrix().m); R3.proj.set(cam.getProjectionMatrix().m);
    }
  }

  actor(model, key, opts) {
    let a = this.actors.get(key);
    if (a && a.modelId !== model) { this.release(key); a = null; }
    if (!a) {
      const pool = this.pool[model] || (this.pool[model] = []);
      a = pool.pop() || Object.assign(new Actor(this.scene, this.models[model], opts), { modelId: model });
      a.castShadows(this.env.shadows);
      a.setVisible(true);
      this.actors.set(key, a);
    }
    a.seen = this.frameNo;
    return a;
  }
  release(key) {
    const a = this.actors.get(key); if (!a) return;
    a.setVisible(false); (this.pool[a.modelId] ||= []).push(a); this.actors.delete(key);
  }

  syncEntities(dt, S) {
    this.frameNo = (this.frameNo || 0) + 1;
    const ents = collectEntities(S, this.L);
    const cx = S.cam.x, cz = S.cam.z, far = this.Q.actorDist;
    let shown = 0;
    for (const e of ents.people) {
      if (!this.models[e.model]) e.model = 'oleg';
      const d = Math.hypot(e.x - cx, e.z - cz);
      if (d > far && !e.hero) continue;
      const a = this.actor(e.model, e.key, e.hero || !/ped_man|hool/.test(e.model) ? undefined : { tint: PED_TINTS[pedIndex(e.key) % PED_TINTS.length] });
      let bike = null;
      if (e.onBike) {
        bike = bikePoints(S.bike, this.bike.crankAngle || 0, S.bike.steer || 0);
      }
      a.update(dt, { x: e.x, y: this.surfY(e.x, e.z), z: e.z, yaw: e.yaw, speed: e.speed, act: e.act, talk: e.talk, talkNo: e.talkNo, drunk: e.drunk, bike, lookYaw: e.lookYaw });
      shown++;
    }
    for (const [k, a] of this.actors) if (a.seen !== this.frameNo) this.release(k);
    /* машины */
    const seenCars = new Set();
    for (const c of ents.cars) {
      const d = Math.hypot(c.x - cx, c.z - cz);
      if (d > far * 1.6) continue;
      let car = this.cars.get(c.key);
      if (!car) { car = this.carPool.pop() || null; if (car) { car.retint?.(); } }
      if (!car || car.tintKey !== c.tint.join(',')) {
        if (car) car.root.dispose(false, true);
        car = new Car(this.scene, this.carModel, c.tint, this.env.shadows); car.tintKey = c.tint.join(',');
      }
      car.setVisible(true);
      car.update(c.src, this.surfY(c.x, c.z));
      this.cars.set(c.key, car); seenCars.add(c.key);
    }
    for (const [k, car] of this.cars) if (!seenCars.has(k)) { car.setVisible(false); this.carPool.push(car); this.cars.delete(k); }
    /* собаки */
    this.dogs = this.dogs || new Map();
    S.dogs.forEach((d, i) => {
      let dog = this.dogs.get(d);
      const near = Math.hypot(d.x - cx, d.z - cz) < far;
      if (!dog && near) { dog = new Dog(this.scene, this.mats, i, this.env.shadows); this.dogs.set(d, dog); }
      if (!dog) return;
      dog.setVisible(near);
      if (near) dog.update(d, this.surfY(d.x, d.z), S.t);
    });
    /* камеры, поставленные Олегом на опоры: их видно, пока смена идёт */
    this.poleCams = this.poleCams || new Map();
    for (const pole of this.L.world.POLES) {
      if (!pole.installed || this.poleCams.has(pole)) continue;
      this.poleCams.set(pole, true);
      const H = pole.lamp ? 8.2 : 6.6;
      this.props.place('security_camera_01', { x: pole.x - 0.16, y: this.surfY(pole.x, pole.z) + H - 1.5, z: pole.z, yaw: (pole.camYaw || 0) + Math.PI, keepY: true })
        .then(n => this.poleCams.set(pole, n));
    }
    for (const [pole, n] of this.poleCams) if (!pole.installed && n && n !== true) { n.dispose(); this.poleCams.delete(pole); }
    /* велосипед */
    const riding = !!S.player?.onBike;
    if (S.bike) updateBike(this.bike, S.bike, this.surfY(S.bike.x, S.bike.z), riding, dt);
    this.stats.people = shown; this.stats.cars = seenCars.size;
  }

  /* Разрешение под кадр: если не успеваем в 60 к/с, рендер тихо становится
     мельче (не ниже 0.7 от экрана), когда запас есть — возвращается. Как
     авто-масштаб старой игры, только решает Babylon'овский масштаб буфера. */
  adapt(dt) {
    const e = this.engine;
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc < 1.2) return;
    const fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
    const maxDpr = Math.min(window.devicePixelRatio || 1, this.Q.dprMax);
    this.dpr = this.dpr || maxDpr;
    if (fps < 50 && this.dpr > 0.7) this.dpr = Math.max(0.7, this.dpr * 0.88);
    else if (fps > 58.5 && this.dpr < maxDpr) this.dpr = Math.min(maxDpr, this.dpr * 1.06);
    else return;
    e.setHardwareScalingLevel(1 / this.dpr);
  }
  runLoop(fn) { this.engine.runRenderLoop(fn); }
  fps() { return this.engine.getFps(); }
}
