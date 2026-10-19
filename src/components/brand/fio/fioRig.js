/**
 * Fio als Figur: Block-Kopf, Pillen-Augen, Brauen im Stil „Sanfter Bogen“, schwebende Hände und Füße.
 * Entwurf und Abstimmung: Artefakt „Fio Figur“ (Runde 6, Form „Weich“), siehe docs/Wissen/07_KI_Coach/02-Fio-Figur.md.
 *
 * Das Rig zeichnet direkt ins SVG (kein React-Render pro Bild). Alle Instanzen teilen sich eine Animationsschleife
 * und einen Zeiger-Listener. Farben kommen aus den Tokens: Körper `--bg-inverse`, Augen `--text-inverse`, dadurch dreht
 * sich die Figur im dunklen Design von selbst um.
 *
 * Bei `prefers-reduced-motion` (Regel 01): kein Mitschauen, kein Blinzeln, kein Wippen, Ausdrücke wechseln ohne Animation.
 */

const NS = 'http://www.w3.org/2000/svg';
const BODY = 'var(--bg-inverse)';
const EYE = 'var(--text-inverse)';

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const f2 = (v) => v.toFixed(2);

class Spring {
  constructor(v, k = 0.12, d = 0.72) { this.x = v; this.v = 0; this.t = v; this.k = k; this.d = d; }
  step(f) { this.v = (this.v + (this.t - this.x) * this.k * f) * Math.pow(this.d, f); this.x += this.v * f; }
}

// Kopf (Block). box = [x0, y0, x1, y1]
const HEAD = {
  box: [58, 54, 182, 162], cx: 120, cy: 108, top: 54, radius: 30,
  eyes: { l: [100, 110], r: [140, 110], w: 16, h: 30, range: [13, 10] }, browGap: 12,
};
const HAND = { w: 22, h: 28, r: 11 };
const FOOT = { w: 30, h: 14, r: 7, gap: 24 };
const BROW_THICKNESS = 0.29; // Anteil der Augenbreite
const BROW_CURVE = 0.45;

// Ausdrücke. Lider: lidIn/lidOut von oben, happy von unten (Lächeln mit den Augen). Brauen: bL/bR heben, bt Innenkante hoch, bc Bogen.
const EXPR = {
  idle:      { sW: 1, sH: 1, lidIn: 0, lidOut: 0, happy: 0, hL: 1, hR: 1, bL: 0, bR: 0, bt: 0, bc: 1.5 },
  listening: { sW: 1.05, sH: 1.12, lidIn: 0, lidOut: 0, happy: 0, hL: 1, hR: 1, bL: 4, bR: 4, bt: 0, bc: 2 },
  thinking:  { sW: 1, sH: 0.94, lidIn: 0, lidOut: 0, happy: 0.24, hL: 0.94, hR: 1, bL: -1, bR: 8, bt: 0, bc: 2.5 },
  talking:   { sW: 1, sH: 1, lidIn: 0, lidOut: 0, happy: 0.1, hL: 1, hR: 1, bL: 2, bR: 2, bt: 0, bc: 2 },
  happy:     { sW: 1.06, sH: 1, lidIn: 0, lidOut: 0, happy: 0.9, hL: 1, hR: 1, bL: 5, bR: 5, bt: 0, bc: 4 },
  surprised: { sW: 1.14, sH: 1.24, lidIn: 0, lidOut: 0, happy: 0, hL: 1, hR: 1, bL: 10, bR: 10, bt: 0, bc: 4 },
  scared:    { sW: 1.18, sH: 1.3, lidIn: 0, lidOut: 0, happy: 0, hL: 1, hR: 0.94, bL: 9, bR: 10, bt: 7, bc: 0.5 },
  sleepy:    { sW: 1.04, sH: 0.96, lidIn: 0.58, lidOut: 0.6, happy: 0, hL: 1, hR: 1, bL: -3, bR: -3, bt: 0, bc: 0 },
  confused:  { sW: 1, sH: 1, lidIn: 0, lidOut: 0.22, happy: 0, hL: 1, hR: 0.84, bL: 1, bR: 4, bt: 6, bc: 0.5 },
};
export const FIO_MOODS = Object.keys(EXPR);
// Brauen nur bei Gefühlen: in Ruhe, beim Zuhören, Sprechen und Schlafen bleibt Fio bei den Augen.
const BROW_MOODS = new Set(['thinking', 'happy', 'surprised', 'scared', 'confused']);

