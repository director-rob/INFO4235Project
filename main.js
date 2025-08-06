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
  new THREE.MeshStandardMaterial({ color: 0x87CEEB }) // baby blue
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
let ghostModel = null;

const gltfLoader = new GLTFLoader();
const bombLoader = new GLTFLoader();
const ghostLoader = new GLTFLoader();
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

ghostLoader.load('blinky_from_pacman.glb', (gltf) => {
  ghostModel = gltf.scene;
  ghostModel.scale.set(0.5, 0.5, 0.5);
  ghostModel.traverse((child) => {
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
const coneFallSpeed = 0.125; // half speed (was 0.25)
const coneSpawnInterval = 400; // less dense (was 200)
let gameOver = false;

// Ghost system (after level 3)
let ghost = null;
let ghostSpawned = false;
const ghostSpeed = 0.06; // much slower than player (was 0.12)

// Power pellet system
let powerPellet = null;
let powerPelletSpawned = false;
let protectionActive = false;

// Follower mob system
let followers = [];
const followerSpawnDelay = 8000; // 8 seconds
const followerSpeed = 0.15; // slower than player's 0.25
let followersSpawned = false;
let gameStartTime = 0;

// Camera drag functionality
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraOffset = new THREE.Vector3(5, 10, 8);
let isFollowingPlayer = true;
let cameraTarget = new THREE.Vector3(0, 0, 0); // Where the camera is looking

// Tile storage and interactive tiles
const tiles = new Map(); // store generated tiles
const interactiveTiles = []; // tiles that can be clicked/interacted with
let currentPlayerTile = null; // track the tile the player is currently on
let previousPlayerTileKey = null; // track previous tile to reset it

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

// Follower mob geometry and material
const followerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
const followerMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x44ff44, // friendly green instead of red
  emissive: 0x003300,
  emissiveIntensity: 0.2
});

// Power pellet geometry and material
const powerPelletGeometry = new THREE.BoxGeometry(1.5, 0.8, 1.5);
const powerPelletMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x00ff00, // bright green
  emissive: 0x004400,
  emissiveIntensity: 0.3
});

// Ghost fallback geometry and material
const ghostGeometry = new THREE.CylinderGeometry(1, 1, 2, 16);
const ghostMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff4444, // red ghost
  emissive: 0x440000,
  emissiveIntensity: 0.3
});

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
  
  // Reset follower system
  followers.forEach(f => scene.remove(f));
  followers.length = 0;
  followersSpawned = false;
  gameStartTime = performance.now();
  
  // Reset ghost system completely
  if (ghost) {
    scene.remove(ghost);
    ghost = null;
  }
  ghostSpawned = false;
  
  // Reset power pellet system
  if (powerPellet) {
    scene.remove(powerPellet);
    powerPellet = null;
  }
  powerPelletSpawned = false;
  protectionActive = false;
  
  scoreDiv.textContent = `Score: ${score}`;
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  cones.forEach(c => {
    scene.remove(c);
    if (c.userData.shadowIndicator) {
      scene.remove(c.userData.shadowIndicator);
    }
  });
  cones.length = 0;
  bombs.forEach(b => {
    scene.remove(b);
    if (b.userData.shadowIndicator) {
      scene.remove(b.userData.shadowIndicator);
    }
  });
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
          tileData = { website: tileType.website, name: tileType.name, isInteractive: true };
        } else {
          // Regular landscape tile - baby blue variations
          const blueVariation = Math.floor(Math.random() * 0x222222); // subtle variation
          const babyBlue = 0x87CEEB + blueVariation - 0x111111; // slight variations around baby blue
          tileMaterial = new THREE.MeshStandardMaterial({ color: babyBlue });
          tileData = { website: null, name: null, isInteractive: false };
        }
        
        const tileGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.rotation.x = -Math.PI / 2;
        // Position tile at center of grid cell
        tile.position.set(tileX + tileSize/2, 0, tileZ + tileSize/2);
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
          label.position.set(tileX + tileSize/2, 1, tileZ + tileSize/2);
          scene.add(label);
        }
      }
    }
  }
}

