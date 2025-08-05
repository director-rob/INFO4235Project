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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft shadows

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // softer intensity
directionalLight.position.set(10, 15, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -25;
directionalLight.shadow.camera.right = 25;
directionalLight.shadow.camera.top = 25;
directionalLight.shadow.camera.bottom = -25;
directionalLight.shadow.radius = 10; // soft shadow blur
directionalLight.shadow.blurSamples = 25; // even softer
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // slightly brighter ambient
scene.add(ambientLight);

// Add a soft fill light from the opposite side
const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
fillLight.position.set(-10, 10, -5);
scene.add(fillLight);

// Extended map and tile system constants
const mapSize = 200; // much larger map
const tileSize = 10;

// Main play area ground - baby blue
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x87CEEB }) // baby blue (skyblue)
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true; // ground receives shadows
scene.add(ground);

// Extended base terrain - baby blue
const baseTerrain = new THREE.Mesh(
  new THREE.PlaneGeometry(mapSize * 2, mapSize * 2),
  new THREE.MeshStandardMaterial({ color: 0x87CEEB }) // baby blue to match
);
baseTerrain.rotation.x = -Math.PI / 2;
baseTerrain.position.y = -0.1; // slightly below main ground
baseTerrain.receiveShadow = true; // terrain receives shadows
scene.add(baseTerrain);

const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
playerCube.position.y = 0.5;
playerCube.castShadow = true; // cube also casts shadows (fallback)
playerCube.receiveShadow = true;
scene.add(playerCube);

let playerModel = null;
let bombModel = null;

const gltfLoader = new GLTFLoader();
const bombLoader = new GLTFLoader();
gltfLoader.load('car/scene.gltf', (gltf) => {
  playerModel = gltf.scene;
  playerModel.scale.set(0.7, 0.7, 0.7);
  playerModel.position.set(0, 0, 0);
  
  // Enable shadow casting for the car model
  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
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

// Change to arrow keys and add space for interaction
const keys = { 
  ArrowUp: false, 
  ArrowDown: false, 
  ArrowLeft: false, 
  ArrowRight: false,
  ' ': false // space key for interaction
};
window.addEventListener('keydown', (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
    e.preventDefault(); // prevent scrolling with arrow keys
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
    e.preventDefault();
  }
});

const scoreDiv = document.getElementById('score');
let score = 0;
let waveNumber = 1;

let collectibles = [], cones = [], bombs = [];
const coneFallSpeed = 0.25;
const coneSpawnInterval = 200;
let gameOver = false;

// Camera drag functionality
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraOffset = new THREE.Vector3(5, 10, 8);
let isFollowingPlayer = true;
let cameraTarget = new THREE.Vector3(0, 0, 0); // Where the camera is looking

// Tile storage and interactive tiles
const tiles = new Map(); // store generated tiles
const interactiveTiles = []; // tiles that can be clicked/interacted with

// Tile types and their associated websites
const tileTypes = [
  { color: 0x4CAF50, website: 'https://threejs.org', name: 'Three.js' },
  { color: 0x2196F3, website: 'https://github.com', name: 'GitHub' },
];

// Mouse event handlers for camera dragging
const canvas = document.getElementById('three-canvas');
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mousemove', onMouseMove, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('click', onMouseClick, false);

function onMouseDown(event) {
  isDragging = true;
  isFollowingPlayer = false;
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY
  };
}

function onMouseMove(event) {
  if (!isDragging) return;
  
  const deltaMove = {
    x: event.clientX - previousMousePosition.x,
    y: event.clientY - previousMousePosition.y
  };
  
  // Pan the camera by moving the target position
  // Calculate the camera's right and up vectors
  const camera_direction = new THREE.Vector3();
  camera.getWorldDirection(camera_direction);
  
  const camera_right = new THREE.Vector3();
  camera_right.crossVectors(camera.up, camera_direction).normalize();
  
  const camera_up = new THREE.Vector3();
  camera_up.crossVectors(camera_direction, camera_right).normalize();
  
  // Pan speed factor
  const panSpeed = 0.05;
  
  // Move the camera target based on mouse movement
  const panX = camera_right.clone().multiplyScalar(-deltaMove.x * panSpeed);
  const panY = camera_up.clone().multiplyScalar(deltaMove.y * panSpeed);
  
  cameraTarget.add(panX).add(panY);
  
  // Update camera position to maintain the same offset from the new target
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY
  };
}

function onMouseUp() {
  isDragging = false;
}

function onMouseClick(event) {
  // Only process clicks if we weren't dragging
  if (!isDragging) {
    // Raycast to detect tile clicks
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(interactiveTiles);
    if (intersects.length > 0) {
      const tile = intersects[0].object;
      if (tile.userData.website) {
        window.open(tile.userData.website, '_blank');
      }
    }
  }
}

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

