import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORDMARK, WORDMARK_FRAME } from './focusFlowWordmarkData';
import WordmarkSvg from './WordmarkSvg';
import { STAGE_PAD_X, STAGE_PAD_Y } from './wordmarkStage';

// Extrusion wie im Prototyp (V3/V4, Tiefe 20 × 0.85)
const EXTRUDE = { depth: 17, bevelEnabled: true, bevelSegments: 4, bevelSize: 1.35, bevelThickness: 1.6 };
const FOV = 30;

// Dunkel: "Glow White" aus dem Prototyp. Hell: Studio-Schwarz, weniger metallisch als im Prototyp,
// damit die Seitenflächen Licht fangen und die Tiefe auf hellem Grund sichtbar bleibt.
const THEMES = {
  dark: {
    material: { color: 0xffffff, emissive: 0x142038, emissiveIntensity: 0.4, metalness: 0.25, roughness: 0.18 },
    ambient: 0.7,
    key: 2.5,
    rim: 0x0070ff,
    light: 0x9fd0ff,
    glow: 0x3d8bff,
    glowAdd: true,
  },
  light: {
    material: { color: 0x1a1a1a, emissive: 0x000000, emissiveIntensity: 0, metalness: 0.35, roughness: 0.32 },
    ambient: 0.6,
    key: 2.6,
    rim: 0x38bdf8,
    light: 0xffffff,
    glow: 0x1d8fff,
    glowAdd: false,
  },
};

// Feder für die Buchstaben-Physik (Werte aus dem Konzept: Dämpfung 0.88, Steifigkeit 0.08 bei 60 fps)
const STIFFNESS = 0.08;
const DAMPING = 0.88;
const CURSOR_LIGHT_INTENSITY = 2.4e4;
// Zäher Zug zum Cursor: weiche Feder, Buchstaben bleiben dabei fest
const PULL_STIFFNESS = 0.05;
const PULL_DAMPING = 0.9;
const PULL_MAX = 10; // größte Auslenkung eines Buchstabens (Welteinheiten)
const PULL_COUPLING = 0.4; // wie stark Nachbarbuchstaben mitgezogen werden
// Buchstabe mit der Maus greifen und ziehen
const DRAG_STIFFNESS = 0.22;
const DRAG_DAMPING = 0.74;
const DRAG_LIFT = 46; // wird beim Ziehen nach vorn gehoben
const RETURN_STIFFNESS = 0.1;
const RETURN_DAMPING = 0.8;
const HIT_TOLERANCE = 5; // Welteinheiten um die Silhouette
const HALO_SCALES = [
  { scale: 1.07, opacity: 0.85 },
  { scale: 1.17, opacity: 0.35 },
];

const { clamp } = THREE.MathUtils;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const rand = (min, max) => min + Math.random() * (max - min);

// Silhouette je Buchstabe (links/rechts je Zeile), damit sich Buchstaben beim Ziehen nie durchdringen
const ROW_Y0 = -62;
const ROW_N = 125;
// Beim Ziehen/Hovern halten benachbarte Buchstaben mindestens diesen Abstand (Welteinheiten) ein, damit sie
// nicht ineinander übergehen. Im Ruhezustand gilt wieder der Abstand des Logos.
const MIN_GAP_ACTIVE = 6;

function buildProfile(letter) {
  const left = new Float32Array(ROW_N).fill(Infinity);
  const right = new Float32Array(ROW_N).fill(-Infinity);
  letter.shapes.forEach(({ outer }) => {
    for (let e = 0; e < outer.length; e += 2) {
      const j = (e + 2) % outer.length;
      const [x1, y1, x2, y2] = [outer[e], outer[e + 1], outer[j], outer[j + 1]];
      if (y1 === y2) continue;
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      for (let k = Math.max(0, Math.ceil(lo - ROW_Y0)); k <= Math.min(ROW_N - 1, Math.floor(hi - ROW_Y0)); k++) {
        const x = x1 + (x2 - x1) * ((ROW_Y0 + k - y1) / (y2 - y1));
        if (x < left[k]) left[k] = x;
        if (x > right[k]) right[k] = x;
      }
    }
  });
  return { left, right };
}