// Check if player is on an interactive tile
function checkTileInteraction() {
  const player = playerModel || playerCube;
  
  // Use the same calculation method as updatePlayerTile
  let playerGroundX, playerGroundZ;
  
  if (playerModel) {
    // For the car model, calculate the bounding box center
    const boundingBox = new THREE.Box3().setFromObject(playerModel);
    const center = boundingBox.getCenter(new THREE.Vector3());
    playerGroundX = center.x;
    playerGroundZ = center.z;
  } else {
    // For the cube, use the position directly
    playerGroundX = player.position.x;
    playerGroundZ = player.position.z;
  }
  
  const playerX = Math.floor(playerGroundX / tileSize);
  const playerZ = Math.floor(playerGroundZ / tileSize);
  const tileKey = `${playerX},${playerZ}`;
  
  if (tiles.has(tileKey)) {
    const tile = tiles.get(tileKey);
    if (tile.userData.website && keys[' ']) {
      window.open(tile.userData.website, '_blank');
      keys[' '] = false; // prevent multiple opens
    }
  }
}

// Update current player tile with bobbing and glow effects
function updatePlayerTile(time) {
  const player = playerModel || playerCube;
  
  // Get the player's actual ground position (accounting for model offset)
  let playerGroundX, playerGroundZ;
  
  if (playerModel) {
    // For the car model, calculate the bounding box center
    const boundingBox = new THREE.Box3().setFromObject(playerModel);
    const center = boundingBox.getCenter(new THREE.Vector3());
    playerGroundX = center.x;
    playerGroundZ = center.z;
  } else {
    // For the cube, use the position directly
    playerGroundX = player.position.x;
    playerGroundZ = player.position.z;
  }
  
  // Calculate tile coordinates from the ground position
  const playerX = Math.floor(playerGroundX / tileSize);
  const playerZ = Math.floor(playerGroundZ / tileSize);
  const tileKey = `${playerX},${playerZ}`;
  
  // Reset previous tile if we moved to a new one
  if (previousPlayerTileKey && previousPlayerTileKey !== tileKey && tiles.has(previousPlayerTileKey)) {
    const prevTile = tiles.get(previousPlayerTileKey);
    prevTile.position.y = 0; // reset height
    
    // Reset material to original state
    if (prevTile.userData.isInteractive) {
      prevTile.material.emissiveIntensity = 0.2; // restore original emissive
    } else {
      prevTile.material.emissive.setHex(0x000000); // remove glow from regular tiles
    }
  }
  
  // Update current tile
  if (tiles.has(tileKey)) {
    const tile = tiles.get(tileKey);
    currentPlayerTile = tile;
    
    // Bobbing motion - keep it above ground level
    const bobSpeed = 0.003;
    const bobHeight = 0.15; // reduced height to prevent clipping
    const bobOffset = Math.sin(time * bobSpeed) * bobHeight;
    tile.position.y = Math.max(0, bobOffset); // never go below ground level
    
    // Add glow effect
    if (tile.userData.isInteractive) {
      // Interactive tiles get enhanced glow with their original color
      tile.material.emissiveIntensity = 0.4 + Math.sin(time * 0.005) * 0.1;
    } else {
      // Regular tiles get bright blue glow
      const glowIntensity = 0.3 + Math.sin(time * 0.005) * 0.5; // increased intensity
      tile.material.emissive.setHex(0x4499FF); // brighter blue
      tile.material.emissiveIntensity = glowIntensity;
    }
  } else {
    currentPlayerTile = null;
  }
  
  previousPlayerTileKey = tileKey;
}

function spawnWave(waveNum) {
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  const count = 5 * waveNum;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(2, 0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const collectible = new THREE.Mesh(geo, mat);
    // Spawn across the entire 20x20 main ground area
    collectible.position.set((Math.random() - 0.5) * 19, 0.25, (Math.random() - 0.5) * 19);
    collectible.castShadow = true;
    collectible.receiveShadow = true;
    scene.add(collectible);
    collectibles.push(collectible);
  }
  
  // Reset ghost system for new wave
  if (ghost) {
    scene.remove(ghost);
    ghost = null;
  }
  ghostSpawned = false;
  
  // Don't reset followers - they should carry over between waves
  // Just reset the spawn flag so more can be added
  followersSpawned = false;
  
  // Spawn power pellet once per level
  if (!powerPelletSpawned) {
    spawnPowerPellet();
  }
  
  (playerModel || playerCube).position.set(0, playerModel ? 0 : 0.5, 0);
}

