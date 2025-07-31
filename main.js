// main.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const loader = new THREE.TextureLoader();
loader.load('sky.jpg', (texture) => {
  scene.background = texture;
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('three-canvas'),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x1C7AFF })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
playerCube.position.y = 0.5;
scene.add(playerCube);

let playerModel = null;
let bombModel = null;

const gltfLoader = new GLTFLoader();
const bombLoader = new GLTFLoader();
gltfLoader.load('car/scene.gltf', (gltf) => {
  playerModel = gltf.scene;
  playerModel.scale.set(0.7, 0.7, 0.7);
  playerModel.position.set(0, 0, 0);
  scene.add(playerModel);
  scene.remove(playerCube);
});

bombLoader.load('bomb/scene.gltf', (gltf) => {
  bombModel = gltf.scene;
  //bombModel.rotation.set(Math.PI, 0, 0);
  bombModel.scale.set(0.01, 0.01, 0.01);
  bombModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
});

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
  if (e.key in keys) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key in keys) keys[e.key] = false;
});

const scoreDiv = document.getElementById('score');
let score = 0;
let waveNumber = 1;

let collectibles = [], cones = [], bombs = [];
const coneFallSpeed = 0.25;
const coneSpawnInterval = 200;
let gameOver = false;

const coneGeometry = new THREE.ConeGeometry(0.3, 1, 8);
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });

const explosionParticles = [];
const explosionDuration = 1000;
let explosionStartTime = 0;
let gameOverDiv = null;

