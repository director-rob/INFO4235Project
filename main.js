import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Initialize the 3D scene
const scene = new THREE.Scene();

// Load and set sky background texture
const loader = new THREE.TextureLoader();
loader.load('/sky.jpg', (texture) => {
  scene.background = texture;
});

// Set up perspective camera with 75-degree field of view
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15); // Position camera above and behind the player

// Initialize WebGL renderer with antialiasing and shadow support
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('three-canvas'),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Enable soft shadows for better visual quality

// Create main directional light (simulates sunlight)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // White light with moderate intensity
directionalLight.position.set(10, 15, 5);
directionalLight.castShadow = true;
// Configure shadow camera for optimal shadow quality
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -25;
directionalLight.shadow.camera.right = 25;
directionalLight.shadow.camera.top = 25;
directionalLight.shadow.camera.bottom = -25;
directionalLight.shadow.radius = 10; // Soft shadow blur radius
directionalLight.shadow.blurSamples = 25; // Additional blur samples for softer shadows
scene.add(directionalLight);

// Add ambient light to brighten the overall scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Soft white ambient light
scene.add(ambientLight);

// Add fill light from opposite side to reduce harsh shadows
const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
fillLight.position.set(-10, 10, -5);
scene.add(fillLight);

// Map and tile system configuration
const mapSize = 200; // Total map size for extended terrain
const tileSize = 10; // Size of each procedural tile

// Create main play area ground with baby blue color
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x87CEEB }) // Baby blue color
);
ground.rotation.x = -Math.PI / 2; // Rotate to lie flat on XZ plane
ground.receiveShadow = true; // Allow shadows to be cast on the ground
scene.add(ground);

// Create extended base terrain for larger world exploration
const baseTerrain = new THREE.Mesh(
  new THREE.PlaneGeometry(mapSize * 2, mapSize * 2),
  new THREE.MeshStandardMaterial({ color: 0x87CEEB }) // Matching baby blue color
);
baseTerrain.rotation.x = -Math.PI / 2;
baseTerrain.position.y = -0.1; // Position slightly below main ground to avoid z-fighting
baseTerrain.receiveShadow = true; // Enable shadow receiving
scene.add(baseTerrain);

// Create fallback player cube (used when GLTF model fails to load)
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green cube
const playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
playerCube.position.y = 0.5; // Position cube so bottom sits on ground
playerCube.castShadow = true; // Enable shadow casting
playerCube.receiveShadow = true; // Enable shadow receiving
scene.add(playerCube);

// Variables to store loaded 3D models
let playerModel = null; // Will store the car model
let bombModel = null;   // Will store the bomb model
let ghostModel = null;  // Will store the ghost model

// Initialize GLTF loaders for different models
const gltfLoader = new GLTFLoader();
const bombLoader = new GLTFLoader();
const ghostLoader = new GLTFLoader();
// Load car model as main player character
gltfLoader.load('/car/scene.gltf', (gltf) => {
  playerModel = gltf.scene;
  playerModel.scale.set(0.7, 0.7, 0.7); // Scale down the car model
  playerModel.position.set(0, 0, 0); // Position at world origin
  
  // Enable shadow casting and receiving for all meshes in the car model
  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  scene.add(playerModel);
  scene.remove(playerCube); // Remove fallback cube when car model loads successfully
});

// Load bomb model for falling objects
bombLoader.load('/bomb/scene.gltf', (gltf) => {
  bombModel = gltf.scene;
  bombModel.scale.set(0.01, 0.01, 0.01); // Scale down bomb model significantly
  // Enable shadows for all meshes in the bomb model
  bombModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
});

// Load ghost model for enemy characters
ghostLoader.load('/blinky_from_pacman.glb', (gltf) => {
  ghostModel = gltf.scene;
  ghostModel.scale.set(0.5, 0.5, 0.5); // Scale ghost model appropriately
  // Enable shadows for all meshes in the ghost model
  ghostModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
});

// Mobile device detection
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0);
}

// Input handling system using arrow keys and spacebar
const keys = { 
  ArrowUp: false,    // Move forward
  ArrowDown: false,  // Move backward
  ArrowLeft: false,  // Move left
  ArrowRight: false, // Move right
  ' ': false         // Spacebar for interactions
};

// Handle key press events
window.addEventListener('keydown', (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
    e.preventDefault(); // Prevent default browser behavior (scrolling with arrow keys)
  }
});

// Handle key release events
window.addEventListener('keyup', (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
    e.preventDefault();
  }
});

// Mobile virtual joystick creation and management
let mobileJoystick = null;
let joystickData = {
  active: false,
  x: 0, // -1 to 1 (left to right)
  y: 0, // -1 to 1 (up to down)
  centerX: 0,
  centerY: 0,
  maxDistance: 50
};