let lastConeSpawn = 0;
function spawnCone() {
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  // Spawn across the entire 20x20 main ground area
  cone.position.set((Math.random() - 0.5) * 19, 20, (Math.random() - 0.5) * 19); // spawn from much higher
  cone.rotation.x = Math.PI;
  cone.castShadow = true;
  cone.receiveShadow = true;
  
  // Create ground shadow indicator
  const shadowGeometry = new THREE.CircleGeometry(0.5, 16);
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000, 
    transparent: true, 
    opacity: 0.1 // start very faint
  });
  const shadowIndicator = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowIndicator.rotation.x = -Math.PI / 2;
  shadowIndicator.position.set(cone.position.x, 0.01, cone.position.z); // slightly above ground
  scene.add(shadowIndicator);
  
  // Store shadow reference on the cone
  cone.userData.shadowIndicator = shadowIndicator;
  cone.userData.maxHeight = 20; // starting height for shadow calculations
  
  scene.add(cone);
  cones.push(cone);
}

function spawnFollowers() {
  if (followersSpawned || !protectionActive) return;
  
  const numFollowers = 3 + Math.floor(waveNumber / 2); // more followers in later waves
  for (let i = 0; i < numFollowers; i++) {
    const follower = new THREE.Mesh(followerGeometry, followerMaterial.clone());
    
    // Spawn followers from the same general direction (behind player) with slight variations
    const baseAngle = Math.PI; // behind the player (180 degrees)
    const angleVariation = (Math.random() - 0.5) * 0.8; // ±0.4 radians (about ±23 degrees)
    const angle = baseAngle + angleVariation;
    const spawnDistance = 25 + Math.random() * 10; // vary distance slightly
    const player = playerModel || playerCube;
    follower.position.set(
      player.position.x + Math.cos(angle) * spawnDistance,
      0.5,
      player.position.z + Math.sin(angle) * spawnDistance
    );
    
    // Add bouncing properties and collision count
    follower.userData = {
      bouncePhase: Math.random() * Math.PI * 2,
      bounceSpeed: 0.01 + Math.random() * 0.005,
      collisionCount: 0,
      maxCollisions: 3,
      isFlashing: false,
      flashStartTime: 0
    };
    
    follower.castShadow = true;
    follower.receiveShadow = true;
    scene.add(follower);
    followers.push(follower);
  }
  followersSpawned = true;
}

function updateFollowers(time) {
  const player = playerModel || playerCube;
  if (!player) return;
  
  followers.forEach((follower, index) => {
    // Handle flashing effect
    if (follower.userData.isFlashing) {
      const flashDuration = 500; // 0.5 seconds
      const elapsed = time - follower.userData.flashStartTime;
      if (elapsed < flashDuration) {
        // Flash red
        const flashIntensity = Math.sin(elapsed * 0.02) * 0.5 + 0.5;
        follower.material.color.setHex(0xff0000);
        follower.material.emissive.setHex(0x440000);
        follower.material.emissiveIntensity = flashIntensity * 0.5;
      } else {
        // Return to normal green
        follower.userData.isFlashing = false;
        follower.material.color.setHex(0x44ff44);
        follower.material.emissive.setHex(0x003300);
        follower.material.emissiveIntensity = 0.2;
      }
    }
    
    // Check for collision with ghost
    if (ghost && checkCollision(follower, ghost)) {
      follower.userData.collisionCount++;
      follower.userData.isFlashing = true;
      follower.userData.flashStartTime = time;
      
      // Bounce ghost away
      const bounceDirection = new THREE.Vector3();
      bounceDirection.subVectors(ghost.position, follower.position).normalize();
      ghost.position.addScaledVector(bounceDirection, 5); // push ghost away
      
      // Remove follower if it's used up
      if (follower.userData.collisionCount >= follower.userData.maxCollisions) {
        scene.remove(follower);
        followers.splice(index, 1);
        return;
      }
    }
    
    // Calculate direction to player
    const direction = new THREE.Vector3();
    direction.subVectors(player.position, follower.position);
    const distanceToPlayer = direction.length();
    direction.normalize();
    
    // Separation behavior - avoid other followers
    const separationForce = new THREE.Vector3();
    const separationDistance = 2.5; // minimum distance between followers
    
    followers.forEach((otherFollower, otherIndex) => {
      if (index === otherIndex) return;
      
      const separationDir = new THREE.Vector3();
      separationDir.subVectors(follower.position, otherFollower.position);
      const separationDist = separationDir.length();
      
      if (separationDist < separationDistance && separationDist > 0) {
        separationDir.normalize();
        separationDir.multiplyScalar((separationDistance - separationDist) / separationDistance);
        separationForce.add(separationDir);
      }
    });
    
    // Patient following behavior - stay behind player at a comfortable distance
    const followDistance = 3 + (index * 0.8); // stagger followers behind each other
    const finalDirection = new THREE.Vector3();
    
    if (distanceToPlayer > followDistance) {
      // Move towards player but add separation force
      finalDirection.copy(direction);
      finalDirection.multiplyScalar(followerSpeed * 0.8); // slower, more patient movement
      finalDirection.add(separationForce.multiplyScalar(0.4)); // stronger separation
      
      follower.position.add(finalDirection);
      
      // Gentle hopping movement when following
      follower.userData.bouncePhase += follower.userData.bounceSpeed * 1.5;
      const hopHeight = Math.abs(Math.sin(follower.userData.bouncePhase)) * 0.3;
      follower.position.y = 0.5 + hopHeight;
    } else {
      // Wait patiently with gentle idle bounce
      follower.userData.bouncePhase += follower.userData.bounceSpeed * 0.3; // very slow idle bounce
      const gentleBounce = Math.sin(follower.userData.bouncePhase) * 0.08; // subtle bounce
      follower.position.y = 0.5 + gentleBounce;
      
      // Still apply separation when waiting
      if (separationForce.length() > 0) {
        separationForce.multiplyScalar(0.3);
        follower.position.add(separationForce);
      }
    }
    
    // Rotate to face player
    follower.lookAt(player.position);
  });
}

