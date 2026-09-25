import * as THREE from 'three';
import type { NpcLook } from '../core/types';
import { M, Materials } from './materials';
import { FONT_STENCIL, makeCanvas } from './textures';
import { cylGeo, rboxGeo, sphereGeo, boxGeo } from './models/kit';

/**
 * Stylised low-poly people for rival bidders and the auctioneer.
 * Idle breathing, head tracking, paddle raises, walking and dropping out.
 */

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function paddleTexture(n: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3261e';
  ctx.font = `900 70px ${FONT_STENCIL}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Figure {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly paddle: THREE.Group;
  private t = Math.random() * 10;
  private raiseT = 0;
  private talkT = 0;
  private lookTarget: THREE.Vector3 | null = null;
  private walkTarget: THREE.Vector3 | null = null;
  private walkPhase = 0;
  private faceAfterWalk: number | null = null;
  out = false;
  excited = 0;
  readonly scale: number;

  constructor(look: NpcLook, paddleNo: number | null) {
    const s = look.height / 1.75;
    this.scale = s;
    const b = look.build;
    const skin = Materials.get({ color: look.skin, rough: 0.7 });
    const shirt = Materials.get({ fabric: { color: look.shirt, pattern: 'weave' } });
    const pants = Materials.get({ fabric: { color: look.pants, pattern: 'weave' } });
    const shoes = Materials.color('#1b1814', 0.5);
    const hair = Materials.get({ color: look.hair, rough: 0.9 });

    this.root.add(this.body);
    this.body.scale.setScalar(s);

    for (const [leg, x] of [[this.legL, -0.1 * b], [this.legR, 0.1 * b]] as [THREE.Group, number][]) {
      leg.position.set(x, 0.95, 0);
      this.body.add(leg);
      mesh(cylGeo(0.075 * b, 0.065, 0.86, 10), pants, leg, 0, -0.43, 0);
      mesh(rboxGeo(0.11, 0.08, 0.24, 0.03), shoes, leg, 0, -0.9, -0.04);
    }
    mesh(rboxGeo(0.36 * b, 0.2, 0.24, 0.07), pants, this.body, 0, 0.98, 0);
    const torso = mesh(rboxGeo(0.44 * b, 0.56, 0.27, 0.1), shirt, this.body, 0, 1.28, 0);
    torso.name = 'torso';
    mesh(cylGeo(0.055, 0.06, 0.1, 10), skin, this.body, 0, 1.58, 0);

    for (const [arm, x] of [[this.armL, -0.27 * b], [this.armR, 0.27 * b]] as [THREE.Group, number][]) {
      arm.position.set(x, 1.5, 0);
      this.body.add(arm);
      mesh(cylGeo(0.058, 0.05, 0.58, 10), shirt, arm, 0, -0.29, 0);
      mesh(sphereGeo(0.055, 10), skin, arm, 0, -0.61, 0);
      arm.rotation.z = x < 0 ? 0.08 : -0.08;
    }

    this.head.position.set(0, 1.72, 0);
    this.body.add(this.head);
    mesh(sphereGeo(0.12, 18), skin, this.head, 0, 0, 0).scale.set(1, 1.12, 1);
    const eye = Materials.color('#1a1512', 0.4);
    for (const x of [-0.042, 0.042]) mesh(sphereGeo(0.013, 8), eye, this.head, x, 0.02, -0.108);
    mesh(boxGeo(0.03, 0.05, 0.04), skin, this.head, 0, -0.01, -0.12);
    mesh(boxGeo(0.06, 0.008, 0.01), Materials.color('#6a3a30', 0.6), this.head, 0, -0.06, -0.113);

    // Hair & hats.
    const cap = mesh(sphereGeo(0.126, 16), hair, this.head, 0, 0.03, 0.01);
    cap.scale.set(1, 0.95, 1.02);
    (cap.geometry as THREE.BufferGeometry).computeBoundingBox();
    cap.position.y = 0.035;
    cap.scale.y = 0.9;
    const hatMat = Materials.get({ color: look.hatColor, rough: 0.8 });
    switch (look.hat) {
      case 'cap':
        mesh(sphereGeo(0.13, 16), hatMat, this.head, 0, 0.05, 0).scale.set(1, 0.72, 1);
        mesh(boxGeo(0.2, 0.012, 0.12), hatMat, this.head, 0, 0.06, -0.14);
        break;
      case 'beanie':
        mesh(sphereGeo(0.135, 16), hatMat, this.head, 0, 0.07, 0).scale.set(1, 0.95, 1);
        mesh(cylGeo(0.137, 0.137, 0.05, 16), hatMat, this.head, 0, 0.03, 0);
        break;
      case 'cowboy':
        mesh(cylGeo(0.26, 0.26, 0.015, 20), hatMat, this.head, 0, 0.08, 0);
        mesh(cylGeo(0.1, 0.12, 0.12, 16), hatMat, this.head, 0, 0.15, 0);
        break;
      case 'fedora':
        mesh(cylGeo(0.19, 0.19, 0.012, 20), hatMat, this.head, 0, 0.09, 0);
        mesh(cylGeo(0.105, 0.12, 0.11, 16), hatMat, this.head, 0, 0.15, 0);
        mesh(cylGeo(0.122, 0.122, 0.025, 16), Materials.color('#1a1a1a', 0.6), this.head, 0, 0.11, 0);
        break;
      default:
        break;
    }
    switch (look.extra) {
      case 'sunglasses':
        mesh(boxGeo(0.2, 0.045, 0.02), Materials.get({ color: '#050505', rough: 0.1, metal: 0.6 }), this.head, 0, 0.025, -0.12);
        break;
      case 'pearls':
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          mesh(sphereGeo(0.016, 8), Materials.color('#f4f0e6', 0.2), this.body, Math.cos(a) * 0.09, 1.54, Math.sin(a) * 0.09 - 0.02);
        }
        break;
      case 'clipboard': {
        const cb = mesh(boxGeo(0.22, 0.3, 0.012), M.wood('plywood'), this.armL, 0.02, -0.55, -0.08);
        cb.rotation.x = -0.9;
        mesh(boxGeo(0.18, 0.24, 0.002), M.paper(), cb, 0, 0, -0.008);
        break;
      }
      case 'backpack':
        mesh(rboxGeo(0.34, 0.4, 0.16, 0.05), Materials.get({ fabric: { color: '#2f5a3a', pattern: 'weave' } }), this.body, 0, 1.3, 0.2);
        break;
      case 'tie':
        mesh(boxGeo(0.05, 0.36, 0.01), Materials.color('#7a1a2a', 0.5), this.body, 0, 1.36, -0.14);
        break;
      case 'chain':
        mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20), M.gold(), this.body, 0, 1.46, -0.1).rotation.x = 1.2;
        break;
      default:
        break;
    }

    // Bidding paddle in the right hand.
    this.paddle = new THREE.Group();
    this.paddle.position.set(0, -0.62, 0);
    this.armR.add(this.paddle);
    if (paddleNo !== null) {
      mesh(cylGeo(0.012, 0.012, 0.22, 8), M.wood('oak'), this.paddle, 0, -0.1, 0);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), Materials.get({ map: paddleTexture(paddleNo), rough: 0.6, side: 'double' }));
      face.position.set(0, -0.3, 0);
      face.rotation.y = Math.PI;
      this.paddle.add(face);
      this.paddle.rotation.x = Math.PI;
      this.paddle.visible = false;
    }
  }

  /** Face a world-space yaw (radians). */
  face(yaw: number) {
    this.root.rotation.y = yaw;
  }

  lookAt(target: THREE.Vector3 | null) {
    this.lookTarget = target;
  }

  raisePaddle() {
    this.raiseT = 1.1;
  }

  talk(seconds = 1.2) {
    this.talkT = seconds;
  }

  walkTo(target: THREE.Vector3, faceYaw: number | null = null) {
    this.walkTarget = target.clone();
    this.faceAfterWalk = faceYaw;
  }

  get walking(): boolean {
    return this.walkTarget !== null;
  }

  update(dt: number) {
    this.t += dt;
    const breathe = Math.sin(this.t * 1.7) * 0.012;
    this.body.position.y = breathe * 0.3;
    const torso = this.body.getObjectByName('torso');
    if (torso) torso.scale.set(1 + breathe, 1 + breathe * 0.6, 1 + breathe);

    // Walking.
    if (this.walkTarget) {
      const pos = this.root.position;
      const to = this.walkTarget.clone().sub(pos);
      to.y = 0;
      const dist = to.length();
      if (dist < 0.05) {
        this.walkTarget = null;
        if (this.faceAfterWalk !== null) this.root.rotation.y = this.faceAfterWalk;
      } else {
        const speed = 1.35;
        const step = Math.min(dist, speed * dt);
        pos.add(to.normalize().multiplyScalar(step));
        const yaw = Math.atan2(-to.x, -to.z);
        this.root.rotation.y += shortAngle(this.root.rotation.y, yaw) * Math.min(1, dt * 8);
        this.walkPhase += dt * 7.5;
      }
    }
    const swing = this.walkTarget ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    const idleArm = this.out ? 0.05 : Math.sin(this.t * 0.9) * 0.03;
    this.armL.rotation.x = -swing * 0.6 + idleArm;

    // Paddle raise.
    if (this.raiseT > 0) {
      this.raiseT -= dt;
      const k = Math.sin(Math.min(1, (1.1 - this.raiseT) / 0.25) * Math.PI * 0.5) * (this.raiseT < 0.3 ? this.raiseT / 0.3 : 1);
      this.armR.rotation.x = -2.8 * k;
      this.armR.rotation.z = -0.08 - 0.2 * k;
      this.paddle.visible = k > 0.2;
    } else {
      this.armR.rotation.x = swing * 0.6 - idleArm + (this.excited > 0.5 ? -0.25 : 0);
      this.armR.rotation.z = -0.08;
      this.paddle.visible = false;
    }

    // Head.
    let yaw = 0;
    let pitch = this.out ? 0.35 : 0;
    if (this.lookTarget && !this.out) {
      const headWorld = this.head.getWorldPosition(new THREE.Vector3());
      const d = this.lookTarget.clone().sub(headWorld);
      const local = d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.root.rotation.y);
      yaw = THREE.MathUtils.clamp(Math.atan2(-local.x, -local.z), -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.4);
    }
    if (this.talkT > 0) {
      this.talkT -= dt;
      pitch += Math.sin(this.t * 14) * 0.05;
    }
    this.head.rotation.y += (yaw - this.head.rotation.y) * Math.min(1, dt * 5);
    this.head.rotation.x += (pitch - this.head.rotation.x) * Math.min(1, dt * 5);
    this.body.rotation.x = this.out ? 0.06 : -this.excited * 0.05;
  }

  headWorld(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.getWorldPosition(out);
    out.y += 0.28 * this.scale;
    return out;
  }
}

function shortAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