function createMobileJoystick() {
  if (mobileJoystick || !isMobileDevice()) return;

  // Create joystick container
  mobileJoystick = document.createElement('div');
  mobileJoystick.id = 'mobile-joystick';
  mobileJoystick.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 30px;
    width: 120px;
    height: 120px;
    z-index: 1000;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    touch-action: none;
  `;

  // Create joystick base (outer circle)
  const joystickBase = document.createElement('div');
  joystickBase.style.cssText = `
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: 3px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  `;

  // Create joystick knob (inner circle)
  const joystickKnob = document.createElement('div');
  joystickKnob.style.cssText = `
    position: absolute;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #333;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transition: all 0.1s ease;
  `;

  // Create interaction button in center
  const interactionButton = document.createElement('div');
  interactionButton.style.cssText = `
    position: absolute;
    width: 60px;
    height: 30px;
    background: rgba(255, 152, 0, 0.9);
    border: 2px solid #333;
    border-radius: 15px;
    color: white;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    bottom: -50px;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    touch-action: manipulation;
  `;
  interactionButton.innerHTML = '⚡ ACTION';

  mobileJoystick.appendChild(joystickBase);
  mobileJoystick.appendChild(joystickKnob);
  mobileJoystick.appendChild(interactionButton);

  // Store references
  mobileJoystick.base = joystickBase;
  mobileJoystick.knob = joystickKnob;
  mobileJoystick.actionBtn = interactionButton;

  // Set up joystick center coordinates
  joystickData.centerX = 60; // Half of container width
  joystickData.centerY = 60; // Half of container height

  // Touch event handlers for joystick
  const handleJoystickStart = (e) => {
    e.preventDefault();
    joystickData.active = true;
    joystickKnob.style.transition = 'none';
    updateJoystick(e);
  };

  const handleJoystickMove = (e) => {
    e.preventDefault();
    if (joystickData.active) {
      updateJoystick(e);
    }
  };

  const handleJoystickEnd = (e) => {
    e.preventDefault();
    joystickData.active = false;
    joystickData.x = 0;
    joystickData.y = 0;
    
    // Reset knob to center with smooth transition
    joystickKnob.style.transition = 'all 0.2s ease';
    joystickKnob.style.transform = 'translate(-50%, -50%)';
    
    // Clear movement keys
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  };

  // Add touch events to base
  joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
  joystickBase.addEventListener('touchmove', handleJoystickMove, { passive: false });
  joystickBase.addEventListener('touchend', handleJoystickEnd, { passive: false });

  // Action button events
  interactionButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys[' '] = true;
    interactionButton.style.background = 'rgba(255, 100, 0, 1)';
    interactionButton.style.transform = 'translateX(-50%) scale(0.95)';
  });

  interactionButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys[' '] = false;
    interactionButton.style.background = 'rgba(255, 152, 0, 0.9)';
    interactionButton.style.transform = 'translateX(-50%) scale(1)';
  });

  document.body.appendChild(mobileJoystick);
}

function updateJoystick(e) {
  const touch = e.touches[0];
  const rect = mobileJoystick.getBoundingClientRect();
  
  // Calculate relative position from joystick center
  const relativeX = touch.clientX - rect.left - joystickData.centerX;
  const relativeY = touch.clientY - rect.top - joystickData.centerY;
  
  // Calculate distance from center
  const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
  
  // Limit knob movement to maxDistance
  let limitedX = relativeX;
  let limitedY = relativeY;
  
  if (distance > joystickData.maxDistance) {
    const ratio = joystickData.maxDistance / distance;
    limitedX = relativeX * ratio;
    limitedY = relativeY * ratio;
  }
  
  // Update knob position
  mobileJoystick.knob.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
  
  // Calculate normalized values (-1 to 1)
  joystickData.x = limitedX / joystickData.maxDistance;
  joystickData.y = limitedY / joystickData.maxDistance;
  
  // Convert joystick input to key states (with deadzone)
  const deadzone = 0.2;
  
  keys.ArrowLeft = joystickData.x < -deadzone;
  keys.ArrowRight = joystickData.x > deadzone;
  keys.ArrowUp = joystickData.y < -deadzone;
  keys.ArrowDown = joystickData.y > deadzone;
}

function hideMobileJoystick() {
  if (mobileJoystick) {
    document.body.removeChild(mobileJoystick);
    mobileJoystick = null;
    joystickData.active = false;
    joystickData.x = 0;
    joystickData.y = 0;
  }
}

// Game state variables
const scoreDiv = document.getElementById('score'); // Reference to score display element
let score = 0;        // Player's current score
let waveNumber = 1;   // Current wave/level number

// Game object arrays
let collectibles = []; // Red boxes to collect for points
let cones = [];       // Orange falling cones that damage player
let bombs = [];       // Falling bombs that damage player

// Falling object configuration
const coneFallSpeed = 0.125;    // Speed at which objects fall
const coneSpawnInterval = 400;  // Milliseconds between spawning falling objects
let gameOver = false;           // Game state flag
let gameStarted = false;        // Flag to track if game has actually started

// Ghost enemy system variables
let ghost = null;           // Current ghost instance
let ghostSpawned = false;   // Flag to track if ghost is active
const ghostSpeed = 0.06;    // Ghost movement speed (slower than player)

// Power pellet protection system variables
let powerPellet = null;         // Current power pellet instance
let powerPelletSpawned = false; // Flag to prevent multiple pellets
let protectionActive = false;   // Flag indicating if player has protection

// Follower mob protection system variables
let followers = [];                    // Array of follower entities that protect player
const followerSpawnDelay = 8000;      // Delay before followers spawn after protection activation
const followerSpeed = 0.15;           // Follower movement speed
let followersSpawned = false;          // Flag to control follower spawning
let gameStartTime = 0;                 // Timestamp when game started

// Camera control system variables
let isDragging = false;                                      // Flag for mouse drag state
let previousMousePosition = { x: 0, y: 0 };                 // Last mouse position for drag calculations
let cameraOffset = new THREE.Vector3(5, 10, 8);             // Camera position relative to player
let isFollowingPlayer = true;                                // Flag for camera follow mode

// Leaderboard system variables
let playerName = '';                     // Player's name for leaderboard
let currentLeaderboard = [];             // Current leaderboard data
let leaderboardContainer = null;         // Reference to leaderboard display
let nameInputContainer = null;           // Reference to name input UI
// Use relative URL in production, localhost in development
const SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : '/api';

// Leaderboard API functions
// Fetch current leaderboard from server
async function fetchLeaderboard() {
  try {
    const response = await fetch(`${SERVER_URL}/leaderboard`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.leaderboard) {
        currentLeaderboard = data.leaderboard;
        return currentLeaderboard;
      }
    }
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
  }
  return [];
}

// Submit score to server leaderboard
async function submitScore(name, score) {
  try {
    const response = await fetch(`${SERVER_URL}/leaderboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        playerName: name, 
        score: score, 
        wave: waveNumber 
      }),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to submit score:', error);
  }
  return null;
}

