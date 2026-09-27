/* =====================================================================
   critters.js — дворовые собаки. Своей модели собаки пока нет (в
   манифесте она в плане: нужен четвероногий риг), поэтому пёс собран
   кодом, как в старой игре, но из тех же узлов, что и её скелет: корпус,
   шея с головой и челюстью, четыре ноги по два звена, хвост. Анимация —
   по полям старой логики: фаза рыси, лай, одышка, куда смотрит голова.
   ===================================================================== */
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Batch } from './geo.js';

const COATS = [[0.42, 0.3, 0.2], [0.2, 0.17, 0.15], [0.62, 0.5, 0.36], [0.36, 0.33, 0.3], [0.55, 0.38, 0.22], [0.16, 0.14, 0.13]];

export class Dog {
  constructor(scene, mats, i, shadows) {
    const coat = mats.color('dogCoat' + i, COATS[i % COATS.length], 0.88, 0);
    const dark = mats.color('dogNose', [0.03, 0.03, 0.03], 0.35, 0);
    const node = (name, parent, x = 0, y = 0, z = 0) => { const n = new TransformNode(name, scene); n.rotationQuaternion = null; if (parent) n.parent = parent; n.position.set(x, y, z); return n; };
    const part = (batch, mat, parent) => { const m = batch.build(scene, mat, { freeze: false }); m.parent = parent; if (shadows) shadows.addShadowCaster(m, false); return m; };
    this.root = node('dog' + i);
    this.body = node('dogBody', this.root, 0, 0.42, 0);
    const b = new Batch('dogTorso');
    b.tube([[0, 0.02, -0.28], [0, 0.04, -0.12], [0, 0.05, 0.08], [0, 0.07, 0.24]], [0.11, 0.13, 0.14, 0.12], 12);
    b.tube([[0, 0.06, 0.2], [0, 0.14, 0.3]], [0.085, 0.07], 10);          /* шея */
    part(b, coat, this.body);
    this.head = node('dogHead', this.body, 0, 0.14, 0.3);
    const h = new Batch('dogHeadMesh');
    h.tube([[0, 0.02, -0.05], [0, 0.03, 0.05], [0, 0.0, 0.16]], [0.075, 0.08, 0.04], 10);
    for (const s of [-1, 1]) h.tube([[s * 0.045, 0.08, 0.0], [s * 0.06, 0.15, -0.01]], [0.03, 0.006], 5);   /* уши */
    part(h, coat, this.head);
    const nose = new Batch('dogNoseMesh'); nose.box(0, 0.0, 0.165, 0.035, 0.03, 0.025, 0); part(nose, dark, this.head);
    this.jaw = node('dogJaw', this.head, 0, -0.02, 0.06);
    const j = new Batch('dogJawMesh'); j.tube([[0, 0, 0], [0, -0.01, 0.09]], [0.03, 0.018], 6); part(j, coat, this.jaw);
    this.legs = [];
    for (const [x, z, front] of [[0.07, 0.2, 1], [-0.07, 0.2, 1], [0.07, -0.24, 0], [-0.07, -0.24, 0]]) {
      const hip = node('dogHip', this.body, x, 0.0, z);
      const up = new Batch('dogLegUp'); up.tube([[0, 0, 0], [0, -0.2, front ? 0 : -0.03]], [0.035, 0.025], 6); part(up, coat, hip);
      const knee = node('dogKnee', hip, 0, -0.2, front ? 0 : -0.03);
      const lo = new Batch('dogLegLo'); lo.tube([[0, 0, 0], [0, -0.2, front ? 0.01 : 0.04], [0, -0.21, 0.06]], [0.022, 0.02, 0.022], 6); part(lo, coat, knee);
      this.legs.push({ hip, knee, front, diag: (x > 0) === !!front ? 0 : Math.PI });
    }
    this.tail = node('dogTail', this.body, 0, 0.05, -0.3);
    const t = new Batch('dogTailMesh'); t.tube([[0, 0, 0], [0, 0.08, -0.12], [0, 0.14, -0.2]], [0.025, 0.018, 0.008], 6); part(t, coat, this.tail);
  }
  update(d, y, t) {
    const v = Math.hypot(d.vx || 0, d.vz || 0), sp = Math.min(1, v / 5.2);
    const ph = (d.phase || 0) * 2, amp = 0.05 + sp * 0.66;
    const be = Math.sin(Math.PI * Math.min(1, Math.max(0, d.barkK || 0)));
    this.root.position.set(d.x, y, d.z);
    this.root.rotation.y = d.yaw || 0;
    this.body.position.y = 0.42 + Math.sin(ph * 2) * 0.03 * sp - be * 0.02;
    this.body.rotation.x = sp * 0.06 - Math.sin(ph * 2) * 0.04 * sp;
    this.head.rotation.x = 0.1 * sp + be * 0.45 - (d.hp || 0);
    this.head.rotation.y = d.hy || 0;
    this.jaw.rotation.x = be * 0.55 + (d.pant || 0) * (0.1 + Math.sin(t * 9) * 0.06);
    for (const L of this.legs) {
      const s = Math.sin(ph + L.diag);
      L.hip.rotation.x = -s * amp * 0.6;
      L.knee.rotation.x = (L.front ? -1 : 1) * Math.max(0, Math.cos(ph + L.diag)) * amp * 0.7 + (L.front ? 0 : 0.15);
    }
    this.tail.rotation.y = Math.sin(t * (6 + sp * 6)) * (0.5 - sp * 0.3);
  }
  setVisible(v) { this.root.setEnabled(v); }
}
