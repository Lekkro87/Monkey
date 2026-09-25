/**
 * Keyboard + pointer state for the 3D view. Distinguishes clicks from drags
 * so a quick tap interacts and a drag looks around (or grabs an object).
 */
export class Input {
  readonly keys = new Set<string>();
  private pressed = new Set<string>();
  x = 0;
  y = 0;
  down = false;
  button = 0;
  dx = 0;
  dy = 0;
  wheel = 0;
  dragDistance = 0;
  downX = 0;
  downY = 0;
  downTime = 0;
  click: { x: number; y: number; button: number } | null = null;
  dragStart: { x: number; y: number; button: number } | null = null;
  released = false;
  onCanvas = false;
  touch = false;
  private pointers = new Map<number, { x: number; y: number }>();

  constructor(readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.touch = e.pointerType === 'touch';
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size > 1) return;
      canvas.setPointerCapture?.(e.pointerId);
      this.down = true;
      this.button = e.button;
      this.downX = this.x = e.clientX;
      this.downY = this.y = e.clientY;
      this.downTime = performance.now();
      this.dragDistance = 0;
      this.dragStart = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      this.onCanvas = true;
      const prev = this.pointers.get(e.pointerId);
      if (prev) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.down && prev && this.pointers.size === 1) {
        this.dx += e.clientX - this.x;
        this.dy += e.clientY - this.y;
        this.dragDistance += Math.hypot(e.clientX - this.x, e.clientY - this.y);
        if (!this.dragStart && this.dragDistance > (this.touch ? 10 : 6)) this.dragStart = { x: this.downX, y: this.downY, button: this.button };
      }
      this.x = e.clientX;
      this.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (!this.down) return;
      this.down = false;
      this.released = true;
      if (this.dragDistance <= (this.touch ? 10 : 6) && performance.now() - this.downTime < 600) {
        this.click = { x: e.clientX, y: e.clientY, button: e.button };
      }
      this.dragStart = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { this.onCanvas = false; });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True once per key press. */
  pressedKey(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  get dragging(): boolean {
    return this.down && this.dragStart !== null;
  }

  /** Normalised device coordinates of the pointer. */
  ndc(x = this.x, y = this.y): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * 2 - 1, y: -((y - r.top) / r.height) * 2 + 1 };
  }

  endFrame() {
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.click = null;
    this.released = false;
    this.pressed.clear();
  }
}