// Show name input dialog before game starts
function showNameInput() {
  if (nameInputContainer) return; // Prevent multiple dialogs

  nameInputContainer = document.createElement('div');
  nameInputContainer.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9); padding: 30px; border-radius: 10px;
    color: white; font-family: Arial, sans-serif; text-align: center;
    z-index: 1000; min-width: 300px;
  `;

  nameInputContainer.innerHTML = `
    <h2>Enter Your Name</h2>
    <input type="text" id="playerNameInput" placeholder="Your name..." maxlength="20" 
           style="padding: 10px; font-size: 16px; border: none; border-radius: 5px; margin: 10px; width: 200px;">
    <br>
    <button id="startGameBtn" style="padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
      Start Game
    </button>
    <button id="skipNameBtn" style="padding: 10px 20px; font-size: 16px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
      Skip
    </button>
  `;

  document.body.appendChild(nameInputContainer);

  const nameInput = document.getElementById('playerNameInput');
  const startBtn = document.getElementById('startGameBtn');
  const skipBtn = document.getElementById('skipNameBtn');

  // Handle start game with name
  startBtn.addEventListener('click', () => {
    playerName = nameInput.value.trim() || 'Anonymous';
    hideNameInput();
    startGame();
  });

  // Handle skip name entry
  skipBtn.addEventListener('click', () => {
    playerName = 'Anonymous';
    hideNameInput();
    startGame();
  });

  // Handle Enter key
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      startBtn.click();
    }
  });

  nameInput.focus();
}

// Hide name input dialog
function hideNameInput() {
  if (nameInputContainer) {
    document.body.removeChild(nameInputContainer);
    nameInputContainer = null;
  }
}

// Show leaderboard display
async function showLeaderboard() {
  console.log('showLeaderboard called'); // Debug log
  await fetchLeaderboard();
  console.log('Current leaderboard data:', currentLeaderboard); // Debug log
  
  if (leaderboardContainer) return; // Prevent multiple displays

  leaderboardContainer = document.createElement('div');
  leaderboardContainer.style.cssText = `
    position: fixed; top: 50%; right: 50px; transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.9); padding: 20px; border-radius: 10px;
    color: white; font-family: Arial, sans-serif; min-width: 280px;
    max-height: 400px; overflow-y: auto; z-index: 100;
    border: 2px solid #FF9800; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;

  let leaderboardHTML = '<h3 style="margin-top: 0; color: #FF9800; text-align: center;">🏆 Leaderboard</h3>';
  if (currentLeaderboard.length === 0) {
    leaderboardHTML += '<p style="text-align: center; color: #ccc;">No scores yet!</p>';
  } else {
    leaderboardHTML += '<div style="margin: 10px 0;">';
    currentLeaderboard.slice(0, 10).forEach((entry, index) => {
      const isCurrentPlayer = entry.playerName === playerName && Math.abs(entry.score - score) < 0.01;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const style = isCurrentPlayer ? 'color: gold; font-weight: bold; background: rgba(255,215,0,0.2); padding: 5px; border-radius: 3px;' : 'padding: 5px;';
      leaderboardHTML += `
        <div style="${style} margin: 3px 0; display: flex; justify-content: space-between;">
          <span>${medal} ${entry.playerName}</span>
          <span style="color: #4CAF50; font-weight: bold;">${entry.score}</span>
        </div>
      `;
    });
    leaderboardHTML += '</div>';
  }

  leaderboardHTML += '<div style="text-align: center; margin-top: 15px;"><button onclick="toggleLeaderboard()" style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button></div>';

  leaderboardContainer.innerHTML = leaderboardHTML;
  document.body.appendChild(leaderboardContainer);
}

// Hide leaderboard display
function hideLeaderboard() {
  if (leaderboardContainer) {
    document.body.removeChild(leaderboardContainer);
    leaderboardContainer = null;
  }
}

// Toggle leaderboard display (for the button)
async function toggleLeaderboard() {
  console.log('Leaderboard button clicked!'); // Debug log
  if (leaderboardContainer) {
    hideLeaderboard();
  } else {
    await showLeaderboard();
  }
}

// Make toggleLeaderboard globally available for the HTML button
window.toggleLeaderboard = toggleLeaderboard;
let cameraTarget = new THREE.Vector3(0, 0, 0);              // Point where camera looks

// Tile system variables for procedural world generation
const tiles = new Map();           // Storage for generated world tiles
const interactiveTiles = [];       // Array of tiles that can be clicked
let currentPlayerTile = null;      // Current tile player is standing on
let previousPlayerTileKey = null;  // Previous tile for reset purposes

// Interactive tile types with associated websites
const tileTypes = [
  { color: 0x4CAF50, website: 'https://threejs.org', name: 'Three.js' },  // Green tile links to Three.js
  { color: 0x2196F3, website: 'https://github.com/director-rob/INFO4235Project', name: 'GitHub' },     // Blue tile links to GitHub
];

// Mouse event listeners for camera dragging and tile interaction
const canvas = document.getElementById('three-canvas');
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mousemove', onMouseMove, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('click', onMouseClick, false);

// Handle mouse press for camera dragging
function onMouseDown(event) {
  isDragging = true;
  isFollowingPlayer = false; // Disable automatic camera following
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY
  };
}

// Handle mouse movement for camera panning
function onMouseMove(event) {
  if (!isDragging) return;
  
  // Calculate mouse movement delta
  const deltaMove = {
    x: event.clientX - previousMousePosition.x,
    y: event.clientY - previousMousePosition.y
  };
  
  // Calculate camera orientation vectors for proper panning
  const camera_direction = new THREE.Vector3();
  camera.getWorldDirection(camera_direction);
  
  const camera_right = new THREE.Vector3();
  camera_right.crossVectors(camera.up, camera_direction).normalize();
  
  const camera_up = new THREE.Vector3();
  camera_up.crossVectors(camera_direction, camera_right).normalize();
  
  const panSpeed = 0.05; // Camera panning sensitivity
  
  // Apply mouse movement to camera target position
  const panX = camera_right.clone().multiplyScalar(-deltaMove.x * panSpeed);
  const panY = camera_up.clone().multiplyScalar(deltaMove.y * panSpeed);
  
  cameraTarget.add(panX).add(panY);
  
  // Update camera position to maintain offset from new target
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY
  };
}

// Handle mouse release to stop camera dragging
function onMouseUp() {
  isDragging = false;
}