function handPose(e, t) {
  const [x0, y0, x1, y1] = HEAD.box;
  const { cx, cy } = HEAD;
  const restL = { x: x0 - 22, y: cy + 24, r: 12 };
  const restR = { x: x1 + 22, y: cy + 24, r: -12 };
  const s = (v) => Math.max(0, v);
  switch (e) {
    case 'listening': return [{ x: x0 - 13, y: cy + 14, r: 4 }, { x: x1 + 13, y: cy + 14, r: -4 }];
    case 'thinking': return [{ x: restL.x, y: restL.y + 6, r: 16 }, { x: cx + 24, y: y1 - 2 + Math.sin(t * 4) * 1.5, r: -38 }];
    case 'talking': {
      const a = s(Math.sin(t * 3.2)), b = s(Math.sin(t * 3.2 + Math.PI));
      return [{ x: x0 - 18 - a * 3, y: cy + 20 - a * 10, r: 12 - a * 22 }, { x: x1 + 18 + b * 3, y: cy + 20 - b * 10, r: -12 + b * 22 }];
    }
    case 'happy': return [{ x: x0 - 16, y: y0 + 2, r: 24 + Math.sin(t * 12) * 18 }, { x: x1 + 16, y: y0 + 2, r: -24 - Math.sin(t * 12 + 1) * 18 }];
    case 'surprised': return [{ x: x0 - 9, y: cy - 8, r: -8 }, { x: x1 + 9, y: cy - 8, r: 8 }];
    case 'scared': return [
      { x: x0 - 16, y: y0 + 2 + Math.sin(t * 17) * 5, r: -28 + Math.sin(t * 17) * 18 },
      { x: x1 + 16, y: y0 + 2 + Math.sin(t * 17 + 2) * 5, r: 28 - Math.sin(t * 17 + 2) * 18 },
    ];
    case 'sleepy': return [{ x: x0 - 15, y: cy + 36, r: 26 }, { x: x1 + 15, y: cy + 36, r: -26 }];
    case 'confused': return [restL, { x: x1 - 4 + Math.sin(t * 14) * 2.5, y: y0 - 12, r: -40 }];
    default: {
      const w = Math.sin(t * 2 + 0.6) * 2;
      return [{ x: restL.x, y: restL.y + w, r: restL.r }, { x: restR.x, y: restR.y + w, r: restR.r }];
    }
  }
}

// Gemeinsame Schleife und Zeiger für alle Instanzen
const rigs = new Set();
const pointer = { x: 0, y: 0, last: -1e9 };
let frame = 0;
let lastTime = 0;
let pointerBound = false;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function onPointer(e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.last = performance.now(); }
function loop(now) {
  const f = Math.min(3, (now - (lastTime || now)) / 16.667) || 1;
  lastTime = now;
  rigs.forEach((r) => r.tick(now, f));
  frame = rigs.size ? requestAnimationFrame(loop) : 0;
}
function register(rig) {
  rigs.add(rig);
  if (!pointerBound) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    pointerBound = true;
  }
  if (!frame) { lastTime = 0; frame = requestAnimationFrame(loop); }
}
function unregister(rig) {
  rigs.delete(rig);
  if (!rigs.size) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onPointer);
    pointerBound = false;
  }
}

let uid = 0;

/**
 * Baut Fio in `host` (leeres Element) und gibt die Steuerung zurück.
 * Optionen: hands, feet (bool), brows ('emotion' | 'always' | 'off'), gap (Farbe der Aussparung um die Hände, = Hintergrund),
 * outline (nur Umriss statt gefüllt, für Zeichen im Ruhezustand), look (false: Augen folgen dem Zeiger nicht).
 * Steuerung: setMood(mood), boop(), land(), walkDir (-1, 0, 1), held (bool), swing (Grad), destroy().
 */
