import * as CANNON from 'cannon-es';
import * as THREE from 'three';

interface Entry {
  body: CANNON.Body;
  obj: THREE.Object3D;
  half: THREE.Vector3;
}

/**
 * Rigid-body physics for the unit being searched. Items are boxes (their model
 * bounds); everything starts asleep so stacks stay put until something moves.
 */
export class PhysicsWorld {
  readonly world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  private entries = new Map<string, Entry>();
  private hand: CANNON.Body;
  private joint: CANNON.PointToPointConstraint | null = null;
  grabbed: string | null = null;
  private itemMat = new CANNON.Material('item');
  private floorMat = new CANNON.Material('floor');
  timeScale = 1;

  constructor(readonly w: number, readonly d: number, readonly h: number) {
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    (this.world.solver as CANNON.GSSolver).iterations = 12;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.itemMat, this.itemMat, { friction: 0.55, restitution: 0.05 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.itemMat, this.floorMat, { friction: 0.6, restitution: 0.08 }));
    const floor = new CANNON.Body({ mass: 0, material: this.floorMat });
    floor.addShape(new CANNON.Plane());
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floor);
    const wall = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => {
      const b = new CANNON.Body({ mass: 0, material: this.floorMat });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      b.position.set(x, y, z);
      this.world.addBody(b);
    };
    wall(-w / 2 - 0.1, h / 2, d / 2, 0.1, h, d / 2 + 2);
    wall(w / 2 + 0.1, h / 2, d / 2, 0.1, h, d / 2 + 2);
    wall(0, h / 2, d + 0.1, w / 2 + 0.2, h, 0.1);
    wall(0, h + 0.1, d / 2, w / 2 + 0.2, 0.1, d / 2 + 2);
    // Keep things from sliding across the whole driveway.
    wall(0, 0.2, -3.2, w / 2 + 2, 0.4, 0.1);
    this.hand = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
    this.hand.collisionResponse = false;
    this.world.addBody(this.hand);
  }

  add(uid: string, obj: THREE.Object3D, dims: [number, number, number], mass: number, asleep = true) {
    const half = new THREE.Vector3(dims[0] / 2, dims[1] / 2, dims[2] / 2);
    const body = new CANNON.Body({
      mass: Math.max(0.15, mass),
      material: this.itemMat,
      linearDamping: 0.12,
      angularDamping: 0.25,
      allowSleep: true,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 0.6,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(half.x * 0.995, half.y * 0.995, half.z * 0.995)));
    body.position.set(obj.position.x, obj.position.y, obj.position.z);
    body.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
    this.world.addBody(body);
    if (asleep) body.sleep();
    this.entries.set(uid, { body, obj, half });
    return body;
  }

  has(uid: string) {
    return this.entries.has(uid);
  }

  body(uid: string): CANNON.Body | null {
    return this.entries.get(uid)?.body ?? null;
  }

  remove(uid: string) {
    const e = this.entries.get(uid);
    if (!e) return;
    if (this.grabbed === uid) this.release();
    this.world.removeBody(e.body);
    this.entries.delete(uid);
    this.wakeAll();
  }

  wakeAll() {
    for (const e of this.entries.values()) e.body.wakeUp();
  }

  impulse(uid: string, v: THREE.Vector3) {
    const e = this.entries.get(uid);
    if (!e) return;
    e.body.wakeUp();
    e.body.velocity.set(e.body.velocity.x + v.x, e.body.velocity.y + v.y, e.body.velocity.z + v.z);
  }

  grab(uid: string, point: THREE.Vector3) {
    const e = this.entries.get(uid);
    if (!e) return;
    this.release();
    e.body.wakeUp();
    this.hand.position.set(point.x, point.y, point.z);
    const local = e.body.pointToLocalFrame(new CANNON.Vec3(point.x, point.y, point.z));
    this.joint = new CANNON.PointToPointConstraint(e.body, local, this.hand, new CANNON.Vec3(0, 0, 0), Math.max(20, e.body.mass * 40));
    this.world.addConstraint(this.joint);
    e.body.angularDamping = 0.8;
    this.grabbed = uid;
  }

  moveHand(p: THREE.Vector3) {
    this.hand.position.set(p.x, Math.max(0.05, p.y), p.z);
  }

  release(throwVel?: THREE.Vector3) {
    if (this.joint) this.world.removeConstraint(this.joint);
    this.joint = null;
    if (this.grabbed) {
      const e = this.entries.get(this.grabbed);
      if (e) {
        e.body.angularDamping = 0.25;
        if (throwVel) e.body.velocity.set(throwVel.x, throwVel.y, throwVel.z);
      }
    }
    this.grabbed = null;
  }

  /** Spin the held object a quarter turn. */
  rotateGrabbed() {
    if (!this.grabbed) return;
    const e = this.entries.get(this.grabbed)!;
    e.body.angularVelocity.set(0, 4, 0);
  }

  step(dt: number) {
    this.world.step(1 / 60, dt * this.timeScale, 4);
    for (const e of this.entries.values()) {
      if (e.body.sleepState === CANNON.Body.SLEEPING && !e.obj.userData.dirty) continue;
      e.obj.position.set(e.body.position.x, e.body.position.y, e.body.position.z);
      e.obj.quaternion.set(e.body.quaternion.x, e.body.quaternion.y, e.body.quaternion.z, e.body.quaternion.w);
      e.obj.userData.dirty = e.body.sleepState !== CANNON.Body.SLEEPING;
      const blob = e.obj.userData.blob as THREE.Object3D | undefined;
      if (blob) {
        blob.position.x = e.obj.position.x;
        blob.position.z = e.obj.position.z;
        const lift = e.obj.position.y - e.half.y;
        blob.visible = lift < 0.3;
      }
    }
  }

  /** Axis-aligned footprints of tall objects, for walking collision. */
  obstacles(minTop = 0.55): { x: number; z: number; hx: number; hz: number }[] {
    const out: { x: number; z: number; hx: number; hz: number }[] = [];
    const box = new THREE.Box3();
    for (const e of this.entries.values()) {
      box.setFromObject(e.obj);
      if (box.max.y < minTop) continue;
      out.push({ x: (box.min.x + box.max.x) / 2 - (e.obj.parent?.position.x ?? 0), z: (box.min.z + box.max.z) / 2, hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2 });
    }
    return out;
  }
}