// Handle mouse clicks for tile interactions
function onMouseClick(event) {
  // Only process clicks if we weren't dragging the camera
  if (!isDragging) {
    // Convert mouse coordinates to normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Create raycaster to detect which tile was clicked
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with interactive tiles
    const intersects = raycaster.intersectObjects(interactiveTiles);
    if (intersects.length > 0) {
      const tile = intersects[0].object;
      if (tile.userData.website) {
        window.open(tile.userData.website, '_blank'); // Open associated website
      }
    }
  }
}

// Geometry and materials for game objects
const coneGeometry = new THREE.ConeGeometry(0.3, 1, 8);                    // Orange falling cones
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });

// Follower mob appearance (friendly green cylinders)
const followerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
const followerMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x44ff44,           // Bright green color
  emissive: 0x003300,        // Dark green emissive
  emissiveIntensity: 0.2     // Subtle glow effect
});

// Power pellet appearance (bright green boxes)
const powerPelletGeometry = new THREE.BoxGeometry(1.5, 0.8, 1.5);
const powerPelletMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x00ff00,           // Bright green color
  emissive: 0x004400,        // Dark green emissive
  emissiveIntensity: 0.3     // Noticeable glow effect
});

// Ghost fallback appearance (red cylinders when model fails to load)
const ghostGeometry = new THREE.CylinderGeometry(1, 1, 2, 16);
const ghostMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff4444,           // Red color for danger
  emissive: 0x440000,        // Dark red emissive
  emissiveIntensity: 0.3     // Threatening glow effect
});

// Explosion particle system variables
const explosionParticles = [];  // Array to store explosion particle objects
const explosionDuration = 1000; // How long explosion lasts in milliseconds
let explosionStartTime = 0;     // Timestamp when explosion started
let gameOverDiv = null;         // Reference to game over display element