export function createFioRig(host, { hands = false, feet = false, brows = 'emotion', gap = 'var(--bg-surface)', outline = false, look = true } = {}) {
  const id = `fio${++uid}`;
  const [x0, y0, x1, y1] = HEAD.box;
  const ground = y1 + 30;

  // Bildausschnitt: Kopf plus Platz für Hände (auch erhoben) und Füße, quadratisch
  const pad = 12;
  const minX = x0 - (hands ? 48 : pad), maxX = x1 + (hands ? 48 : pad);
  const minY = HEAD.top - pad - (hands ? 12 : 0);
  const maxY = feet ? ground + 12 : y1 + pad;
  const size = Math.max(maxX - minX, maxY - minY);
  const vx = (minX + maxX) / 2 - size / 2;
  const vy = feet ? maxY - size : (minY + maxY) / 2 - size / 2; // mit Füßen steht Fio auf der Unterkante

  const svg = el('svg', { viewBox: `${f2(vx)} ${f2(vy)} ${f2(size)} ${f2(size)}`, width: '100%', height: '100%', 'aria-hidden': 'true', overflow: 'visible' });
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  const defs = el('defs', {}, svg);
  const feetEls = feet ? [0, 1].map(() => el('rect', { width: FOOT.w, height: FOOT.h, rx: FOOT.r, fill: BODY }, svg)) : null;
  const rig = el('g', {}, svg);
  if (outline) {
    const sw = 13;
    el('rect', { x: x0 + sw / 2, y: y0 + sw / 2, width: x1 - x0 - sw, height: y1 - y0 - sw, rx: HEAD.radius - sw / 2, fill: 'none', stroke: BODY, 'stroke-width': sw }, rig);
  } else {
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: HEAD.radius, fill: BODY }, rig);
  }
  const inkColor = outline ? BODY : EYE;
  const face = el('g', {}, rig);

  // Augen: Die Lider sind Masken, die das Auge ausschneiden. So bleibt beim Schließen kein Saum stehen.
  const browT = HEAD.eyes.w * BROW_THICKNESS;
  const eyes = ['l', 'r'].map((side) => {
    const m = el('mask', { id: id + side, maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 640, height: 640 }, defs);
    el('rect', { x: -200, y: -200, width: 640, height: 640, fill: '#fff' }, m);
    const top = el('polygon', { fill: '#000' }, m);
    const bot = el('ellipse', { fill: '#000' }, m);
    const r = el('rect', { fill: inkColor, mask: `url(#${id + side})` }, face);
    const brow = brows !== 'off' ? el('path', { fill: 'none', stroke: inkColor, 'stroke-width': browT, 'stroke-linecap': 'round' }, face) : null;
    return { side, r, top, bot, brow, base: HEAD.eyes[side], sign: side === 'l' ? -1 : 1 };
  });
  // Hände mit Aussparung in Hintergrundfarbe (Kontur unter der Füllung), damit sie vor dem Kopf lesbar bleiben
  const handEls = hands ? [0, 1].map(() => el('rect', {
    x: -HAND.w / 2, y: -HAND.h / 2, width: HAND.w, height: HAND.h, rx: HAND.r, fill: BODY, stroke: gap, 'stroke-width': 6, 'paint-order': 'stroke',
  }, svg)) : null;
  host.appendChild(svg);

  const fast = (v) => new Spring(v, 0.26, 0.58);
  const S = {
    lx: fast(0), ly: fast(0), open: new Spring(1, 0.55, 0.45),
    sW: new Spring(1), sH: new Spring(1), lidIn: new Spring(0), lidOut: new Spring(0), happy: new Spring(0), hL: new Spring(1), hR: new Spring(1),
    bv: new Spring(brows === 'always' ? 1 : 0, 0.14, 0.68),
    bL: new Spring(0, 0.16, 0.66), bR: new Spring(0, 0.16, 0.66), bt: new Spring(0), bc: new Spring(1.5),
    bob: new Spring(0, 0.1, 0.78), jump: new Spring(0, 0.14, 0.72), rot: new Spring(0, 0.08, 0.8), sq: new Spring(0, 0.18, 0.7), lean: new Spring(0, 0.08, 0.8),
    walk: new Spring(0, 0.08, 0.8), swing: new Spring(0, 0.1, 0.75),
    hLx: new Spring(0, 0.1, 0.74), hLy: new Spring(0, 0.1, 0.74), hLr: new Spring(0, 0.1, 0.74),
    hRx: new Spring(0, 0.1, 0.74), hRy: new Spring(0, 0.1, 0.74), hRr: new Spring(0, 0.1, 0.74),
  };
  const init = handPose('idle', 0);
  [S.hLx.x, S.hLy.x, S.hLr.x] = [init[0].x, init[0].y, init[0].r];
  [S.hRx.x, S.hRy.x, S.hRr.x] = [init[1].x, init[1].y, init[1].r];

  let mood = 'idle';
  let moodSince = performance.now();
  let nextBlink = performance.now() + 1200 + Math.random() * 2500;
  let blinkUntil = 0;
  let doubleBlink = false;
  let nextSaccade = 0;
  let wander = { x: 0, y: 0 };
  let override = null;
  let lastDir = 1;

  const ctl = {
    walkDir: 0,
    held: false,
    swing: 0,
    setMood(m) {
      if (!EXPR[m] || m === mood) return;
      mood = m;
      moodSince = performance.now();
      if (reduceMotion()) return;
      if (m === 'surprised') { S.jump.v -= 4; S.sq.v += 0.05; }
      if (m === 'happy') S.sq.v -= 0.06;
      if (m === 'confused') S.rot.v += 2.5;
    },
    boop() {
      S.sq.v -= 0.09;
      if (!reduceMotion()) S.jump.v -= 2.5;
      override = { expr: 'happy', until: performance.now() + 1200 };
    },
    land() {
      if (reduceMotion()) return;
      S.sq.v += 0.12;
    },
    tick(now, f) {
      const t = now / 1000;
      const since = (now - moodSince) / 1000;
      if (override && now > override.until) override = null;
      const ek = ctl.held ? 'scared' : override ? override.expr : mood;
      const E = EXPR[ek];
      const calm = reduceMotion();
      const wk = calm || ctl.held ? 0 : ctl.walkDir;
      if (wk) lastDir = wk;

      // Blick
      let tx;
      let ty;
      if (ek === 'thinking') { tx = 0.6 + 0.25 * Math.sin(t * 0.7); ty = -0.85; }
      else if (ek === 'sleepy') { tx = 0; ty = 0.55; }
      else if (ek === 'scared') { tx = Math.sin(t * 9) * 0.5; ty = 0.6; }
      else if (wk) { tx = wk * 0.8; ty = 0.1; }
      else if (calm || !look) { tx = 0; ty = 0; }
      else if (now - pointer.last < 2500) {
        const rect = svg.getBoundingClientRect();
        const dx = pointer.x - (rect.left + rect.width / 2);
        const dy = pointer.y - (rect.top + rect.height * 0.45);
        tx = Math.max(-1, Math.min(1, (dx / (Math.abs(dx) + 160)) * 1.5));
        ty = Math.max(-1, Math.min(1, (dy / (Math.abs(dy) + 140)) * 1.5));
      } else {
        if (now > nextSaccade) {
          wander = Math.random() < 0.4 ? { x: 0, y: 0 } : { x: (Math.random() * 2 - 1) * 0.55, y: (Math.random() * 2 - 1) * 0.35 };
          nextSaccade = now + 900 + Math.random() * 2400;
        }
        tx = wander.x;
        ty = wander.y;
        if (ek === 'listening' || ek === 'talking') { tx *= 0.3; ty = ty * 0.3 + 0.05; }
      }
      S.lx.t = tx;
      S.ly.t = ty;

      // Blinzeln
      if (!calm && now > nextBlink && ek !== 'happy' && ek !== 'scared') {
        blinkUntil = now + 120;
        doubleBlink = Math.random() < 0.2;
        nextBlink = now + (ek === 'sleepy' ? 3500 : 1800) + Math.random() * 3800;
      }
      if (doubleBlink && now > blinkUntil + 110 && now < blinkUntil + 130) { blinkUntil = now + 110; doubleBlink = false; }
      S.open.t = now < blinkUntil ? 0 : 1;
      if (ek === 'sleepy' && !calm) S.open.t *= 0.75 + 0.25 * Math.sin(t * 0.8);

      for (const k in E) S[k].t = E[k];
      S.bv.t = brows === 'always' || BROW_MOODS.has(ek) ? 1 : 0;
      let talk = 0;
      if (ek === 'talking' && !calm) {
        talk = Math.max(0, Math.sin(t * 13) * 0.6 + Math.sin(t * 7.7) * 0.5);
        S.sH.t = 1 + 0.08 * talk;
        S.bL.t = 2 + talk * 3;
        S.bR.t = S.bL.t;
      }
      if (ek === 'listening' && !calm) S.sH.t = 1.12 + 0.03 * Math.sin(t * 3);
      if (ek === 'thinking' && !calm) S.bR.t = 8 + Math.sin(t * 1.4) * 1.5;

      // Körper: bob = Atmen (Füße bleiben stehen), jump = Hüpfen (Füße hüpfen mit)
      let bob = calm ? 0 : Math.sin(t * 2) * 2.2;
      let jump = 0;
      let rot = S.lx.x * 3.5;
      if (!calm) {
        if (ek === 'happy') jump = -Math.abs(Math.sin(t * 7)) * 7;
        if (ek === 'talking') bob -= talk * 2.6;
        if (ek === 'sleepy') { bob = Math.sin(t * 1.1) * 3 + 4; rot = Math.sin(t * 0.55) * 4; }
        if (ek === 'confused' && since < 0.7) rot += Math.sin(since * 34) * 6 * (1 - since / 0.7);
        if (ek === 'thinking') rot = 4 + Math.sin(t * 0.7) * 1.5;
        if (ek === 'scared') bob = Math.sin(t * 24) * 1.2;
      }
      S.bob.t = bob;
      S.jump.t = jump;
      S.rot.t = rot;
      S.lean.t = ek === 'listening' ? 0.04 : 0;
      S.swing.t = ctl.held ? ctl.swing : 0;
      S.walk.t = wk ? 1 : 0;

      if (handEls) {
        const p = handPose(ek, t);
        [S.hLx.t, S.hLy.t, S.hLr.t] = [p[0].x, p[0].y, p[0].r];
        [S.hRx.t, S.hRy.t, S.hRr.t] = [p[1].x, p[1].y, p[1].r];
      }

      for (const k in S) {
        if (calm) { S[k].x = S[k].t; S[k].v = 0; } else S[k].step(f);
      }

      // Gang: Füße abwechselnd, Hände gegengleich, Wippen pro Schritt, Lehnen in Laufrichtung.
      // Hochgehoben: Füße strampeln auf der Stelle.
      const kick = ctl.held && !calm;
      const wa = kick ? 1 : S.walk.x;
      const ph = t * Math.PI * 2 * (kick ? 3.2 : 1.7);
      const stepOf = (o) => ({
        dx: kick ? 0 : Math.sin(ph + o) * 9 * lastDir * wa,
        lift: Math.max(0, Math.cos(ph + o)) * (kick ? 9 : 7) * wa,
      });
      const fL = stepOf(0);
      const fR = stepOf(Math.PI);
      const gaitBob = kick ? 0 : -Math.abs(Math.sin(ph)) * 3.5 * wa;
      const gaitRot = kick ? 0 : lastDir * 5 * S.walk.x;

      const by = S.bob.x + S.jump.x + gaitBob;
      const sc = 1 + S.lean.x;
      const sx = sc * (1 + S.sq.x * 0.6);
      const sy = sc * (1 - S.sq.x);
      rig.setAttribute('transform', `translate(0 ${f2(by)}) translate(${HEAD.cx} ${y1}) rotate(${f2(S.rot.x + gaitRot + S.swing.x)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-HEAD.cx} ${-y1})`);

      if (feetEls) {
        const fy = ground - FOOT.h / 2 + Math.min(0, S.jump.x);
        const tap = ek === 'listening' && !calm ? Math.max(0, Math.sin(t * 6)) * 3 : 0;
        feetEls[0].setAttribute('x', f2(HEAD.cx - FOOT.gap - FOOT.w / 2 + fL.dx));
        feetEls[0].setAttribute('y', f2(fy - fL.lift));
        feetEls[1].setAttribute('x', f2(HEAD.cx + FOOT.gap - FOOT.w / 2 + fR.dx));
        feetEls[1].setAttribute('y', f2(fy - tap - fR.lift));
      }
      if (handEls) {
        const hb = S.bob.x * 0.6 + S.jump.x + gaitBob;
        const sw = kick ? 0 : Math.sin(ph) * wa * lastDir;
        handEls[0].setAttribute('transform', `translate(${f2(S.hLx.x - sw * 7)} ${f2(S.hLy.x + hb)}) rotate(${f2(S.hLr.x - sw * 22)})`);
        handEls[1].setAttribute('transform', `translate(${f2(S.hRx.x + sw * 7)} ${f2(S.hRy.x + hb)}) rotate(${f2(S.hRr.x + sw * 22)})`);
      }

      // Augen und Brauen
      const open = Math.max(S.open.x, 0.06);
      for (const e of eyes) {
        const [bx, byE] = e.base;
        const ex = bx + S.lx.x * HEAD.eyes.range[0];
        const ey = byE + S.ly.x * HEAD.eyes.range[1];
        const hs = e.side === 'l' ? S.hL.x : S.hR.x;
        const w = HEAD.eyes.w * S.sW.x * (1 + (1 - open) * 0.18);
        const hFull = HEAD.eyes.h * S.sH.x * hs;
        const h = hFull * open;
        const x = ex - w / 2;
        const y = ey - h / 2;
        e.r.setAttribute('x', f2(x));
        e.r.setAttribute('y', f2(y));
        e.r.setAttribute('width', f2(w));
        e.r.setAttribute('height', f2(h));
        e.r.setAttribute('rx', f2(Math.min(w, h) / 2));
        const xo = ex + e.sign * (w / 2 + 4);
        const xi = ex - e.sign * (w / 2 + 4);
        e.top.setAttribute('points', `${f2(xo)},${f2(y - 80)} ${f2(xi)},${f2(y - 80)} ${f2(xi)},${f2(y + h * S.lidIn.x)} ${f2(xo)},${f2(y + h * S.lidOut.x)}`);
        e.bot.setAttribute('cx', f2(ex));
        e.bot.setAttribute('cy', f2(y + h + h * 0.62 - S.happy.x * h * 0.78));
        e.bot.setAttribute('rx', f2(w * 1.05));
        e.bot.setAttribute('ry', f2(h * 0.62));

        if (e.brow) {
          // Einblenden: Die Braue steigt aus dem Auge auf und wird dabei sichtbar
          e.brow.setAttribute('opacity', Math.max(0, Math.min(1, S.bv.x)).toFixed(2));
          const half = HEAD.eyes.w * 0.72;
          const baseY = ey - hFull / 2 - HEAD.browGap - (e.side === 'l' ? S.bL.x : S.bR.x) + (1 - S.bv.x) * 7;
          const oX = ex + e.sign * half;
          const iX = ex - e.sign * half;
          const oY = baseY;
          const iY = baseY - S.bt.x;
          const dx = iX - oX;
          const dy = iY - oY;
          const len = Math.hypot(dx, dy) || 1;
          const ux = (dx / len) * (browT / 2);
          const uy = (dy / len) * (browT / 2);
          e.brow.setAttribute('d', `M${f2(oX + ux)} ${f2(oY + uy)} Q${f2((oX + iX) / 2)} ${f2((oY + iY) / 2 - S.bc.x * BROW_CURVE * 2)} ${f2(iX - ux)} ${f2(iY - uy)}`);
        }
      }
    },
    destroy() {
      unregister(ctl);
      svg.remove();
    },
  };
  register(ctl);
  return ctl;
}