// Kleinster waagerechter Abstand zwischen A (links) und B (rechts) bei den Verschiebungen a und b
function gapBetween(A, B, a, b) {
  let gap = Infinity;
  for (let k = 0; k < ROW_N; k++) {
    const ka = Math.round(k - a.y);
    const kb = Math.round(k - b.y);
    if (ka < 0 || ka >= ROW_N || kb < 0 || kb >= ROW_N) continue;
    const r = A.right[ka];
    const l = B.left[kb];
    if (r === -Infinity || l === Infinity) continue;
    const g = l + b.x - (r + a.x);
    if (g < gap) gap = g;
  }
  return gap;
}

function toShape(flat, ShapeType) {
  const shape = new ShapeType();
  shape.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) shape.lineTo(flat[i], flat[i + 1]);
  shape.closePath();
  return shape;
}

function buildLetterGeometry(letter) {
  const shapes = letter.shapes.map((s) => {
    const shape = toShape(s.outer, THREE.Shape);
    s.holes.forEach((h) => shape.holes.push(toShape(h, THREE.Path)));
    return shape;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, EXTRUDE);
  // Pivot in die Buchstabenmitte, damit jeder Buchstabe um sich selbst kippt
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  geo.computeVertexNormals();
  return { geo, center };
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Ein Wort der FOCUS FLOW Wortmarke als eigenständiges 3D-Objekt.
 * Jedes Wort hat seine eigene Szene: Es neigt sich zum Cursor, bezogen auf seine eigene Position,
 * und die Buchstaben weichen in Cursornähe federnd aus.
 *
 * Effekte:
 * - Einflug beim Laden (Buchstaben rasten per Feder ein)
 * - Cursor-Glow: Buchstaben in Cursornähe leuchten und bekommen einen blauen Schein (Halo)
 * - Lichtquelle am Cursor
 * - Zug zum Cursor: Buchstaben (und das Wort) werden fest, aber wie durch zähe Flüssigkeit zum Zeiger gezogen, Nachbarn gehen mit
 * - Ziehen: Buchstabe unter dem Zeiger greifen und über die ganze Seite ziehen; beim Loslassen federt er zurück
 * - `attention` + `attentionTargetRef`: Das Wort richtet sich auf das Ziel (die Login-Karte) aus
 * - `pulse`: kleiner Impuls bei jedem Tastendruck
 * - Handy: Neigen des Geräts ersetzt den Mauszeiger
 */
function Wordmark3D({ word, theme = 'light', attention = false, attentionTargetRef = null, pulse = 0, controlRef: externalControlRef = null }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const ownControlRef = useRef(null);
  // Optional von außen: Login ruft darüber `prepareExit` / `resume` auf
  const controlRef = externalControlRef || ownControlRef;
  const [failed, setFailed] = useState(false);
  // Aktuelle Eingaben für die Render-Schleife, ohne die Szene neu aufzubauen
  const inputRef = useRef({ attention, attentionTargetRef });
  inputRef.current = { attention, attentionTargetRef };

  useEffect(() => {
    if (pulse) controlRef.current?.pulse();
  }, [pulse]);

  // Szene einmal pro Wort aufbauen
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      console.warn('Wordmark3D: WebGL nicht verfügbar, nutze SVG.', err);
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);

    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(240, 380, 500);
    const fill = new THREE.DirectionalLight(0x88aacc, 1.3);
    fill.position.set(-320, -120, 260);
    const rim = new THREE.DirectionalLight(0x0070ff, 2.5);
    rim.position.set(0, 200, -250);
    const rimBottom = new THREE.DirectionalLight(0x38bdf8, 1.6);
    rimBottom.position.set(0, -300, -150);
    scene.add(ambient, key, fill, rim, rimBottom);

    // Lichtquelle am Cursor: liegt vor dem Wort und folgt dem Zeiger
    const cursorLight = new THREE.PointLight(0xffffff, 0, 520, 2);
    cursorLight.position.set(0, 0, 95);
    scene.add(cursorLight);

    const wordGroup = new THREE.Group();
    scene.add(wordGroup);

    const materials = [];
    const letters = WORDMARK[word].letters.map((letter, i) => {
      const { geo, center } = buildLetterGeometry(letter);
      // Eigenes Material je Buchstabe, damit jeder einzeln heller oder dunkler werden kann
      const material = new THREE.MeshStandardMaterial({ transparent: true });
      materials.push(material);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(center);
      // Schein um den Buchstaben: vergrößerte Rückseiten, leuchten nur in Cursornähe
      const halos = HALO_SCALES.map(({ scale }) => {
        const haloMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false });
        materials.push(haloMaterial);
        const halo = new THREE.Mesh(geo, haloMaterial);
        halo.scale.setScalar(scale);
        halo.renderOrder = -1;
        mesh.add(halo);
        return halo;
      });
      wordGroup.add(mesh);
      return {
        mesh,
        material,
        halos,
        index: i,
        base: center.clone(),
        offset: new THREE.Vector3(), // Federauslenkung (x/y/z)
        velocity: new THREE.Vector3(),
        pull: new THREE.Vector3(), // Zug zum Cursor (eigene, weichere Feder)
        pullVelocity: new THREE.Vector3(),
        tilt: new THREE.Vector3(), // Neigung (x/y) und Drehung (z)
        tiltVelocity: new THREE.Vector3(),
        glow: 0, // Cursor-Glow: 0 = aus, 1 = voll
        enter: 1, // Einflug: 0 = unsichtbar, 1 = da
        kickAt: 0, // Zeitpunkt, an dem der Buchstabe weggeschleudert wird
        kickPower: 1,
        dragging: false, // wird gerade mit der Maus gezogen
        returning: false, // federt nach dem Loslassen zurück
      };
    });

    // Kollisionsprofile: Je zwei benachbarte Buchstaben behalten mindestens ihren Ruheabstand, bei Zug/Hover mehr
    const profiles = WORDMARK[word].letters.map(buildProfile);
    const zero = { x: 0, y: 0 };
    const baseGaps = letters.slice(1).map((_, i) => gapBetween(profiles[i], profiles[i + 1], zero, zero));
    const shiftA = { x: 0, y: 0 };
    const shiftB = { x: 0, y: 0 };

    // Zeichenfläche und Kamera. Normal ragt die Fläche über den Layout-Kasten hinaus (einfliegende Buchstaben werden
    // nicht abgeschnitten). Beim Ziehen deckt sie das ganze Fenster ab (`wide`), damit der Buchstabe überall sichtbar bleibt.
    // Die Kamera bleibt dabei gleich, nur der Bildausschnitt (setViewOffset) wandert mit.
    let wide = false;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const viewOffset = () => {
      const boxW = Math.max(container.clientWidth, 1);
      const boxH = Math.max(container.clientHeight, 1);
      const stageW = boxW * (1 + 2 * STAGE_PAD_X);
      const stageH = boxH * (1 + 2 * STAGE_PAD_Y);
      const r = container.getBoundingClientRect();
      camera.setViewOffset(stageW, stageH, -(r.left - boxW * STAGE_PAD_X), -(r.top - boxH * STAGE_PAD_Y), window.innerWidth, window.innerHeight);
    };
    const layout = () => {
      const boxW = Math.max(container.clientWidth, 1);
      const boxH = Math.max(container.clientHeight, 1);
      const stageW = boxW * (1 + 2 * STAGE_PAD_X);
      const stageH = boxH * (1 + 2 * STAGE_PAD_Y);
      const style = renderer.domElement.style;
      camera.aspect = stageW / stageH;
      const distH = (WORDMARK_FRAME.height * (1 + 2 * STAGE_PAD_Y)) / 2 / tan;
      const distW = (WORDMARK_FRAME.width * (1 + 2 * STAGE_PAD_X)) / 2 / (tan * camera.aspect);
      camera.position.set(0, 0, Math.max(distH, distW) + EXTRUDE.depth);
      camera.lookAt(0, 0, 0);
      if (wide) {
        Object.assign(style, { position: 'fixed', left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, zIndex: '30' });
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        viewOffset();
      } else {
        camera.clearViewOffset();
        Object.assign(style, {
          position: 'absolute',
          // Feste Pixelwerte statt Prozent: Nach dem Wechsel von `fixed` löst Chrome Prozentwerte sonst
          // gegen das Fenster statt gegen den Kasten auf (Wortmarke erschien riesig).
          left: `${-boxW * STAGE_PAD_X}px`,
          top: `${-boxH * STAGE_PAD_Y}px`,
          width: `${stageW}px`,
          height: `${stageH}px`,
          zIndex: '',
        });
        renderer.setSize(stageW, stageH, false);
      }
      camera.updateProjectionMatrix();
      renderer.render(scene, camera); // setSize leert die Fläche – sofort neu zeichnen
    };
    const setWide = (next) => {
      if (wide === next) return;
      wide = next;
      layout();
    };
    layout();
    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(container);
    window.addEventListener('resize', layout);

    const reducedMotion = prefersReducedMotion();

    // Chaos → Ordnung: Buchstaben fliegen versetzt weg und rasten per Feder wieder ein
    const scramble = (power = 1, baseDelay = 0) => {
      if (reducedMotion) return;
      const now = performance.now();
      letters.forEach((l) => {
        l.kickAt = now + baseDelay + l.index * 55;
        l.kickPower = power;
      });
    };
    // Kleiner Hüpfer bei jedem Tastendruck
    const pulseLetters = () => {
      if (reducedMotion) return;
      letters.forEach((l) => { l.velocity.z -= 1.6 + l.index * 0.15; });
    };

    // Cursor/Finger global verfolgen: Das Wort reagiert auch, wenn der Cursor neben ihm ist
    const pointer = { x: 0, y: 0, active: false };
    let usingMouse = false;
    const drag = { letter: null, grabX: 0, grabY: 0, pointerId: null };

    // Buchstabe unter dem Zeiger (Silhouette plus Toleranz), sonst null
    const hitLetter = (clientX, clientY) => {
      const r = container.getBoundingClientRect();
      const k = WORDMARK_FRAME.width / Math.max(r.width, 1);
      const wx = (clientX - (r.left + r.width / 2)) * k;
      const wy = ((r.top + r.height / 2) - clientY) * k;
      let best = null;
      let bestDist = Infinity;
      letters.forEach((l) => {
        if (l.enter < 1) return;
        const sx = wx - l.offset.x - l.pull.x;
        const sy = wy - l.offset.y - l.pull.y;
        const row = Math.round(sy - ROW_Y0);
        if (row < 0 || row >= ROW_N) return;
        const prof = profiles[l.index];
        if (sx < prof.left[row] - HIT_TOLERANCE || sx > prof.right[row] + HIT_TOLERANCE) return;
        const d = Math.hypot(sx - l.base.x, sy - l.base.y);
        if (d < bestDist) {
          best = l;
          bestDist = d;
        }
      });
      return best ? { letter: best, wx, wy } : null;
    };
    const endDrag = () => {
      if (!drag.letter) return;
      drag.letter.dragging = false;
      drag.letter.returning = true; // federt zurück, bis er wieder an seinem Platz ist
      drag.letter = null;
      drag.pointerId = null;
      document.body.style.userSelect = '';
      container.style.cursor = '';
    };
    const onPointerMove = (e) => {
      usingMouse = e.pointerType === 'mouse';
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      if (!drag.letter && usingMouse && !reducedMotion) {
        const r = container.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        container.style.cursor = inside && hitLetter(e.clientX, e.clientY) ? 'grab' : '';
      }
    };
    const onPointerLeave = () => { pointer.active = false; };
    const onPointerDown = (e) => {
      if (reducedMotion || exiting || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const hit = hitLetter(e.clientX, e.clientY);
      if (!hit) return;
      const { letter } = hit;
      drag.letter = letter;
      drag.pointerId = e.pointerId;
      drag.grabX = hit.wx - letter.base.x - letter.offset.x - letter.pull.x;
      drag.grabY = hit.wy - letter.base.y - letter.offset.y - letter.pull.y;
      letter.dragging = true;
      letter.returning = false;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      document.body.style.userSelect = 'none';
      container.style.cursor = 'grabbing';
      setWide(true);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    container.style.touchAction = 'pan-y';

    // Handy: Neigen des Geräts ersetzt den Mauszeiger
    const onOrientation = (e) => {
      if (reducedMotion || usingMouse || e.gamma == null || e.beta == null) return;
      pointer.x = window.innerWidth * (0.5 + clamp(e.gamma / 30, -1, 1) * 0.5);
      pointer.y = window.innerHeight * (0.5 + clamp((e.beta - 50) / 30, -1, 1) * 0.5);
      pointer.active = true;
    };
    let askPermission = null;
    if (!reducedMotion && typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS: Die Erlaubnis lässt sich nur nach einer Berührung anfragen
        askPermission = () => {
          DeviceOrientationEvent.requestPermission()
            .then((state) => { if (state === 'granted') window.addEventListener('deviceorientation', onOrientation); })
            .catch(() => {});
        };
        window.addEventListener('pointerdown', askPermission, { once: true });
      } else {
        window.addEventListener('deviceorientation', onOrientation);
      }
    }

    const phase = word === 'FOCUS' ? 0 : Math.PI; // Beide Wörter schweben gegenläufig
    const goal = new THREE.Vector3();
    const pull = new THREE.Vector3();
    let rafId = 0;
    let last = performance.now();

    // Einflug beim ersten Laden: FOCUS zuerst, dann FLOW
    if (!reducedMotion) {
      letters.forEach((l) => { l.enter = 0; l.mesh.visible = false; });
      scramble(2.2, word === 'FOCUS' ? 150 : 650);
    }

    // Vor dem Login: Wort richtet sich gerade aus, kommt zur Ruhe und wird als Bild festgehalten.
    // Das Bild fliegt danach (BrandFlight) in die Kopfzeile, ohne dass das 3D-Modell sichtbar zu 2D springt.
    let exiting = false;
    const snapshot = () => {
      try {
        setWide(false);
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    };
    // `immediate`: sofort festhalten (z. B. Google-Popup, das eine direkte Nutzergeste braucht)
    const prepareExit = (immediate = false) => new Promise((resolve) => {
      if (immediate) {
        resolve(snapshot());
        return;
      }
      endDrag();
      exiting = true;
      const started = performance.now();
      const settled = () => (
        Math.abs(wordGroup.rotation.x) < 0.006
        && Math.abs(wordGroup.rotation.y) < 0.006
        && !wide
        && letters.every((l) => l.enter >= 1 && l.kickAt === 0 && l.offset.lengthSq() < 0.15
          && l.pull.lengthSq() < 0.15 && l.velocity.lengthSq() < 0.002 && l.tilt.lengthSq() < 1e-4 && l.glow < 0.02)
      );
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(snapshot());
      };
      const check = () => {
        if (done) return;
        if (!settled() && performance.now() - started < 800) {
          requestAnimationFrame(check);
          return;
        }
        finish();
      };
      requestAnimationFrame(check);
      // Falls der Tab im Hintergrund steht (keine Frames), trotzdem weiter
      setTimeout(finish, 1000);
    });
    controlRef.current = { scramble, pulse: pulseLetters, prepareExit, resume: () => { exiting = false; } };

    const glowColor = new THREE.Color();
    const smoothPointer = { x: 0, y: 0, ready: false };
    const pullGoals = letters.map(() => new THREE.Vector3());
    const tiltGoal = new THREE.Vector3();
    const pullGoal = new THREE.Vector3();
    const finalGoals = letters.map(() => new THREE.Vector3());
    const emissiveColor = new THREE.Color();

    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      const step = Math.min((now - last) / 16.667, 3); // Frames relativ zu 60 fps
      last = now;
      const t = now / 1000;
      const clock = performance.now();
      const preset = sceneRef.current?.preset || THEMES.light;

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const worldPerPx = WORDMARK_FRAME.width / Math.max(rect.width, 1);

      // Eingabe im Formular: Das Wort richtet sich auf die Karte aus und leuchtet leicht
      const { attention: engaged, attentionTargetRef: targetRef } = inputRef.current;
      const targetEl = engaged && !reducedMotion && !exiting ? targetRef?.current : null;
      let px = pointer.x;
      let py = pointer.y;
      let pointerOn = pointer.active && !reducedMotion && !exiting;
      let gain = 1;
      if (targetEl) {
        const tr = targetEl.getBoundingClientRect();
        px = tr.left + tr.width / 2;
        py = tr.top + tr.height / 2;
        pointerOn = true;
        gain = 1.8;
      }

      // 1. Ganzes Wort neigt sich zum Cursor, bezogen auf die eigene Mitte
      let nx = 0;
      let ny = 0;
      if (pointerOn) {
        nx = clamp(((px - cx) / (window.innerWidth * 0.5)) * gain, -1, 1);
        ny = clamp(((cy - py) / (window.innerHeight * 0.5)) * gain, -1, 1);
      }
      const ease = 1 - Math.pow(1 - (exiting ? 0.2 : 0.07), step);
      let bobY = 0;
      wordGroup.rotation.y += (nx * 0.24 - wordGroup.rotation.y) * ease;
      wordGroup.rotation.x += (-ny * 0.16 - wordGroup.rotation.x) * ease;
      const bob = reducedMotion || exiting ? 0 : Math.sin(t * 1.2 + phase) * 2.5;
      bobY = bob;

      // 2. Nähe des Cursors zum ganzen Wort: steuert Glow und Lichtquelle
      const wordDist = Math.hypot(px - cx, py - cy);
      const proximity = pointerOn ? (targetEl ? 1 : 1 - smooth(rect.width * 0.5, rect.width * 1.1, wordDist)) : 0;
      cursorLight.intensity += (proximity * CURSOR_LIGHT_INTENSITY - cursorLight.intensity) * ease;
      if (pointerOn) {
        cursorLight.position.set(
          clamp((px - cx) * worldPerPx, -WORDMARK_FRAME.width, WORDMARK_FRAME.width),
          clamp((cy - py) * worldPerPx, -WORDMARK_FRAME.height, WORDMARK_FRAME.height),
          95,
        );
      }

      // Weich nachgeführter Zeiger: Mausruckler übertragen sich nicht auf die Buchstaben
      if (pointerOn) {
        if (!smoothPointer.ready) {
          smoothPointer.x = px;
          smoothPointer.y = py;
          smoothPointer.ready = true;
        }
        const follow = 1 - Math.pow(1 - 0.16, step);
        smoothPointer.x += (px - smoothPointer.x) * follow;
        smoothPointer.y += (py - smoothPointer.y) * follow;
      } else {
        smoothPointer.ready = false;
      }

      // Zug zum Cursor: Jeder Buchstabe wird Richtung Zeiger gezogen (am stärksten im mittleren Abstand,
      // direkt unter dem Zeiger hängt er nur), Nachbarn gehen über die Kopplung mit, das ganze Wort driftet leicht mit.
      const pullRadius = WORDMARK_FRAME.width * 0.26;
      const wx = (smoothPointer.x - cx) * worldPerPx;
      const wy = (cy - smoothPointer.y) * worldPerPx;
      const dragged = drag.letter;
      const pulling = pointerOn && !targetEl && !exiting && !dragged;
      letters.forEach((l, i) => {
        const g = pullGoals[i];
        g.set(0, 0, 0);
        if (!pulling) return;
        const dx = wx - l.base.x;
        const dy = wy - l.base.y;
        const dist = Math.hypot(dx, dy);
        const falloff = 1 - smooth(pullRadius * 0.6, pullRadius * 1.5, dist);
        if (falloff <= 0 || dist < 0.001) return;
        const len = Math.min(dist * 0.5, PULL_MAX) * falloff;
        g.set((dx / dist) * len, (dy / dist) * len * 0.4, falloff * 7);
      });
      // Eigenes Ziel je Buchstabe: eigener Zug plus anteilig der Nachbarn. Wird ein Buchstabe gezogen,
      // folgt er dem Zeiger genau (ohne Glättung), seine Nachbarn werden nur ein Stück mitgezogen.
      letters.forEach((l, i) => {
        const g = finalGoals[i];
        g.copy(pullGoals[i]);
        if (i > 0) g.addScaledVector(pullGoals[i - 1], PULL_COUPLING * 0.5);
        if (i < letters.length - 1) g.addScaledVector(pullGoals[i + 1], PULL_COUPLING * 0.5);
      });
      if (dragged) {
        const rawX = (pointer.x - cx) * worldPerPx;
        const rawY = (cy - pointer.y) * worldPerPx;
        const target = finalGoals[dragged.index];
        target.set(rawX - drag.grabX - dragged.base.x - dragged.offset.x, rawY - drag.grabY - dragged.base.y - dragged.offset.y, DRAG_LIFT);
        letters.forEach((l, i) => {
          if (l === dragged) return;
          const rank = Math.abs(i - dragged.index);
          const g = finalGoals[i];
          g.set(0, 0, 0);
          const factor = rank === 1 ? 0.14 : rank === 2 ? 0.05 : 0;
          if (factor) g.set(target.x * factor, target.y * factor, 0).clampLength(0, 14);
        });
      }
      const driftX = pulling ? clamp(wx * 0.05, -7, 7) * proximity : 0;
      const driftY = pulling ? clamp(wy * 0.05, -5, 5) * proximity : 0;
      wordGroup.position.x += (driftX - wordGroup.position.x) * ease * 0.6;
      wordGroup.position.y += (driftY + bobY - wordGroup.position.y) * ease * 0.6;

      // 3. Buchstaben: Einflug/Wirbeln per Feder, leichte Welle, Glow in Cursornähe.
      // Die Buchstaben selbst weichen dem Cursor nicht aus (das wirkte unruhig).
      const radius = rect.width * 0.22;
      glowColor.setHex(preset.glow);
      letters.forEach((l, li) => {
        if (l.kickAt && clock >= l.kickAt) {
          const p = l.kickPower;
          l.offset.set(rand(-70, 70) * p, rand(-45, 45) * p, rand(-60, 20) * p - (p > 1.5 ? 200 : 0));
          l.velocity.set(0, 0, 0);
          l.tilt.set(
            rand(-0.9, 0.9) * p,
            (Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1) * Math.PI * 2 * Math.min(p, 1.2),
            rand(-0.9, 0.9) * p,
          );
          l.tiltVelocity.set(0, 0, 0);
          l.kickAt = 0;
          l.mesh.visible = true;
        }

        let glowGoal = 0;
        if (l.dragging) {
          glowGoal = 1;
        } else if (pointerOn) {
          if (targetEl) {
            glowGoal = 0.45;
          } else {
            const dist = Math.hypot(px - (cx + l.base.x / worldPerPx), py - (cy - l.base.y / worldPerPx));
            glowGoal = proximity * (1 - smooth(radius * 0.35, radius * 1.6, dist));
          }
        }
        l.glow += (glowGoal - l.glow) * ease * 0.8;
        if (l.enter < 1 && l.mesh.visible) l.enter = Math.min(1, l.enter + step / 22);
        l.material.opacity = l.enter;
        emissiveColor.setHex(preset.material.emissive).lerp(glowColor, Math.min(l.glow * 1.2, 1));
        l.material.emissive.copy(emissiveColor);
        l.material.emissiveIntensity = preset.material.emissiveIntensity + l.glow * 1.1;
        l.halos.forEach((halo, h) => {
          halo.material.color.copy(glowColor);
          halo.material.blending = preset.glowAdd ? THREE.AdditiveBlending : THREE.NormalBlending;
          halo.material.opacity = l.glow * HALO_SCALES[h].opacity * l.enter;
          halo.visible = halo.material.opacity > 0.004;
        });

        const wave = reducedMotion || exiting ? 0 : Math.sin(t * 1.6 + l.index * 0.6 + phase) * 1.4;
        goal.set(0, wave, 0);

        // Ziel des Zugs (inkl. Nachbarn) und Neigung in Zugrichtung
        const own = pullGoals[li];
        pullGoal.copy(finalGoals[li]);
        if (l.returning) {
          // zurückfedernder Buchstabe bleibt vorn, bis er fast wieder an seinem Platz ist
          pullGoal.set(finalGoals[li].x, finalGoals[li].y, clamp(Math.hypot(l.pull.x, l.pull.y) / 40, 0, 1) * DRAG_LIFT);
        }
        const lean = l.dragging ? finalGoals[li] : own;
        tiltGoal.set(clamp(lean.y, -12, 12) * 0.012, clamp(lean.x, -12, 12) * (l.dragging ? 0.01 : 0), -clamp(lean.x, -12, 12) * (l.dragging ? 0.012 : 0.006));
        const pullK = l.dragging ? DRAG_STIFFNESS : l.returning ? RETURN_STIFFNESS : PULL_STIFFNESS;
        const pullD = l.dragging ? DRAG_DAMPING : l.returning ? RETURN_DAMPING : PULL_DAMPING;
        if (l.returning && l.pull.lengthSq() < 1 && l.pullVelocity.lengthSq() < 0.01) l.returning = false;

        for (let s = 0; s < Math.ceil(step); s++) {
          l.velocity.addScaledVector(pull.subVectors(goal, l.offset), STIFFNESS).multiplyScalar(DAMPING);
          l.offset.add(l.velocity);
          l.pullVelocity.addScaledVector(pull.subVectors(pullGoal, l.pull), pullK).multiplyScalar(pullD);
          l.pull.add(l.pullVelocity);
          l.tiltVelocity.addScaledVector(pull.subVectors(tiltGoal, l.tilt), STIFFNESS).multiplyScalar(DAMPING);
          l.tilt.add(l.tiltVelocity);
        }
      });

      // Harter Anschlag: Berühren sich zwei Buchstaben, schieben sie sich gegenseitig weg statt ineinander zu gehen.
      // Nur im Ruhezustand, während Einflug/Wirbeln dürfen sie durcheinanderfliegen.
      const calm = letters.every((l) => l.dragging || l.returning || (l.enter >= 1 && l.offset.lengthSq() < 9 && l.tilt.lengthSq() < 0.01));
      if (calm) {
        for (let iter = 0; iter < 6; iter++) {
          for (let i = 0; i < letters.length - 1; i++) {
            const a = letters[i];
            const b = letters[i + 1];
            // Der gezogene oder zurückfliegende Buchstabe ist angehoben und darf über die anderen hinweg
            if (a.dragging || a.returning || b.dragging || b.returning) continue;
            // Bei Zug/Hover mehr Luft zwischen den Buchstaben als im Ruhezustand
            const engage = smooth(1.5, 5, Math.max(Math.hypot(a.pull.x, a.pull.y), Math.hypot(b.pull.x, b.pull.y)));
            const limit = baseGaps[i] + Math.max(MIN_GAP_ACTIVE - baseGaps[i], 0) * engage;
            shiftA.x = a.offset.x + a.pull.x;
            shiftA.y = a.offset.y + a.pull.y;
            shiftB.x = b.offset.x + b.pull.x;
            shiftB.y = b.offset.y + b.pull.y;
            const deficit = limit - gapBetween(profiles[i], profiles[i + 1], shiftA, shiftB);
            if (deficit > 0 && deficit < 40) {
              a.pull.x -= deficit / 2;
              b.pull.x += deficit / 2;
              a.pullVelocity.x = Math.min(a.pullVelocity.x, 0);
              b.pullVelocity.x = Math.max(b.pullVelocity.x, 0);
            }
          }
        }
      }
      letters.forEach((l) => {
        l.mesh.position.copy(l.base).add(l.offset).add(l.pull);
        l.mesh.rotation.set(l.tilt.x, l.tilt.y, l.tilt.z);
      });

      // Breite Zeichenfläche (Ziehen) folgt dem Seitenausschnitt und endet, sobald alles wieder an seinem Platz ist
      if (wide) {
        if (!drag.letter && letters.every((l) => !l.returning)) setWide(false);
        else viewOffset();
      }

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    sceneRef.current = { letters, ambient, key, rim, cursorLight, preset: THEMES.light };

    return () => {
      cancelAnimationFrame(rafId);
      controlRef.current = null;
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('deviceorientation', onOrientation);
      if (askPermission) window.removeEventListener('pointerdown', askPermission);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('blur', endDrag);
      window.removeEventListener('resize', layout);
      document.body.style.userSelect = '';
      letters.forEach((l) => l.mesh.geometry.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss(); // WebGL-Kontext sofort freigeben (Browser erlauben nur wenige)
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [word]);

  // Hell/Dunkel ohne Neuaufbau der Geometrie umschalten
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const preset = THEMES[theme] || THEMES.light;
    s.preset = preset;
    s.letters.forEach((l) => l.material.setValues({ ...preset.material, emissive: l.material.emissive }));
    s.cursorLight.color.setHex(preset.light);
    s.ambient.intensity = preset.ambient;
    s.key.intensity = preset.key;
    s.rim.color.setHex(preset.rim);
  }, [theme, word, failed]);

  if (failed) return <WordmarkSvg word={word} />;
  return <div ref={containerRef} className="relative w-full h-full" />;
}

export default Wordmark3D;
