import * as THREE from 'three';

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Smooth camera moves between poses, plus shake. */
export class CameraRig {
  private fromPos = new THREE.Vector3();
  private toPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private toLook = new THREE.Vector3();
  private fromFov = 55;
  private toFov = 55;
  private t = 1;
  private duration = 1;
  readonly look = new THREE.Vector3();
  private shakeAmt = 0;
  private shakeT = 0;
  private drift = 0;
  driftAmount = 0;
  onArrive: (() => void) | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  get moving(): boolean {
    return this.t < 1;
  }

  set(pos: THREE.Vector3, look: THREE.Vector3, fov = this.camera.fov) {
    this.toPos.copy(pos);
    this.toLook.copy(look);
    this.fromPos.copy(pos);
    this.fromLook.copy(look);
    this.toFov = this.fromFov = fov;
    this.t = 1;
    this.apply(1);
  }

  goTo(pos: THREE.Vector3, look: THREE.Vector3, duration = 1.2, fov = this.toFov, onArrive: (() => void) | null = null) {
    this.fromPos.copy(this.camera.position);
    this.fromLook.copy(this.look);
    this.fromFov = this.camera.fov;
    this.toPos.copy(pos);
    this.toLook.copy(look);
    this.toFov = fov;
    this.duration = Math.max(0.01, duration);
    this.t = 0;
    this.onArrive = onArrive;
  }

  shake(amount: number, seconds = 0.4) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, seconds);
  }

  private apply(k: number) {
    const e = ease(k);
    this.camera.position.lerpVectors(this.fromPos, this.toPos, e);
    this.look.lerpVectors(this.fromLook, this.toLook, e);
    this.camera.fov = this.fromFov + (this.toFov - this.fromFov) * e;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      this.apply(this.t);
      if (this.t >= 1 && this.onArrive) {
        const cb = this.onArrive;
        this.onArrive = null;
        cb();
      }
    }
    this.drift += dt;
    const look = this.look.clone();
    if (this.driftAmount > 0) {
      look.x += Math.sin(this.drift * 0.21) * this.driftAmount;
      look.y += Math.sin(this.drift * 0.17) * this.driftAmount * 0.4;
    }
    this.camera.lookAt(look);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmt * Math.max(0, this.shakeT);
      this.camera.rotation.x += (Math.random() - 0.5) * a;
      this.camera.rotation.y += (Math.random() - 0.5) * a;
    }
  }
}
