import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORDMARK, WORDMARK_FRAME } from './focusFlowWordmarkData';
import WordmarkSvg from './WordmarkSvg';

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
  },
  light: {
    material: { color: 0x1a1a1a, emissive: 0x000000, emissiveIntensity: 0, metalness: 0.35, roughness: 0.32 },
    ambient: 0.6,
    key: 2.6,
    rim: 0x38bdf8,
  },
};

// Feder für die Buchstaben-Physik (Werte aus dem Konzept: Dämpfung 0.88, Steifigkeit 0.08 bei 60 fps)
const STIFFNESS = 0.08;
const DAMPING = 0.88;

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
 */
function Wordmark3D({ word, theme = 'light' }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [failed, setFailed] = useState(false);

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
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
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

    const material = new THREE.MeshStandardMaterial();
    const wordGroup = new THREE.Group();
    scene.add(wordGroup);

    const letters = WORDMARK[word].letters.map((letter, i) => {
      const { geo, center } = buildLetterGeometry(letter);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(center);
      wordGroup.add(mesh);
      return {
        mesh,
        index: i,
        base: center.clone(),
        offset: new THREE.Vector3(), // Federauslenkung (x/y/z)
        velocity: new THREE.Vector3(),
        tilt: new THREE.Vector2(), // Neigung in Cursornähe (x/y)
        tiltVelocity: new THREE.Vector2(),
      };
    });

    // Kamera so setzen, dass der gemeinsame Bildausschnitt genau in den Container passt
    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const distH = WORDMARK_FRAME.height / 2 / tan;
      const distW = WORDMARK_FRAME.width / 2 / (tan * camera.aspect);
      camera.position.set(0, 0, Math.max(distH, distW) + EXTRUDE.depth);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera); // setSize leert die Fläche – sofort neu zeichnen
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Cursor/Finger global verfolgen: Das Wort reagiert auch, wenn der Cursor neben ihm ist
    const pointer = { x: 0, y: 0, active: false };
    const onPointerMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => { pointer.active = false; };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);

    const reducedMotion = prefersReducedMotion();
    const phase = word === 'FOCUS' ? 0 : Math.PI; // Beide Wörter schweben gegenläufig
    const goal = new THREE.Vector3();
    const pull = new THREE.Vector3();
    let rafId = 0;
    let last = performance.now();

    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      const step = Math.min((now - last) / 16.667, 3); // Frames relativ zu 60 fps
      last = now;
      const t = now / 1000;

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const worldPerPx = WORDMARK_FRAME.width / Math.max(rect.width, 1);

      // 1. Ganzes Wort neigt sich zum Cursor, bezogen auf die eigene Mitte
      let nx = 0;
      let ny = 0;
      if (pointer.active && !reducedMotion) {
        nx = THREE.MathUtils.clamp((pointer.x - cx) / (window.innerWidth * 0.5), -1, 1);
        ny = THREE.MathUtils.clamp((cy - pointer.y) / (window.innerHeight * 0.5), -1, 1);
      }
      const ease = 1 - Math.pow(1 - 0.07, step);
      wordGroup.rotation.y += (nx * 0.24 - wordGroup.rotation.y) * ease;
      wordGroup.rotation.x += (-ny * 0.16 - wordGroup.rotation.x) * ease;
      wordGroup.position.y = reducedMotion ? 0 : Math.sin(t * 1.2 + phase) * 2.5;

      // 2. Buchstaben: Welle + federndes Ausweichen in Cursornähe
      const radius = rect.width * 0.22;
      letters.forEach((l) => {
        let target = 0;
        let tiltX = 0;
        let tiltY = 0;
        if (pointer.active && !reducedMotion) {
          const lx = cx + l.base.x / worldPerPx;
          const ly = cy - l.base.y / worldPerPx;
          const dx = pointer.x - lx;
          const dy = pointer.y - ly;
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            const k = 1 - dist / radius;
            const influence = k * k * (3 - 2 * k); // smoothstep
            target = influence;
            tiltY = -Math.sign(dx) * influence * 0.35; // vom Cursor wegkippen
            tiltX = Math.sign(dy) * influence * 0.2;
          }
        }
        const wave = reducedMotion ? 0 : Math.sin(t * 1.6 + l.index * 0.6 + phase) * 1.4;
        goal.set(0, wave, -target * 22);

        for (let s = 0; s < Math.ceil(step); s++) {
          l.velocity.addScaledVector(pull.subVectors(goal, l.offset), STIFFNESS).multiplyScalar(DAMPING);
          l.offset.add(l.velocity);
          l.tiltVelocity.x = (l.tiltVelocity.x + (tiltX - l.tilt.x) * STIFFNESS) * DAMPING;
          l.tiltVelocity.y = (l.tiltVelocity.y + (tiltY - l.tilt.y) * STIFFNESS) * DAMPING;
          l.tilt.add(l.tiltVelocity);
        }
        l.mesh.position.copy(l.base).add(l.offset);
        l.mesh.rotation.set(l.tilt.x, l.tilt.y, 0);
      });

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    sceneRef.current = { material, ambient, key, rim };

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      letters.forEach((l) => l.mesh.geometry.dispose());
      material.dispose();
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
    s.material.setValues(preset.material);
    s.ambient.intensity = preset.ambient;
    s.key.intensity = preset.key;
    s.rim.color.setHex(preset.rim);
  }, [theme, word, failed]);

  if (failed) return <WordmarkSvg word={word} />;
  return <div ref={containerRef} className="w-full h-full" />;
}

export default Wordmark3D;