function spawnBomb() {
  if (!bombModel || (!playerModel && !playerCube)) return;
  const px = playerModel ? playerModel.position.x : playerCube.position.x;
  const pz = playerModel ? playerModel.position.z : playerCube.position.z;
  let x, z;
  const minDistance = 6;
  let attempts = 0;
  do {
    // Spawn across the entire 20x20 main ground area
    x = (Math.random() - 0.5) * 19;
    z = (Math.random() - 0.5) * 19;
    attempts++;
  } while (Math.hypot(x - px, z - pz) < minDistance && attempts < 10);
  const bombClone = bombModel.clone(true);
  bombClone.position.set(x, 20, z); // spawn from much higher
  bombClone.rotation.set(Math.PI / 2, 0, 0);
  
  // Enable shadows for bomb model
  bombClone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // Create ground shadow indicator for bomb
  const shadowGeometry = new THREE.CircleGeometry(0.8, 16); // slightly larger for bombs
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000, // red shadow for bombs to indicate danger
    transparent: true, 
    opacity: 0.1 // start very faint
  });
  const shadowIndicator = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowIndicator.rotation.x = -Math.PI / 2;
  shadowIndicator.position.set(x, 0.01, z); // slightly above ground
  scene.add(shadowIndicator);
  
  // Store shadow reference on the bomb
  bombClone.userData.shadowIndicator = shadowIndicator;
  bombClone.userData.maxHeight = 20; // starting height for shadow calculations
  
  scene.add(bombClone);
  bombs.push(bombClone);
}

function spawnPowerPellet() {
  if (powerPelletSpawned) return;
  
  powerPellet = new THREE.Mesh(powerPelletGeometry, powerPelletMaterial);
  // Spawn randomly in the play area
  powerPellet.position.set(
    (Math.random() - 0.5) * 19, 
    0.4, 
    (Math.random() - 0.5) * 19
  );
  powerPellet.castShadow = true;
  powerPellet.receiveShadow = true;
  scene.add(powerPellet);
  powerPelletSpawned = true;
}