// Display game over screen with leaderboard submission
async function showGameOver() {
  if (gameOverDiv) return; // Prevent multiple game over screens

  // Hide mobile joystick during game over
  hideMobileJoystick();

  // Submit score to leaderboard if player has a name
  if (playerName && playerName !== 'Anonymous') {
    await submitScore(playerName, score);
  }

  gameOverDiv = document.createElement('div');
  gameOverDiv.style = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                       background: rgba(0, 0, 0, 0.9); padding: 30px; border-radius: 10px;
                       color: red; font-size: 24px; font-weight: bold; user-select: none; text-align: center;
                       min-width: 400px; z-index: 1000;`;
  
  let gameOverHTML = `
    <h2 style="color: red; margin-top: 0;">GAME OVER</h2>
    <p style="color: white; font-size: 18px;">Final Score: ${score}</p>
  `;

  // Show name input for leaderboard if player is anonymous
  if (!playerName || playerName === 'Anonymous') {
    gameOverHTML += `
      <p style="color: white; font-size: 16px;">Enter your name for the leaderboard:</p>
      <input type="text" id="gameOverNameInput" placeholder="Your name..." maxlength="20" 
             style="padding: 10px; font-size: 16px; border: none; border-radius: 5px; margin: 10px; width: 200px;">
      <br>
      <button id="submitScoreBtn" style="padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
        Submit Score
      </button>
    `;
  }

  gameOverHTML += `
    <br>
    <button id="restartBtn" style="padding: 10px 20px; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
      Restart Game
    </button>
    <button id="viewLeaderboardBtn" style="padding: 10px 20px; font-size: 16px; background: #FF9800; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
      View Leaderboard
    </button>
  `;

  gameOverDiv.innerHTML = gameOverHTML;
  document.body.appendChild(gameOverDiv);

  // Set up event listeners
  const restartBtn = document.getElementById('restartBtn');
  const leaderboardBtn = document.getElementById('viewLeaderboardBtn');
  const submitBtn = document.getElementById('submitScoreBtn');
  const nameInput = document.getElementById('gameOverNameInput');

  restartBtn.addEventListener('click', () => {
    hideLeaderboard();
    restartGame();
  });

  leaderboardBtn.addEventListener('click', showLeaderboard);

  if (submitBtn && nameInput) {
    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (name) {
        playerName = name;
        await submitScore(name, score);
        // Update the game over screen to remove the input
        showGameOver();
      }
    });

    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  }
}

// Start a new game (called when game begins)
function startGame() {
  // Reset all game state
  score = 0;
  waveNumber = 1;
  gameOver = false;
  gameStarted = true;
  gameStartTime = performance.now();
  
  // Update score display
  scoreDiv.textContent = `Score: ${score}`;
  
  // Hide any UI elements
  hideLeaderboard();
  hideNameInput();
  
  // Show mobile joystick if on mobile device
  createMobileJoystick();
  
  // Spawn the first wave
  spawnWave(waveNumber);
}

// Reset all game systems to initial state
function restartGame() {
  // Clean up UI elements
  if (gameOverDiv) document.body.removeChild(gameOverDiv);
  gameOverDiv = null;
  hideLeaderboard();
  hideNameInput();
  
  // Show mobile joystick if on mobile device
  createMobileJoystick();
  
  // Remove all explosion particles from scene
  explosionParticles.forEach(p => scene.remove(p));
  explosionParticles.length = 0;
  
  // Reset core game state
  score = 0;
  waveNumber = 1;
  gameOver = false;
  gameStarted = true;
  lastConeSpawn = 0;
  
  // Reset follower protection system
  followers.forEach(f => scene.remove(f));
  followers.length = 0;
  followersSpawned = false;
  gameStartTime = performance.now();
  
  // Reset ghost enemy system
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
  
  // Update score display and clear all game objects
  scoreDiv.textContent = `Score: ${score}`;
  
  // Remove all collectibles
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  
  // Remove all falling cones and their shadow indicators
  cones.forEach(c => {
    scene.remove(c);
    if (c.userData.shadowIndicator) {
      scene.remove(c.userData.shadowIndicator);
    }
  });
  cones.length = 0;
  
  // Remove all falling bombs and their shadow indicators
  bombs.forEach(b => {
    scene.remove(b);
    if (b.userData.shadowIndicator) {
      scene.remove(b.userData.shadowIndicator);
    }
  });
  bombs.length = 0;
  
  // Reset player position to world origin
  (playerModel || playerCube).position.set(0, playerModel ? 0 : 0.5, 0);
  
  // Ensure player model is in scene
  if (playerModel) scene.add(playerModel);
  else if (!scene.children.includes(playerCube)) scene.add(playerCube);
  
  // Start first wave
  spawnWave(waveNumber);
}

// Listen for restart key when game is over
window.addEventListener('keydown', (e) => {
  if (gameOver && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    restartGame();
  }
});

// Procedurally generate world tiles around the player's position
function generateTilesAroundPlayer() {
  const player = playerModel || playerCube;
  // Calculate which tile grid the player is currently in
  const playerX = Math.floor(player.position.x / tileSize);
  const playerZ = Math.floor(player.position.z / tileSize);
  
  const renderDistance = 20; // Number of tiles to render around player
  
  // Generate tiles in a square grid around the player
  for (let x = playerX - renderDistance; x <= playerX + renderDistance; x++) {
    for (let z = playerZ - renderDistance; z <= playerZ + renderDistance; z++) {
      const tileKey = `${x},${z}`;
      
      if (!tiles.has(tileKey)) {
        // Skip generating tiles in the main play area to avoid overlap
        if (Math.abs(x) <= 2 && Math.abs(z) <= 2) continue;
        
        // Calculate world position for this tile
        const tileX = x * tileSize;
        const tileZ = z * tileSize;
        
        // Randomly determine if this tile should be interactive
        const isInteractive = Math.random() < 0.1; // 10% chance for interactive tiles
        
        let tileMaterial;
        let tileData = { website: null, name: null };
        
        if (isInteractive) {
          // Create interactive tile with associated website
          const tileType = tileTypes[Math.floor(Math.random() * tileTypes.length)];
          tileMaterial = new THREE.MeshStandardMaterial({ 
            color: tileType.color,
            emissive: tileType.color,
            emissiveIntensity: 0.2
          });
          tileData = { website: tileType.website, name: tileType.name, isInteractive: true };
        } else {
          // Create regular landscape tile with color variation
          const blueVariation = Math.floor(Math.random() * 0x222222); // Subtle color variation
          const babyBlue = 0x87CEEB + blueVariation - 0x111111; // Variations around baby blue
          tileMaterial = new THREE.MeshStandardMaterial({ color: babyBlue });
          tileData = { website: null, name: null, isInteractive: false };
        }
        
        // Create and position the tile
        const tileGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.rotation.x = -Math.PI / 2; // Rotate to lie flat
        tile.position.set(tileX + tileSize/2, 0, tileZ + tileSize/2); // Center in grid cell
        tile.userData = tileData;
        tile.receiveShadow = true;
        
        scene.add(tile);
        tiles.set(tileKey, tile);
        
        // Add text label for interactive tiles
        if (isInteractive) {
          interactiveTiles.push(tile);
          
          // Create canvas texture for tile label
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
          
          // Create label mesh above the tile
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

// Check if player is standing on an interactive tile and handle spacebar interaction
function checkTileInteraction() {
  const player = playerModel || playerCube;
  
  // Calculate player's ground position (accounting for model center vs position)
  let playerGroundX, playerGroundZ;
  
  if (playerModel) {
    // For car model, use bounding box center for accurate ground position
    const boundingBox = new THREE.Box3().setFromObject(playerModel);
    const center = boundingBox.getCenter(new THREE.Vector3());
    playerGroundX = center.x;
    playerGroundZ = center.z;
  } else {
    // For cube fallback, use position directly
    playerGroundX = player.position.x;
    playerGroundZ = player.position.z;
  }
  
  // Determine which tile the player is standing on
  const playerX = Math.floor(playerGroundX / tileSize);
  const playerZ = Math.floor(playerGroundZ / tileSize);
  const tileKey = `${playerX},${playerZ}`;
  
  // Check if spacebar is pressed while on an interactive tile
  if (tiles.has(tileKey)) {
    const tile = tiles.get(tileKey);
    if (tile.userData.website && keys[' ']) {
      window.open(tile.userData.website, '_blank'); // Open associated website
      keys[' '] = false; // Prevent multiple opens from single press
    }
  }
}

// Update visual effects for the tile the player is currently standing on
function updatePlayerTile(time) {
  const player = playerModel || playerCube;
  
  // Calculate accurate player ground position
  let playerGroundX, playerGroundZ;
  
  if (playerModel) {
    // For car model, use bounding box center for precise positioning
    const boundingBox = new THREE.Box3().setFromObject(playerModel);
    const center = boundingBox.getCenter(new THREE.Vector3());
    playerGroundX = center.x;
    playerGroundZ = center.z;
  } else {
    // For cube fallback, use direct position
    playerGroundX = player.position.x;
    playerGroundZ = player.position.z;
  }
  
  // Calculate which tile grid cell the player is in
  const playerX = Math.floor(playerGroundX / tileSize);
  const playerZ = Math.floor(playerGroundZ / tileSize);
  const tileKey = `${playerX},${playerZ}`;
  
  // Reset visual effects on previous tile when player moves
  if (previousPlayerTileKey && previousPlayerTileKey !== tileKey && tiles.has(previousPlayerTileKey)) {
    const prevTile = tiles.get(previousPlayerTileKey);
    prevTile.position.y = 0; // Reset height to ground level
    
    // Reset material to original appearance
    if (prevTile.userData.isInteractive) {
      prevTile.material.emissiveIntensity = 0.2; // Restore original glow
    } else {
      prevTile.material.emissive.setHex(0x000000); // Remove glow from regular tiles
    }
  }
  
  // Apply visual effects to current tile
  if (tiles.has(tileKey)) {
    const tile = tiles.get(tileKey);
    currentPlayerTile = tile;
    
    // Create gentle bobbing motion
    const bobSpeed = 0.003;  // Animation speed
    const bobHeight = 0.15;  // Maximum height of bobbing motion
    const bobOffset = Math.sin(time * bobSpeed) * bobHeight;
    tile.position.y = Math.max(0, bobOffset); // Ensure tile never goes below ground
    
    // Apply glowing effect based on tile type
    if (tile.userData.isInteractive) {
      // Interactive tiles get enhanced pulsing glow with original color
      tile.material.emissiveIntensity = 0.4 + Math.sin(time * 0.005) * 0.1;
    } else {
      // Regular tiles get bright blue glow when player stands on them
      const glowIntensity = 0.3 + Math.sin(time * 0.005) * 0.5; // Pulsing effect
      tile.material.emissive.setHex(0x4499FF); // Bright blue glow
      tile.material.emissiveIntensity = glowIntensity;
    }
  } else {
    currentPlayerTile = null;
  }
  
  // Update tracking variable for next frame
  previousPlayerTileKey = tileKey;
}

// Create a new wave of collectibles and initialize wave-specific systems
function spawnWave(waveNum) {
  // Remove all existing collectibles from previous wave
  collectibles.forEach(c => scene.remove(c));
  collectibles.length = 0;
  
  // Create more collectibles for higher waves
  const count = 5 * waveNum;
  for (let i = 0; i < count; i++) {
    // Create red collectible boxes
    const geo = new THREE.BoxGeometry(2, 0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const collectible = new THREE.Mesh(geo, mat);
    
    // Randomly position collectibles within the main play area
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
  
  // Preserve followers between waves but allow more to be spawned
  followersSpawned = false;
  
  // Spawn power pellet if none exists
  if (!powerPelletSpawned) {
    spawnPowerPellet();
  }
  
  // Reset player position to center of play area
  (playerModel || playerCube).position.set(0, playerModel ? 0 : 0.5, 0);
}

// Spawn falling cone objects with shadow indicators
let lastConeSpawn = 0; // Timestamp of last cone spawn

function spawnCone() {
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  
  // Position cone randomly within play area at high altitude
  cone.position.set((Math.random() - 0.5) * 19, 20, (Math.random() - 0.5) * 19);
  cone.rotation.x = Math.PI; // Flip cone upside down
  cone.castShadow = true;
  cone.receiveShadow = true;
  
  // Create ground shadow indicator to show where cone will land
  const shadowGeometry = new THREE.CircleGeometry(0.5, 16);
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000,    // Black shadow
    transparent: true, 
    opacity: 0.1        // Start very faint
  });
  const shadowIndicator = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowIndicator.rotation.x = -Math.PI / 2; // Lie flat on ground
  shadowIndicator.position.set(cone.position.x, 0.01, cone.position.z); // Slightly above ground
  scene.add(shadowIndicator);
  
  // Store shadow reference and height data on the cone
  cone.userData.shadowIndicator = shadowIndicator;
  cone.userData.maxHeight = 20; // Starting height for shadow calculations
  
  scene.add(cone);
  cones.push(cone);
}

// Spawn friendly follower entities that protect the player from ghosts
function spawnFollowers() {
  if (followersSpawned || !protectionActive) return; // Only spawn when protection is active
  
  // Scale follower count with wave number for increased challenge
  const numFollowers = 3 + Math.floor(waveNumber / 2);
  for (let i = 0; i < numFollowers; i++) {
    const follower = new THREE.Mesh(followerGeometry, followerMaterial.clone());
    
    // Position followers behind the player with slight variations
    const baseAngle = Math.PI; // 180 degrees (behind player)
    const angleVariation = (Math.random() - 0.5) * 0.8; // Random spread of ±23 degrees
    const angle = baseAngle + angleVariation;
    const spawnDistance = 25 + Math.random() * 10; // Vary spawn distance
    const player = playerModel || playerCube;
    follower.position.set(
      player.position.x + Math.cos(angle) * spawnDistance,
      0.5, // Ground level
      player.position.z + Math.sin(angle) * spawnDistance
    );
    
    // Initialize follower behavior data
    follower.userData = {
      bouncePhase: Math.random() * Math.PI * 2, // Random starting animation phase
      bounceSpeed: 0.01 + Math.random() * 0.005, // Slight speed variation
      collisionCount: 0,    // Track hits taken from ghosts
      maxCollisions: 3,     // Maximum hits before follower is destroyed
      isFlashing: false,    // Visual feedback when hit
      flashStartTime: 0     // Timestamp for flash effect timing
    };
    
    follower.castShadow = true;
    follower.receiveShadow = true;
    scene.add(follower);
    followers.push(follower);
  }
  followersSpawned = true;
}

// Update AI behavior and visual effects for all follower entities
function updateFollowers(time) {
  const player = playerModel || playerCube;
  if (!player) return;
  
  followers.forEach((follower, index) => {
    // Handle red flashing effect when follower takes damage
    if (follower.userData.isFlashing) {
      const flashDuration = 500; // Flash lasts 0.5 seconds
      const elapsed = time - follower.userData.flashStartTime;
      if (elapsed < flashDuration) {
        // Apply red flashing effect
        const flashIntensity = Math.sin(elapsed * 0.02) * 0.5 + 0.5;
        follower.material.color.setHex(0xff0000);  // Red color
        follower.material.emissive.setHex(0x440000); // Dark red emissive
        follower.material.emissiveIntensity = flashIntensity * 0.5;
      } else {
        // Return to normal green appearance
        follower.userData.isFlashing = false;
        follower.material.color.setHex(0x44ff44);    // Bright green
        follower.material.emissive.setHex(0x003300);  // Dark green emissive
        follower.material.emissiveIntensity = 0.2;
      }
    }
    
    // Handle collision with ghost enemies
    if (ghost && checkCollision(follower, ghost)) {
      follower.userData.collisionCount++;
      follower.userData.isFlashing = true;
      follower.userData.flashStartTime = time;
      
      // Push ghost away from follower (defensive bounce)
      const bounceDirection = new THREE.Vector3();
      bounceDirection.subVectors(ghost.position, follower.position).normalize();
      ghost.position.addScaledVector(bounceDirection, 5); // Push ghost away
      
      // Remove follower if it has taken maximum damage
      if (follower.userData.collisionCount >= follower.userData.maxCollisions) {
        scene.remove(follower);
        followers.splice(index, 1);
        return;
      }
    }
    
    // Calculate direction vector from follower to player
    const direction = new THREE.Vector3();
    direction.subVectors(player.position, follower.position);
    const distanceToPlayer = direction.length();
    direction.normalize();
    
    // Implement separation behavior to prevent followers from clumping together
    const separationForce = new THREE.Vector3();
    const separationDistance = 2.5; // Minimum distance to maintain between followers
    
    followers.forEach((otherFollower, otherIndex) => {
      if (index === otherIndex) return; // Skip self
      
      const separationDir = new THREE.Vector3();
      separationDir.subVectors(follower.position, otherFollower.position);
      const separationDist = separationDir.length();
      
      // Apply repulsive force if too close to another follower
      if (separationDist < separationDistance && separationDist > 0) {
        separationDir.normalize();
        separationDir.multiplyScalar((separationDistance - separationDist) / separationDistance);
        separationForce.add(separationDir);
      }
    });
    
    // Implement patient following behavior with staggered positioning
    const followDistance = 3 + (index * 0.8); // Each follower maintains different distance
    const finalDirection = new THREE.Vector3();
    
    if (distanceToPlayer > followDistance) {
      // Move towards player while maintaining separation from other followers
      finalDirection.copy(direction);
      finalDirection.multiplyScalar(followerSpeed * 0.8); // Patient, not rushed movement
      finalDirection.add(separationForce.multiplyScalar(0.4)); // Apply separation force
      
      follower.position.add(finalDirection);
      
      // Add animated hopping motion while moving
      follower.userData.bouncePhase += follower.userData.bounceSpeed * 1.5;
      const hopHeight = Math.abs(Math.sin(follower.userData.bouncePhase)) * 0.3;
      follower.position.y = 0.5 + hopHeight;
    } else {
      // Wait patiently with subtle idle animation
      follower.userData.bouncePhase += follower.userData.bounceSpeed * 0.3; // Slow idle bounce
      const gentleBounce = Math.sin(follower.userData.bouncePhase) * 0.08; // Subtle movement
      follower.position.y = 0.5 + gentleBounce;
      
      // Still maintain separation even when idle
      if (separationForce.length() > 0) {
        separationForce.multiplyScalar(0.3);
        follower.position.add(separationForce);
      }
    }
    
    // Always face towards the player
    follower.lookAt(player.position);
  });
}

// Spawn falling bomb objects at safe distance from player
function spawnBomb() {
  if (!bombModel || (!playerModel && !playerCube)) return; // Only spawn if bomb model loaded and player exists
  
  // Get current player position for safe spawn distance calculation
  const px = playerModel ? playerModel.position.x : playerCube.position.x;
  const pz = playerModel ? playerModel.position.z : playerCube.position.z;
  let x, z;
  const minDistance = 6; // Minimum safe distance from player
  let attempts = 0;
  
  // Find spawn position that's not too close to player
  do {
    x = (Math.random() - 0.5) * 19; // Random position within play area
    z = (Math.random() - 0.5) * 19;
    attempts++;
  } while (Math.hypot(x - px, z - pz) < minDistance && attempts < 10);
  
  // Create bomb clone from loaded model
  const bombClone = bombModel.clone(true);
  bombClone.position.set(x, 20, z); // Spawn from high altitude
  bombClone.rotation.set(Math.PI / 2, 0, 0); // Rotate for proper orientation
  
  // Enable shadow casting for all meshes in the bomb model
  bombClone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // Create red danger shadow indicator on ground
  const shadowGeometry = new THREE.CircleGeometry(0.8, 16); // Larger shadow than cones
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,   // Red color to indicate danger
    transparent: true, 
    opacity: 0.1       // Start faint, will intensify as bomb approaches
  });
  const shadowIndicator = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowIndicator.rotation.x = -Math.PI / 2; // Lie flat on ground
  shadowIndicator.position.set(x, 0.01, z); // Slightly above ground to avoid z-fighting
  scene.add(shadowIndicator);
  
  // Store shadow reference and initial height for calculations
  bombClone.userData.shadowIndicator = shadowIndicator;
  bombClone.userData.maxHeight = 20; // Starting height for shadow intensity calculations
  
  scene.add(bombClone);
  bombs.push(bombClone);
}

// Spawn power pellet that activates follower protection system
function spawnPowerPellet() {
  if (powerPelletSpawned) return; // Prevent multiple pellets from spawning
  
  powerPellet = new THREE.Mesh(powerPelletGeometry, powerPelletMaterial);
  // Position randomly within the main play area
  powerPellet.position.set(
    (Math.random() - 0.5) * 19, 
    0.4, // Slightly above ground for visibility
    (Math.random() - 0.5) * 19
  );
  powerPellet.castShadow = true;
  powerPellet.receiveShadow = true;
  scene.add(powerPellet);
  powerPelletSpawned = true;
}

// Spawn ghost enemy that chases the player
function spawnGhost() {
  if (ghostSpawned || waveNumber < 1) return; // Only spawn one ghost per wave
  
  // Use loaded GLTF model if available, otherwise fallback to cylinder geometry
  if (ghostModel) {
    ghost = ghostModel.clone(true); // Clone the loaded model
    
    // Calculate original model dimensions for proper scaling
    const originalBox = new THREE.Box3().setFromObject(ghost);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    
    // Target dimensions to match fallback cylinder (radius=1, height=2)
    const targetWidth = 2;  // Diameter of cylinder
    const targetHeight = 2; // Height of cylinder
    
    // Calculate scale factors to match cylinder dimensions
    const scaleX = targetWidth / originalSize.x;
    const scaleY = targetHeight / originalSize.y;
    const scaleZ = targetWidth / originalSize.z;
    
    // Use uniform scaling to maintain model proportions
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    ghost.scale.set(uniformScale, uniformScale, uniformScale);
    
    // Recalculate bounding box after scaling to get accurate positioning
    const scaledBox = new THREE.Box3().setFromObject(ghost);
    const scaledSize = scaledBox.getSize(new THREE.Vector3());
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    
    // Position model so bottom sits on ground (y=0)
    ghost.position.y = scaledSize.y * 0.5 + Math.abs(scaledCenter.y); // Ensure bottom is at y=0
  } else {
    // Fallback to cylinder geometry if model fails to load
    ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);
    ghost.position.y = 1.0; // Center height for cylinder (radius=1, so center at y=1)
  }
  
  // Position ghost at random location on edge of play area
  const angle = Math.random() * Math.PI * 2;
  const distance = 15; // Distance from center
  ghost.position.x = Math.cos(angle) * distance;
  ghost.position.z = Math.sin(angle) * distance;
  
  // Enable shadow casting for GLTF model meshes
  ghost.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // Enable shadows for fallback cylinder geometry
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

// Main game animation loop - handles all real-time updates and rendering
function animate(time = 0) {
  requestAnimationFrame(animate); // Schedule next frame
  
  // Initialize game timer on first frame
  if (gameStartTime === 0) {
    gameStartTime = time;
  }
  
  // Handle explosion particle effects during game over sequence
  if (explosionParticles.length > 0) {
    const elapsed = performance.now() - explosionStartTime;
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      // Update particle physics
      p.position.addScaledVector(p.userData.velocity, 0.1);
      p.userData.velocity.multiplyScalar(0.9); // Apply friction
      p.material.opacity = 1 - elapsed / explosionDuration; // Fade out over time
      
      // Remove expired particles
      if (p.material.opacity <= 0) {
        scene.remove(p);
        explosionParticles.splice(i, 1);
      }
    }
    
    // Trigger game over state when explosion completes
    if (elapsed >= explosionDuration && !gameOver) {
      gameOver = true;
      showGameOver();
    }
    renderer.render(scene, camera);
    return;
  }
  
  // Skip game logic updates if game is over or not started yet
  if (gameOver || !gameStarted) {
    // Still allow camera updates and basic rendering when game not started
    if (isFollowingPlayer) {
      const player = playerModel || playerCube;
      cameraTarget.copy(player.position);
      camera.position.copy(player.position).add(cameraOffset);
      camera.lookAt(player.position);
    }
    renderer.render(scene, camera);
    return;
  }

  // Spawn follower protection after delay when protection is active
  if (!followersSpawned && protectionActive && time - gameStartTime > followerSpawnDelay) {
    spawnFollowers();
  }
  
  // Spawn ghost enemy starting from wave 1
  if (!ghostSpawned && waveNumber >= 1) {
    spawnGhost();
  }
  
  // Update follower AI and animations
  if (followersSpawned) {
    updateFollowers(time);
  }
  
  // Update ghost AI and ensure proper positioning
  if (ghostSpawned && ghost) {
    updateGhost();
    
    // Safety check to prevent ghost from going underground
    let minAllowedHeight = 0.5; // Default minimum for cylinder
    if (ghostModel && ghost.children.length > 0) {
      // Calculate proper minimum height for GLTF model
      const box = new THREE.Box3().setFromObject(ghost);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      minAllowedHeight = size.y * 0.5 + Math.abs(center.y); // Keep bottom above ground
    }
    
    // Reposition ghost if it somehow goes below ground
    if (ghost.position.y < minAllowedHeight) {
      console.warn("Ghost below ground, repositioning");
      if (ghostModel && ghost.children.length > 0) {
        const box = new THREE.Box3().setFromObject(ghost);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        ghost.position.y = size.y * 0.5 + Math.abs(center.y); // Proper ground positioning
      } else {
        ghost.position.y = 1.0; // Cylinder center height
      }
    }
  }

  // Only process player movement and game interactions when game has started
  if (gameStarted) {
    // Adjust speed for mobile devices (slightly faster for touch controls)
    const baseSpeed = isMobileDevice() ? 0.3 : 0.25;
    const moveVector = new THREE.Vector3(0, 0, 0);
    let isMoving = false;
    
    // Use joystick analog input on mobile, digital keys on desktop
    if (isMobileDevice() && joystickData.active) {
      // Use analog joystick values for smooth movement
      moveVector.x = joystickData.x;
      moveVector.z = joystickData.y;
      
      // Apply deadzone and smooth scaling
      const magnitude = Math.sqrt(moveVector.x * moveVector.x + moveVector.z * moveVector.z);
      if (magnitude > 0.2) { // Deadzone
        isMoving = true;
        // Don't normalize for analog input - use actual magnitude for variable speed
        const speed = baseSpeed * magnitude;
        
        if (playerModel) {
          playerModel.position.addScaledVector(moveVector, speed);
          // Only rotate if moving significantly
          if (magnitude > 0.3) {
            playerModel.rotation.y = Math.atan2(moveVector.x, moveVector.z);
          }
        } else {
          playerCube.position.addScaledVector(moveVector, speed);
          if (magnitude > 0.3) {
            playerCube.rotation.y = Math.atan2(moveVector.x, moveVector.z);
          }
        }
      }
    } else {
      // Use digital arrow keys (desktop or mobile fallback)
      if (keys.ArrowUp) { moveVector.z -= 1; isMoving = true; }
      if (keys.ArrowDown) { moveVector.z += 1; isMoving = true; }
      if (keys.ArrowLeft) { moveVector.x -= 1; isMoving = true; }
      if (keys.ArrowRight) { moveVector.x += 1; isMoving = true; }

      if (moveVector.length() > 0) {
        moveVector.normalize();
        if (playerModel) {
          playerModel.position.addScaledVector(moveVector, baseSpeed);
          playerModel.rotation.y = Math.atan2(moveVector.x, moveVector.z);
        } else {
          playerCube.position.addScaledVector(moveVector, baseSpeed);
          playerCube.rotation.y = Math.atan2(moveVector.x, moveVector.z);
        }
      }
    }
    
    // Snap camera back to following player when moving
    if (isMoving && !isFollowingPlayer) {
      isFollowingPlayer = true;
      cameraOffset = new THREE.Vector3(5, 10, 8); // reset to default offset
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
  }

  const player = playerModel || playerCube;
if (!player || !scene.children.includes(player)) {
  renderer.render(scene, camera);
  return; // no player, stop processing collisions & movement
}

  // Only process game logic (collisions, spawning, etc.) when game has started
  if (gameStarted) {
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
  } // End gameStarted check

  // Render the final frame
  renderer.render(scene, camera);
}

// Initialize the game after a 5-second delay to allow assets to load
setTimeout(() => {
  // Show name input dialog instead of automatically starting
  showNameInput();
}, 5000); // 5-second startup delay

// Start the main animation loop
animate();

// Handle window resize events to maintain proper aspect ratio
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
