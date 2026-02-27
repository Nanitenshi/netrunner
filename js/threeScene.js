import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js";

let scene, camera, renderer, clock;
let cityMesh, cityGeo, cityMat;
let running = true;

let mood = 0;           // 0..1
let quality = "quality"; // quality|perf
let targetFps = 60;
let lastFrameTime = 0;

// city params (changed by quality)
let cityDensity = 1.0;  // 1.0 = full, 0.55 = perf
let dprCap = 1.5;

export function initThree(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1800);
  camera.position.set(0, 28, 70);

  // light cheap
  scene.add(new THREE.AmbientLight(0x0a1220, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 0.55);
  dl.position.set(40, 60, 30);
  scene.add(dl);

  scene.fog = new THREE.FogExp2(0x05070a, 0.015);

  buildCity();

  window.addEventListener("resize", () => {
    if (!renderer || !camera) return;
    renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  renderer.setAnimationLoop(renderLoop);
}

export function setMoodProgress(p) {
  mood = Math.max(0, Math.min(1, p));
  applyMood();
}

export function setThreeRunning(on) {
  running = !!on;
}

export function setThreeQuality(mode) {
  const next = (mode === "perf") ? "perf" : "quality";
  if (quality === next) return;
  quality = next;

  // Tune for tablet
  if (quality === "perf") {
    targetFps = 30;
    dprCap = 1.0;
    cityDensity = 0.55;
  } else {
    targetFps = 60;
    dprCap = 1.5;
    cityDensity = 1.0;
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  // rebuild city with new density
  buildCity(true);
}

function buildCity(rebuild = false) {
  if (rebuild && cityMesh) {
    scene.remove(cityMesh);
    cityGeo?.dispose?.();
    cityMat?.dispose?.();
    cityMesh = null;
  }

  // Instancing
  const gridX = 29;
  const gridZ = 21;

  cityGeo = new THREE.BoxGeometry(1, 1, 1);

  // Fake neon: emissive glow-ish (cheap)
  cityMat = new THREE.MeshStandardMaterial({
    color: 0x0b1017,
    roughness: 0.9,
    metalness: 0.15,
    emissive: new THREE.Color(0x001018),
    emissiveIntensity: 0.85
  });

  const max = gridX * gridZ;
  cityMesh = new THREE.InstancedMesh(cityGeo, cityMat, max);

  const dummy = new THREE.Object3D();
  let count = 0;

  for (let x = -14; x <= 14; x++) {
    for (let z = -10; z <= 10; z++) {
      // density cut
      if (Math.random() > cityDensity) continue;
      if (Math.random() < 0.20) continue; // empty lots

      const h = 4 + Math.random() * 38;
      const sx = 2.2 + Math.random() * 0.6;
      const sz = 2.2 + Math.random() * 0.6;

      dummy.scale.set(sx, h, sz);
      dummy.position.set(x * 3.2, h / 2, z * 3.4);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();

      cityMesh.setMatrixAt(count, dummy.matrix);
      count++;
    }
  }

  cityMesh.count = count;
  scene.add(cityMesh);

  applyMood();
}

function applyMood() {
  if (!scene || !cityMat) return;

  // day -> dusk -> night
  const dayToSun = Math.min(1, mood * 2);
  const sunToNight = Math.max(0, (mood - 0.5) * 2);

  const day = new THREE.Color(0x0a1220);
  const dusk = new THREE.Color(0x1b0f2a);
  const night = new THREE.Color(0x05070a);

  const c1 = day.clone().lerp(dusk, dayToSun);
  const final = c1.clone().lerp(night, sunToNight);

  scene.fog.color.copy(final);

  // emissive gets stronger at night
  cityMat.emissive = new THREE.Color(0x001018).lerp(new THREE.Color(0x240010), sunToNight);
  cityMat.emissiveIntensity = 0.75 + sunToNight * 1.15;
  cityMat.needsUpdate = true;
}

function renderLoop(nowMs) {
  if (!renderer || !scene || !camera) return;

  // pause during mission => huge perf
  if (!running) return;

  // fps cap (perf mode)
  const frameMin = 1000 / targetFps;
  if (nowMs - lastFrameTime < frameMin) return;
  lastFrameTime = nowMs;

  const t = clock.getElapsedTime();

  camera.position.x = Math.sin(t * 0.2) * 6;
  camera.position.z = 70 + Math.cos(t * 0.1) * 3;
  camera.lookAt(0, 10, 0);

  renderer.render(scene, camera);
}