function spawnGhost() {
  if (ghostSpawned || waveNumber < 1) return;
  
  // Use loaded model if available, otherwise fallback to cylinder
  if (ghostModel) {
    ghost = ghostModel.clone(true);
    
    // Calculate the original bounding box
    const originalBox = new THREE.Box3().setFromObject(ghost);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    
    // Target dimensions to match cylinder (radius=1, height=2)
    const targetWidth = 2; // diameter of cylinder
    const targetHeight = 2; // height of cylinder
    
    // Calculate scale factors to match cylinder dimensions
    const scaleX = targetWidth / originalSize.x;
    const scaleY = targetHeight / originalSize.y;
    const scaleZ = targetWidth / originalSize.z;
    
    // Use uniform scaling based on the smallest scale to maintain proportions
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    ghost.scale.set(uniformScale, uniformScale, uniformScale);
    
    // Recalculate bounding box after scaling
    const scaledBox = new THREE.Box3().setFromObject(ghost);
    const scaledSize = scaledBox.getSize(new THREE.Vector3());
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    
    // Position so the bottom of the model sits on the ground
    // Account for the model's center offset and place it properly above ground
    ghost.position.y = scaledSize.y * 0.5 + Math.abs(scaledCenter.y); // ensure bottom is at y=0
  } else {
    ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);
    ghost.position.y = 1.0; // cylinder center height (radius=1, so center at y=1)
  }
  
  // Spawn at edge of play area
  const angle = Math.random() * Math.PI * 2;
  const distance = 15;
  ghost.position.x = Math.cos(angle) * distance;
  ghost.position.z = Math.sin(angle) * distance;
  
  ghost.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // For fallback cylinder, set shadows directly
  if (!ghostModel) {
    ghost.castShadow = true;
    ghost.receiveShadow = true;
  }
  
  scene.add(ghost);
  ghostSpawned = true;
}

