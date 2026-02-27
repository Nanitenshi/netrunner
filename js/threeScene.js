import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js";

let scene, camera, renderer, clock;
let cityInstancedMesh;
let lights = [];
let ambientLight, dirLight;

let currentMood = 0; // 0..1
let lastRenderedMood = -1; // Zum Cachen des Zustands

export function initThree(canvas) {
  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); // Antialias false für Performance (besonders auf Tablet)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  // Kamera Setup
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 28, 70);

  // Basis-Beleuchtung
  ambientLight = new THREE.AmbientLight(0x0a1220, 0.8); // Farbe ändert sich später mit der Mood
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(40, 60, 30);
  scene.add(dirLight);

  // Nebel
  scene.fog = new THREE.FogExp2(0x05070a, 0.015);

  buildCity();

  // Resize Handler
  window.addEventListener("resize", () => {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Render Loop starten
  renderer.setAnimationLoop(anim);
}

function buildCity() {
  const gridX = 29; // -14 to 14
  const gridZ = 21; // -10 to 10
  const maxBuildings = gridX * gridZ;

  // Gemeinsame Geometrie und Material für alle Gebäude
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0b1017,
    roughness: 0.8,
    metalness: 0.25
  });

  // InstancedMesh = 1 Draw Call für die ganze Stadt!
  cityInstancedMesh = new THREE.InstancedMesh(geo, mat, maxBuildings);
  const dummy = new THREE.Object3D();
  let buildingCount = 0;

  for (let x = -14; x <= 14; x++) {
    for (let z = -10; z <= 10; z++) {
      if (Math.random() < 0.35) continue; // Freie Flächen

      const h = 4 + Math.random() * 38;
      
      // Transformieren des "Dummys" und in das InstancedMesh schreiben
      dummy.scale.set(2.2, h, 2.2);
      dummy.position.set(x * 3.2, h / 2, z * 3.4);
      dummy.updateMatrix();
      cityInstancedMesh.setMatrixAt(buildingCount, dummy.matrix);
      
      buildingCount++;

      // Neon Strips (Stark limitiert auf max. ~25 Lichter für WebGL Performance)
      // Bei InstancedMesh kann man Lichter nicht als Kind anhängen, sie müssen in die Scene.
      if (lights.length < 25) {
        if (Math.random() < 0.06) {
          const n = new THREE.PointLight(0x00f3ff, 1.0, 28, 2);
          n.position.set(dummy.position.x, Math.min(h - 2, 10 + Math.random() * 12), dummy.position.z);
          lights.push(n);
          scene.add(n);
        } else if (Math.random() < 0.04) {
          const p = new THREE.PointLight(0xff007c, 0.8, 22, 2);
          p.position.set(dummy.position.x + 0.7, Math.min(h - 2, 10 + Math.random() * 14), dummy.position.z + 0.2);
          lights.push(p);
          scene.add(p);
        }
      }
    }
  }

  // Wichtig: Dem Mesh sagen, dass wir nur die tatsächlich genutzten Plätze rendern
  cityInstancedMesh.count = buildingCount;
  scene.add(cityInstancedMesh);
}

// Wird von core.js aufgerufen
export function setMoodProgress(p) {
  currentMood = Math.max(0, Math.min(1, p));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function anim() {
  const time = clock.getElapsedTime();

  // Kamerabewegung (sanftes Schweben)
  camera.position.x = Math.sin(time * 0.2) * 6;
  camera.position.z = 70 + Math.cos(time * 0.1) * 3; // Leichtes Vor/Zurück
  camera.lookAt(0, 10, 0);

  // Mood nur updaten, wenn sie sich geändert hat (spart immens CPU!)
  if (Math.abs(currentMood - lastRenderedMood) > 0.005) {
    applyMood(currentMood);
    lastRenderedMood = currentMood;
  }

  renderer.render(scene, camera);
}

function applyMood(mood) {
  // Map: 0.0(Day) -> 0.5(Sunset) -> 1.0(Night)
  const dayToSunset = Math.min(1, mood * 2); 
  const sunsetToNight = Math.max(0, (mood - 0.5) * 2);

  const skyDay = new THREE.Color(0x0a1220);
  const skySun = new THREE.Color(0x1b0f2a);
  const skyNight = new THREE.Color(0x05070a);

  // AmbientLight Farbe anpassen (wichtig für InstancedMesh, da wir nicht jedes Gebäude-Material ändern wollen)
  const c1 = skyDay.clone().lerp(skySun, dayToSunset);
  const finalColor = c1.clone().lerp(skyNight, sunsetToNight);
  
  scene.fog.color.copy(finalColor);
  ambientLight.color.copy(finalColor);

  // Directional Light wird abends schwächer und wärmer, nachts dunkel
  dirLight.intensity = lerp(0.8, 0.1, mood);

  // Neon-Intensität wächst mit der Nacht
  const neonBoost = lerp(0.0, 1.8, sunsetToNight); // Leuchten erst ab Sonnenuntergang
  lights.forEach(l => {
    l.intensity = neonBoost;
  });

  // Gebäude-Material global anpassen
  if (cityInstancedMesh) {
    cityInstancedMesh.material.roughness = lerp(0.65, 0.95, mood);
    cityInstancedMesh.material.metalness = lerp(0.35, 0.15, mood);
    cityInstancedMesh.material.needsUpdate = true;
  }
    }
