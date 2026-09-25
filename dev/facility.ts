import * as THREE from 'three';
import { FACILITY_MAP } from '../src/data/facilities';
import { Renderer, type Quality } from '../src/render/Renderer';
import { FacilityScene, type Mood } from '../src/render/scenes/FacilityScene';
import { Game } from '../src/systems/game';

// Dev harness: ?view=establish|doorway|crowd|inside&lot=0&mood=golden&quality=medium&door=0.8
const q = new URLSearchParams(location.search);
const game = new Game({ seed: Number(q.get('seed') ?? 7) });
game.newGame(Number(q.get('seed') ?? 7));
const today = game.auctions.ensureToday();
const renderer = new Renderer(document.body, (q.get('quality') ?? 'medium') as Quality);
const fs = new FacilityScene(FACILITY_MAP.lucky_lock, renderer.envTexture);
fs.setMood((q.get('mood') ?? 'golden') as Mood);
fs.buildRow(today.lots);
const lot = today.lots[Number(q.get('lot') ?? 0)];
fs.focusLot(lot);
fs.ensureFigures(today.attendees);
fs.placeCrowd(today.attendees, true);
fs.openDoor(Number(q.get('door') ?? 0.8), 0.01);
renderer.setView(fs.scene, fs.camera);

const view = q.get('view') ?? 'establish';
if (view === 'establish') {
  const s = fs.establishingShot();
  fs.rig.set(s.pos, s.look, 50);
} else if (view === 'crowd') {
  const s = fs.crowdShot();
  fs.rig.set(s.pos, s.look, 45);
} else if (view === 'doorway') {
  const eye = fs.doorwayEye(0);
  fs.rig.set(eye, new THREE.Vector3(fs.lotX, 0.7, lot.dims.d * 0.6), 62);
  fs.flashlight.intensity = 40;
} else if (view === 'inside') {
  fs.openDoor(1, 0.01);
  fs.rig.set(new THREE.Vector3(fs.lotX, 1.6, 0.3), new THREE.Vector3(fs.lotX, 0.6, lot.dims.d * 0.7), 65);
  fs.flashlight.intensity = 40;
} else if (view === 'wide') {
  fs.rig.set(new THREE.Vector3(-14, 6, -11), new THREE.Vector3(0, 1, 0), 50);
}
let frames = 0;
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fs.update(dt);
  renderer.render(dt);
  frames++;
  if (frames === 8) (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(loop);
}
document.fonts.ready.then(() => requestAnimationFrame(loop));
console.log('lot', lot.number, lot.size, lot.blueprintId, 'items', lot.items.length);
