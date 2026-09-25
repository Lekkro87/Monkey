import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type Quality = 'low' | 'medium' | 'high';

/** Film look: vignette, grain, gentle split toning and optional slow-motion desaturation. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.035 },
    uWarm: { value: 0.08 },
    uFocus: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uWarm, uFocus;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      float vig = smoothstep(0.85, 0.12, r * uVignette * 1.9);
      c.rgb *= mix(1.0, vig, 0.85);
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // Warm highlights, cool shadows.
      c.rgb += uWarm * vec3(0.06, 0.02, -0.04) * smoothstep(0.2, 1.2, lum);
      c.rgb += uWarm * vec3(-0.015, 0.0, 0.03) * (1.0 - smoothstep(0.0, 0.25, lum));
      // Slow-motion focus: desaturate the edges, keep the centre vivid.
      float edge = smoothstep(0.02, 0.22, r);
      c.rgb = mix(c.rgb, vec3(lum), uFocus * edge * 0.75);
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.13)) - 0.5;
      c.rgb += g * uGrain * (0.6 + lum);
      gl_FragColor = c;
    }
  `,
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  scene: THREE.Scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(55, 1, 0.05, 300);
  quality: Quality;
  envTexture: THREE.Texture;
  focus = 0;
  private time = 0;

  constructor(parent: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'scene';
    parent.appendChild(this.canvas);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.setupComposer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private setupComposer() {
    this.composer?.dispose();
    this.composer = null;
    if (this.quality === 'low') return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)), 0.42, 0.55, 0.88);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.needsUpdate = true; });
    });
    this.setupComposer();
    this.resize();
  }

  setView(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    if (this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
    }
    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
  }

  render(dt: number) {
    this.time += dt;
    if (this.composer && this.grade) {
      this.grade.uniforms.uTime.value = this.time;
      this.grade.uniforms.uFocus.value = this.focus;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