// Generate tiles around the player
function generateTilesAroundPlayer() {
  const player = playerModel || playerCube;
  const playerX = Math.floor(player.position.x / tileSize);
  const playerZ = Math.floor(player.position.z / tileSize);
  
  const renderDistance = 20; // tiles around player
  
  for (let x = playerX - renderDistance; x <= playerX + renderDistance; x++) {
    for (let z = playerZ - renderDistance; z <= playerZ + renderDistance; z++) {
      const tileKey = `${x},${z}`;
      
      if (!tiles.has(tileKey)) {
        // Skip the main play area (center tiles)
        if (Math.abs(x) <= 2 && Math.abs(z) <= 2) continue;
        
        const tileX = x * tileSize;
        const tileZ = z * tileSize;
        
        // Randomly decide if this should be an interactive tile
        const isInteractive = Math.random() < 0.1; // 10% chance
        
        let tileMaterial;
        let tileData = { website: null, name: null };
        
        if (isInteractive) {
          const tileType = tileTypes[Math.floor(Math.random() * tileTypes.length)];
          tileMaterial = new THREE.MeshStandardMaterial({ 
            color: tileType.color,
            emissive: tileType.color,
            emissiveIntensity: 0.2
          });
          tileData = { website: tileType.website, name: tileType.name };
        } else {
          // Regular landscape tile - baby blue variations
          const blueVariation = Math.floor(Math.random() * 0x222222); // subtle variation
          const babyBlue = 0x87CEEB + blueVariation - 0x111111; // slight variations around baby blue
          tileMaterial = new THREE.MeshStandardMaterial({ color: babyBlue });
        }
        
        const tileGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(tileX, 0, tileZ);
        tile.userData = tileData;
        tile.receiveShadow = true;
        
        scene.add(tile);
        tiles.set(tileKey, tile);
        
        if (isInteractive) {
          interactiveTiles.push(tile);
          
          // Add a label above interactive tiles
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = 256;
          canvas.height = 64;
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = 'black';
          context.font = '20px Arial';
          context.textAlign = 'center';
          context.fillText(tileData.name, canvas.width / 2, canvas.height / 2 + 7);
          
          const texture = new THREE.CanvasTexture(canvas);
          const labelMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            alphaTest: 0.1
          });
          const labelGeometry = new THREE.PlaneGeometry(tileSize * 0.8, tileSize * 0.2);
          const label = new THREE.Mesh(labelGeometry, labelMaterial);
          label.position.set(tileX, 1, tileZ);
          scene.add(label);
        }
      }
    }
  }
}

// Check if player is on an interactive tile
function checkTileInteraction() {
  const player = playerModel || playerCube;
  const playerX = Math.floor(player.position.x / tileSize);
  const playerZ = Math.floor(player.position.z / tileSize);
  const tileKey = `${playerX},${playerZ}`;
  
  if (tiles.has(tileKey)) {
    const tile = tiles.get(tileKey);
    if (tile.userData.website && keys[' ']) {
      window.open(tile.userData.website, '_blank');
      keys[' '] = false; // prevent multiple opens
    }
  }
}

function spawnWave(waveNum) {
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  const count = 5 * waveNum;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(2, 0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const collectible = new THREE.Mesh(geo, mat);
    collectible.position.set((Math.random() - 0.5) * 18, 0.25, (Math.random() - 0.5) * 18);
    collectible.castShadow = true;
    collectible.receiveShadow = true;
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
  cone.castShadow = true;
  cone.receiveShadow = true;
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
  
  // Enable shadows for bomb model
  bombClone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
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
  let isMoving = false;
  
  // Use arrow keys instead of WASD
  if (keys.ArrowUp) { moveVector.z -= 1; isMoving = true; }
  if (keys.ArrowDown) { moveVector.z += 1; isMoving = true; }
  if (keys.ArrowLeft) { moveVector.x -= 1; isMoving = true; }
  if (keys.ArrowRight) { moveVector.x += 1; isMoving = true; }

  if (moveVector.length() > 0) {
    moveVector.normalize();
    if (playerModel) {
      playerModel.position.addScaledVector(moveVector, speed);
      playerModel.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    } else {
      playerCube.position.addScaledVector(moveVector, speed);
      playerCube.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    }
    
    // Snap camera back to following player when moving
    if (!isFollowingPlayer) {
      isFollowingPlayer = true;
      cameraOffset = new THREE.Vector3(5, 10, 8); // reset to default offset
    }
  }
  
  // Update camera position
  if (isFollowingPlayer) {
    const player = playerModel || playerCube;
    cameraTarget.copy(player.position);
    camera.position.copy(player.position).add(cameraOffset);
    camera.lookAt(player.position);
  }
  // If not following player, camera position is already set by mouse drag
  
  // Generate tiles around player
  generateTilesAroundPlayer();
  
  // Check for tile interactions
  checkTileInteraction();

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