function showGameOver() {
  if (gameOverDiv) return;
  gameOverDiv = document.createElement('div');
  gameOverDiv.style = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: red; font-size: 36px; font-weight: bold; user-select: none; text-align: center;`;
  gameOverDiv.innerHTML = 'GAME OVER<br>(press R to restart)';
  document.body.appendChild(gameOverDiv);
}

function restartGame() {
  if (gameOverDiv) document.body.removeChild(gameOverDiv);
  gameOverDiv = null;
  explosionParticles.forEach(p => scene.remove(p));
  explosionParticles.length = 0;
  score = 0;
  waveNumber = 1;
  gameOver = false;
  lastConeSpawn = 0;
  scoreDiv.textContent = `Score: ${score}`;
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  cones.forEach(c => scene.remove(c));
  cones.length = 0;
  bombs.forEach(b => scene.remove(b));
  bombs.length = 0;
  (playerModel || playerCube).position.set(0, playerModel ? 0 : 0.5, 0);
  if (playerModel) scene.add(playerModel);
  else if (!scene.children.includes(playerCube)) scene.add(playerCube);
  spawnWave(waveNumber);
}

window.addEventListener('keydown', (e) => {
  if (gameOver && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    restartGame();
  }
});

function spawnWave(waveNum) {
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  const count = 5 * waveNum;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(2, 0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const collectible = new THREE.Mesh(geo, mat);
    collectible.position.set((Math.random() - 0.5) * 18, 0.25, (Math.random() - 0.5) * 18);
    scene.add(collectible);
    collectibles.push(collectible);
  }
  (playerModel || playerCube).position.set(0, playerModel ? 0 : 0.5, 0);
}

let lastConeSpawn = 0;
function spawnCone() {
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.set((Math.random() - 0.5) * 18, 8, (Math.random() - 0.5) * 18);
  cone.rotation.x = Math.PI;
  scene.add(cone);
  cones.push(cone);
}

function spawnBomb() {
  if (!bombModel || (!playerModel && !playerCube)) return;
  const px = playerModel ? playerModel.position.x : playerCube.position.x;
  const pz = playerModel ? playerModel.position.z : playerCube.position.z;
  let x, z;
  const minDistance = 6;
  let attempts = 0;
  do {
    x = (Math.random() - 0.5) * 18;
    z = (Math.random() - 0.5) * 18;
    attempts++;
  } while (Math.hypot(x - px, z - pz) < minDistance && attempts < 10);
  const bombClone = bombModel.clone(true);
  bombClone.position.set(x, 8, z);
  bombClone.rotation.set(Math.PI / 2, 0, 0);
  scene.add(bombClone);
  bombs.push(bombClone);
}

function isInScene(object) {
  while(object) {
    if (object.parent === scene) return true;
    object = object.parent;
  }
  return false;
}

function checkCollision(obj1, obj2) {
  if (!obj1 || !obj2) return false;
  if (!isInScene(obj1) || !isInScene(obj2)) return false;
  const box1 = new THREE.Box3().setFromObject(obj1);
  const box2 = new THREE.Box3().setFromObject(obj2);
  return box1.intersectsBox(box2);
}



function createExplosion(position) {
  for (let i = 0; i < 30; i++) {
    const geometry = new THREE.SphereGeometry(0.05, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffaa00, transparent: true });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    particle.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2);
    scene.add(particle);
    explosionParticles.push(particle);
  }
  explosionStartTime = performance.now();
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  if (explosionParticles.length > 0) {
    const elapsed = performance.now() - explosionStartTime;
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      p.position.addScaledVector(p.userData.velocity, 0.1);
      p.userData.velocity.multiplyScalar(0.9);
      p.material.opacity = 1 - elapsed / explosionDuration;
      if (p.material.opacity <= 0) {
        scene.remove(p);
        explosionParticles.splice(i, 1);
      }
    }
    if (elapsed >= explosionDuration && !gameOver) {
      gameOver = true;
      showGameOver();
    }
    renderer.render(scene, camera);
    return;
  }
  if (gameOver) {
    renderer.render(scene, camera);
    return;
  }

  const speed = 0.25;
  const moveVector = new THREE.Vector3(0, 0, 0);
  if (keys.w) moveVector.z -= 1;
  if (keys.s) moveVector.z += 1;
  if (keys.a) moveVector.x -= 1;
  if (keys.d) moveVector.x += 1;

  if (moveVector.length() > 0) {
    moveVector.normalize();
    if (playerModel) {
      playerModel.position.addScaledVector(moveVector, speed);
      playerModel.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    } else {
      playerCube.position.addScaledVector(moveVector, speed);
      playerCube.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    }
    const cameraOffset = new THREE.Vector3(5, 10, 8);
    camera.position.copy((playerModel || playerCube).position).add(cameraOffset);
    camera.lookAt((playerModel || playerCube).position);
  }

  const player = playerModel || playerCube;
if (!player || !scene.children.includes(player)) {
  renderer.render(scene, camera);
  return; // no player, stop processing collisions & movement
}


  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (checkCollision(playerModel || playerCube, c)) {
      scene.remove(c);
      collectibles.splice(i, 1);
      score++;
      scoreDiv.textContent = `Score: ${score}`;
    }
  }

  if (collectibles.length === 0) {
    waveNumber++;
    spawnWave(waveNumber);
  }

  if (time > 3000 && time - lastConeSpawn > coneSpawnInterval) {
    spawnCone();
    spawnBomb();
    lastConeSpawn = time;
  }

  for (let i = cones.length - 1; i >= 0; i--) {
    const cone = cones[i];
    cone.position.y -= coneFallSpeed;
    if (cone.position.y < 0) {
      scene.remove(cone);
      cones.splice(i, 1);
      continue;
    }
    if (checkCollision(playerModel || playerCube, cone)) {
      scene.remove(playerModel || playerCube);
      scene.remove(cone);
      cones.splice(i, 1);
      createExplosion((playerModel || playerCube).position.clone());
      break;
    }
  }

  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i];
    bomb.position.y -= coneFallSpeed;
    if (bomb.position.y < 0) {
      scene.remove(bomb);
      bombs.splice(i, 1);
      continue;
    }
    if (time < 3000) continue;
    if (checkCollision(playerModel || playerCube, bomb)) {
      scene.remove(playerModel || playerCube);
      scene.remove(bomb);
      bombs.splice(i, 1);
      createExplosion((playerModel || playerCube).position.clone());
      break;
    }
  }

  renderer.render(scene, camera);
}

setTimeout(() => {
  spawnWave(waveNumber);
}, 3000);

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