function updateGhost() {
  if (!ghost) return;
  
  const player = playerModel || playerCube;
  if (!player) return;
  
  // Ensure ghost exists in scene
  if (!scene.children.includes(ghost)) {
    console.warn("Ghost not in scene, re-adding");
    scene.add(ghost);
  }
  
  // Chase the player
  const direction = new THREE.Vector3();
  direction.subVectors(player.position, ghost.position);
  direction.normalize();
  
  // Move ghost towards player
  const newPosition = ghost.position.clone();
  newPosition.addScaledVector(direction, ghostSpeed);
  
  // Maintain proper height - ensure ghost stays above ground
  let minHeight = 1.0; // default for cylinder
  if (ghostModel && ghost.children.length > 0) {
    // For GLTF model, calculate proper height to keep bottom above ground
    const box = new THREE.Box3().setFromObject(ghost);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    minHeight = size.y * 0.5 + Math.abs(center.y); // ensure bottom doesn't go below ground
  }
  
  newPosition.y = Math.max(minHeight, newPosition.y);
  
  // Apply the new position
  ghost.position.copy(newPosition);
  
  // Rotate to face player - use same method for both since they're now the same size
  const lookAtPosition = player.position.clone();
  lookAtPosition.y = ghost.position.y;
  ghost.lookAt(lookAtPosition);
  
  // Check collision with player
  if (checkCollision(ghost, player)) {
    // Game over
    scene.remove(player);
    createExplosion(player.position.clone());
  }
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
  
  // Special handling for ghost - only prevent collision with falling objects, not followers
  if ((obj1 === ghost || obj2 === ghost) && obj1 !== obj2) {
    // Allow ghost collision with player and followers
    const player = playerModel || playerCube;
    const isPlayerCollision = (obj1 === ghost && obj2 === player) || (obj1 === player && obj2 === ghost);
    const isFollowerCollision = (obj1 === ghost && followers.includes(obj2)) || (followers.includes(obj1) && obj2 === ghost);
    
    if (isPlayerCollision || isFollowerCollision) {
      const box1 = new THREE.Box3().setFromObject(obj1);
      const box2 = new THREE.Box3().setFromObject(obj2);
      return box1.intersectsBox(box2);
    }
    
    // Prevent collision with falling objects (cones and bombs)
    return false;
  }
  
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
  
  // Initialize game start time
  if (gameStartTime === 0) {
    gameStartTime = time;
  }
  
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

  // Spawn followers after delay (only if protection is active)
  if (!followersSpawned && protectionActive && time - gameStartTime > followerSpawnDelay) {
    spawnFollowers();
  }
  
  // Spawn ghost after level 1 (for debugging)
  if (!ghostSpawned && waveNumber >= 1) {
    spawnGhost();
  }
  
  // Update followers
  if (followersSpawned) {
    updateFollowers(time);
  }
  
  // Update ghost
  if (ghostSpawned && ghost) {
    updateGhost();
    
    // Dynamic height check based on model type
    let minAllowedHeight = 0.5; // default minimum
    if (ghostModel && ghost.children.length > 0) {
      // For GLTF model, calculate proper minimum height to keep bottom above ground
      const box = new THREE.Box3().setFromObject(ghost);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      minAllowedHeight = size.y * 0.5 + Math.abs(center.y); // bottom should be at y=0 minimum
    }
    
    if (ghost.position.y < minAllowedHeight) {
      console.warn("Ghost below ground, repositioning");
      // Reset to proper spawn height
      if (ghostModel && ghost.children.length > 0) {
        const box = new THREE.Box3().setFromObject(ghost);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        ghost.position.y = size.y * 0.5 + Math.abs(center.y); // proper ground positioning
      } else {
        ghost.position.y = 1.0; // cylinder center height
      }
    }
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
  
  // Update current player tile with effects
  updatePlayerTile(time);
  
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
  
  // Check power pellet collision
  if (powerPellet && checkCollision(playerModel || playerCube, powerPellet)) {
    scene.remove(powerPellet);
    powerPellet = null;
    powerPelletSpawned = false; // Reset flag so new pellet can spawn next wave
    protectionActive = true;
    // Trigger follower spawn if protection is activated
    if (waveNumber >= 1 && !followersSpawned) {
      setTimeout(() => spawnFollowers(), 1000); // small delay for effect
    }
  }

  if (collectibles.length === 0) {
    waveNumber++;
    // Don't reset protection status - let it carry over
    // Don't reset followersSpawned - let them carry over
    spawnWave(waveNumber);
  }

  // Start falling objects after 5 seconds (was 3 seconds)
  if (time > 5000 && time - lastConeSpawn > coneSpawnInterval) {
    spawnCone();
    spawnBomb();
    lastConeSpawn = time;
  }

  for (let i = cones.length - 1; i >= 0; i--) {
    const cone = cones[i];
    cone.position.y -= coneFallSpeed;
    
    // Update shadow indicator based on height
    if (cone.userData.shadowIndicator) {
      const heightRatio = cone.position.y / cone.userData.maxHeight;
      const shadowOpacity = Math.max(0.1, 0.8 * (1 - heightRatio)); // gets darker as it falls
      const shadowSize = 0.5 + (1 - heightRatio) * 0.3; // gets slightly larger as it approaches
      
      cone.userData.shadowIndicator.material.opacity = shadowOpacity;
      cone.userData.shadowIndicator.scale.setScalar(shadowSize);
    }
    
    if (cone.position.y < 0) {
      scene.remove(cone);
      // Remove shadow indicator
      if (cone.userData.shadowIndicator) {
        scene.remove(cone.userData.shadowIndicator);
      }
      cones.splice(i, 1);
      continue;
    }
    if (checkCollision(playerModel || playerCube, cone)) {
      scene.remove(playerModel || playerCube);
      scene.remove(cone);
      // Remove shadow indicator
      if (cone.userData.shadowIndicator) {
        scene.remove(cone.userData.shadowIndicator);
      }
      cones.splice(i, 1);
      createExplosion((playerModel || playerCube).position.clone());
      break;
    }
  }

  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i];
    bomb.position.y -= coneFallSpeed;
    
    // Update shadow indicator based on height
    if (bomb.userData.shadowIndicator) {
      const heightRatio = bomb.position.y / bomb.userData.maxHeight;
      const shadowOpacity = Math.max(0.1, 0.8 * (1 - heightRatio)); // gets darker as it falls
      const shadowSize = 0.8 + (1 - heightRatio) * 0.4; // gets larger as it approaches
      
      bomb.userData.shadowIndicator.material.opacity = shadowOpacity;
      bomb.userData.shadowIndicator.scale.setScalar(shadowSize);
    }
    
    if (bomb.position.y < 0) {
      scene.remove(bomb);
      // Remove shadow indicator
      if (bomb.userData.shadowIndicator) {
        scene.remove(bomb.userData.shadowIndicator);
      }
      bombs.splice(i, 1);
      continue;
    }
    if (time < 5000) continue; // Don't check bomb collisions until 5 seconds have passed
    if (checkCollision(playerModel || playerCube, bomb)) {
      scene.remove(playerModel || playerCube);
      scene.remove(bomb);
      // Remove shadow indicator
      if (bomb.userData.shadowIndicator) {
        scene.remove(bomb.userData.shadowIndicator);
      }
      bombs.splice(i, 1);
      createExplosion((playerModel || playerCube).position.clone());
      break;
    }
  }

  renderer.render(scene, camera);
}

setTimeout(() => {
  spawnWave(waveNumber);
  gameStartTime = performance.now(); // Initialize game start time
}, 5000); // Changed from 3000 to 5000 for 5 second delay

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
