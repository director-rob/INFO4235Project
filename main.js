import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('three-canvas'),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({ 
  color: 0x87ceeb, // light blue sky color
  side: THREE.BackSide // render inside of the sphere
});

const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skyDome);

// Lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Player cube
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
playerCube.position.y = 0.5; // sit on ground
scene.add(playerCube);

// WASD movement tracking
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
  if (e.key in keys) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key in keys) keys[e.key] = false;
});


// Score display
const scoreDiv = document.getElementById('score');
let score = 0;
let waveNumber = 1;

// Collectibles (red cubes)
let collectibles = [];

// Obstacles (falling cones)
let cones = [];
const coneFallSpeed = 0.25;  // faster falling cones
const coneSpawnInterval = 300; // ms

// Game state
let gameOver = false;

// Cone geometry and material (reuse for performance)
const coneGeometry = new THREE.ConeGeometry(0.3, 1, 8);
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });

// Explosion particles
const explosionParticles = [];
const explosionDuration = 1000; // ms
let explosionStartTime = 0;

// Global div for game over text
let gameOverDiv = null;

// Show game over text function
function showGameOver() {
  if (gameOverDiv) return; // already shown

  gameOverDiv = document.createElement('div');
  gameOverDiv.style.position = 'fixed';
  gameOverDiv.style.top = '50%';
  gameOverDiv.style.left = '50%';
  gameOverDiv.style.transform = 'translate(-50%, -50%)';
  gameOverDiv.style.color = 'red';
  gameOverDiv.style.fontSize = '36px';
  gameOverDiv.style.fontWeight = 'bold';
  gameOverDiv.style.userSelect = 'none';
  gameOverDiv.style.textAlign = 'center';
  gameOverDiv.innerHTML = 'GAME OVER<br>(press R to restart)';
  document.body.appendChild(gameOverDiv);
}

// Restart game function
function restartGame() {
  // Remove game over text
  if (gameOverDiv) {
    document.body.removeChild(gameOverDiv);
    gameOverDiv = null;
  }

  // Remove explosion particles if any
  explosionParticles.forEach(p => scene.remove(p));
  explosionParticles.length = 0;

  // Reset game variables
  score = 0;
  waveNumber = 1;
  gameOver = false;
  lastConeSpawn = 0;

  // Update score display
  scoreDiv.textContent = `Score: ${score}`;

  // Remove all collectibles and cones from scene
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;

  cones.forEach(c => scene.remove(c));
  cones.length = 0;

  // Add player cube back if it's removed
  if (!scene.children.includes(playerCube)) {
    scene.add(playerCube);
  }

  // Reset player position
  playerCube.position.set(0, 0.5, 0);

  // Spawn first wave
  spawnWave(waveNumber);
}

// Listen for 'r' key to restart game after game over
window.addEventListener('keydown', (e) => {
  if (gameOver && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    restartGame();
  }
});

// Spawn wave function
function spawnWave(waveNum) {
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;

  const baseCount = 5;
  const count = baseCount * waveNum;

  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const collectible = new THREE.Mesh(geo, mat);

    collectible.position.set(
      (Math.random() - 0.5) * 18,
      0.25,
      (Math.random() - 0.5) * 18
    );

    scene.add(collectible);
    collectibles.push(collectible);
  }

  // Reset player position
  playerCube.position.set(0, 0.5, 0);
}

// Spawn cones periodically
let lastConeSpawn = 0;
function spawnCone() {
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.set(
    (Math.random() - 0.5) * 18,
    8,
    (Math.random() - 0.5) * 18
  );
  cone.rotation.x = Math.PI;  // upside down cone
  scene.add(cone);
  cones.push(cone);
}

// Simple AABB collision detection
function checkCollision(obj1, obj2) {
  obj1.geometry.computeBoundingBox();
  obj2.geometry.computeBoundingBox();

  obj1.updateMatrixWorld();
  obj2.updateMatrixWorld();

  const box1 = obj1.geometry.boundingBox.clone();
  box1.applyMatrix4(obj1.matrixWorld);

  const box2 = obj2.geometry.boundingBox.clone();
  box2.applyMatrix4(obj2.matrixWorld);

  return box1.intersectsBox(box2);
}

// Create explosion particles at position
function createExplosion(position) {
  const particleCount = 30;
  for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.SphereGeometry(0.05, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffaa00, transparent: true });
    const particle = new THREE.Mesh(geometry, material);

    particle.position.copy(position);

    // Give each particle a random velocity vector
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    );

    scene.add(particle);
    explosionParticles.push(particle);
  }
  explosionStartTime = performance.now();
}

function animate(time = 0) {
  requestAnimationFrame(animate);

  // Animate explosion particles if any
  if (explosionParticles.length > 0) {
    const elapsed = performance.now() - explosionStartTime;
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];

      // Move particle by velocity
      p.position.addScaledVector(p.userData.velocity, 0.1);

      // Slow down velocity gradually (damping)
      p.userData.velocity.multiplyScalar(0.9);

      // Fade out the particle
      p.material.opacity = 1 - elapsed / explosionDuration;

      // Remove particle if faded
      if (p.material.opacity <= 0) {
        scene.remove(p);
        explosionParticles.splice(i, 1);
      }
    }

    // When explosion ends, show Game Over message
    if (elapsed >= explosionDuration && !gameOver) {
      gameOver = true;
      showGameOver();
    }

    renderer.render(scene, camera);
    return;  // Skip rest of game loop while explosion playing
  }

  if (gameOver) {
    renderer.render(scene, camera);
    return;
  }

  // WASD movement
  const speed = 0.25;  // faster player speed
  if (keys.w) playerCube.position.z -= speed;
  if (keys.s) playerCube.position.z += speed;
  if (keys.a) playerCube.position.x -= speed;
  if (keys.d) playerCube.position.x += speed;

  // Spin player cube
  playerCube.rotation.x += 0.01;
  playerCube.rotation.y += 0.01;

  // Check collisions with collectibles
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (checkCollision(playerCube, c)) {
      scene.remove(c);
      collectibles.splice(i, 1);
      score++;
      scoreDiv.textContent = `Score: ${score}`;
    }
  }

  // Next wave
  if (collectibles.length === 0) {
    waveNumber++;
    spawnWave(waveNumber);
  }

  // Spawn cones every coneSpawnInterval ms
  if (time - lastConeSpawn > coneSpawnInterval) {
    spawnCone();
    lastConeSpawn = time;
  }

  // Move cones down & check collision with player
  for (let i = cones.length - 1; i >= 0; i--) {
    const cone = cones[i];
    cone.position.y -= coneFallSpeed;

    // Remove cone if below ground
    if (cone.position.y < 0) {
      scene.remove(cone);
      cones.splice(i, 1);
      continue;
    }

    // Check collision with player cube
    if (checkCollision(playerCube, cone)) {
      // Remove the player cube (destroy)
      scene.remove(playerCube);

      // Remove the cone
      scene.remove(cone);
      cones.splice(i, 1);

      // Create explosion at player cube position
      createExplosion(playerCube.position.clone());

      // Don't set gameOver here directly! Explosion animation sets it after
      break;
    }
  }

  renderer.render(scene, camera);
}

spawnWave(waveNumber);
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
