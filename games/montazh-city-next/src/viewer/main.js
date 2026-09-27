/* Просмотр персонажей и моделей: проверка скелета, весов и анимаций.
   Параметры адреса: ?model=oleg&anim=walk&t=0.3&cam=front|side|q&bones=1
   Для скриптов: window.__viewer.ready (Promise), .pose(anim, t), .cam(name). */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.13, 0.14, 0.16, 1);
const cam = new ArcRotateCamera('cam', Math.PI / 2, 1.35, 3.6, new Vector3(0, 0.95, 0), scene);
cam.attachControl(canvas, true);
cam.wheelPrecision = 60; cam.minZ = 0.05;
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.55; hemi.groundColor = new Color3(0.25, 0.23, 0.22);
const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.7), scene);
sun.position = new Vector3(3, 6, 4); sun.intensity = 2.2;
const sg = new ShadowGenerator(2048, sun); sg.usePercentageCloserFiltering = true; sg.bias = 0.0005;
const ground = MeshBuilder.CreateGround('g', { width: 8, height: 8 }, scene);
const gm = new PBRMaterial('gm', scene); gm.albedoColor = new Color3(0.42, 0.42, 0.44); gm.metallic = 0; gm.roughness = 0.95;
ground.material = gm; ground.receiveShadows = true;

const MODELS = ['oleg', 'vanya', 'kostya', 'sanya'];
const selModel = document.getElementById('model'), selAnim = document.getElementById('anim'), info = document.getElementById('info');
let current = null, viewer = null;

async function load(name) {
  if (current) { current.dispose(); current = null; }
  if (viewer) { viewer.dispose(); viewer = null; }
  const c = await LoadAssetContainerAsync('./assets/characters/' + name + '.glb', scene);
  c.addAllToScene();
  current = c;
  for (const m of c.meshes) { if (m.getTotalVertices() > 0) { sg.addShadowCaster(m); m.receiveShadows = true; } }
  for (const g of c.animationGroups) g.stop();
  selAnim.innerHTML = c.animationGroups.map(g => '<option>' + g.name + '</option>').join('');
  const tris = c.meshes.reduce((a, m) => a + (m.getTotalIndices ? m.getTotalIndices() / 3 : 0), 0);
  info.textContent = Math.round(tris / 1000) + 'k треуг., ' + c.skeletons.map(s => s.bones.length + ' костей').join(', ');
  return c;
}
function play(anim, t) {
  if (!current) return;
  for (const g of current.animationGroups) g.stop();
  const g = current.animationGroups.find(a => a.name === anim) || current.animationGroups[0];
  if (!g) return;
  selAnim.value = g.name;
  g.start(true, 1);
  if (t != null) { g.goToFrame(g.from + (g.to - g.from) * t); g.pause(); }
}
function setCam(name) {
  const views = { front: [Math.PI / 2, 1.4, 3.4], side: [0, 1.4, 3.4], back: [-Math.PI / 2, 1.4, 3.4], q: [Math.PI / 2 - 0.7, 1.25, 3.2], top: [Math.PI / 2, 0.5, 3.6] };
  const v = views[name] || views.q;
  cam.alpha = v[0]; cam.beta = v[1]; cam.radius = v[2];
}
function bones(on) {
  if (viewer) { viewer.dispose(); viewer = null; }
  if (on && current && current.skeletons[0]) {
    const mesh = current.meshes.find(m => m.skeleton);
    viewer = new SkeletonViewer(current.skeletons[0], mesh, scene, false, 3, { displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS });
  }
}
selModel.innerHTML = MODELS.map(m => '<option>' + m + '</option>').join('');
selModel.onchange = async () => { await load(selModel.value); play(selAnim.value); };
selAnim.onchange = () => play(selAnim.value);
let bonesOn = q.get('bones') === '1';
document.getElementById('bones').onclick = () => { bonesOn = !bonesOn; bones(bonesOn); };

const ready = (async () => {
  const name = q.get('model') || 'oleg';
  selModel.value = name;
  await load(name);
  setCam(q.get('cam') || 'q');
  play(q.get('anim') || 'idle', q.has('t') ? +q.get('t') : null);
  bones(bonesOn);
  await scene.whenReadyAsync();
  return true;
})();
window.__viewer = { ready, pose: (a, t) => play(a, t), cam: setCam, scene };
engine.runRenderLoop(() => scene.render());
addEventListener('resize', () => engine.resize());
