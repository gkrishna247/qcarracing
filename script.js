// 3D Game variables
let scene, camera, renderer, gameRunning = false;
let gameSpeed = 0.04, score = 0, lives = 3;
let playerCar, enemyCars = [], powerUps = [], explosions = [];
let keys = {}, road, roadSegments = [];

// Game elements
const gameArea = document.getElementById('gameArea');
const canvas = document.getElementById('gameCanvas');
const scoreElement = document.getElementById('score');
const speedElement = document.getElementById('speed');
const livesElement = document.getElementById('lives');
const gameOverScreen = document.getElementById('gameOver');
const startScreen = document.getElementById('startScreen');
const finalScoreElement = document.getElementById('finalScore');

// Game settings
const PLAYER_SPEED = 0.06;
const ENEMY_SPAWN_RATE = 0.010;
const POWERUP_SPAWN_RATE = 0.008;
const MAX_SPEED = 0.14;
const ROAD_WIDTH = 8;
const ROAD_LENGTH = 100;

// Initialize 3D scene
function init3D() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000033, 10, 100);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
    camera.position.set(0, 3, 5);
    camera.lookAt(0, 0, -10);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(800, 600);
    renderer.setClearColor(0x000033, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lights
    setupLighting();
    
    // Create road
    createRoad();
    
    // Create player car
    createPlayerCar();
    
    // Add environment
    createEnvironment();
}

// Setup lighting
function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // Point lights for car headlights
    const headlight1 = new THREE.PointLight(0xffffff, 0.5, 10);
    headlight1.position.set(-0.3, 0.5, 2);
    scene.add(headlight1);
    
    const headlight2 = new THREE.PointLight(0xffffff, 0.5, 10);
    headlight2.position.set(0.3, 0.5, 2);
    scene.add(headlight2);
}

// Create road
function createRoad() {
    road = new THREE.Group();
    
    // Road surface
    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    const roadMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x333333,
        transparent: true,
        opacity: 0.9
    });
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0;
    roadMesh.receiveShadow = true;
    road.add(roadMesh);
    
    // Road lines
    createRoadLines();
    
    // Road barriers
    createRoadBarriers();
    
    scene.add(road);
}

// Create road lines
function createRoadLines() {
    const lineGeometry = new THREE.BoxGeometry(0.1, 0.02, 2);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    // Center line segments
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 4) {
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(0, 0.01, i);
        roadSegments.push(line);
        road.add(line);
    }
    
    // Side lines
    const sideLineGeometry = new THREE.BoxGeometry(0.15, 0.02, ROAD_LENGTH);
    const leftLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
    leftLine.position.set(-ROAD_WIDTH/2, 0.01, 0);
    road.add(leftLine);
    
    const rightLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
    rightLine.position.set(ROAD_WIDTH/2, 0.01, 0);
    road.add(rightLine);
}

// Create road barriers
function createRoadBarriers() {
    const barrierGeometry = new THREE.BoxGeometry(0.5, 1, 1);
    const barrierMaterial = new THREE.MeshLambertMaterial({ color: 0xff4444 });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 8) {
        // Left barrier
        const leftBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        leftBarrier.position.set(-ROAD_WIDTH/2 - 1, 0.5, i);
        leftBarrier.castShadow = true;
        road.add(leftBarrier);
        
        // Right barrier
        const rightBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        rightBarrier.position.set(ROAD_WIDTH/2 + 1, 0.5, i);
        rightBarrier.castShadow = true;
        road.add(rightBarrier);
    }
}

// Create player car
function createPlayerCar() {
    playerCar = new THREE.Group();
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xff4444 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.25;
    body.castShadow = true;
    playerCar.add(body);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1, 0.4, 1.5);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7;
    roof.position.z = -0.2;
    roof.castShadow = true;
    playerCar.add(roof);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    
    const wheels = [
        { x: -0.7, z: 0.8 },
        { x: 0.7, z: 0.8 },
        { x: -0.7, z: -0.8 },
        { x: 0.7, z: -0.8 }
    ];
    
    wheels.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, 0.3, pos.z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        playerCar.add(wheel);
    });
    
    // Headlights
    const headlightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const headlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffaa,
        emissive: 0xffffaa,
        emissiveIntensity: 0.3
    });
    
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.4, 0.4, 1.3);
    playerCar.add(leftHeadlight);
    
    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.4, 0.4, 1.3);
    playerCar.add(rightHeadlight);
    
    playerCar.position.set(0, 0.1, 2);
    scene.add(playerCar);
}

// Create enemy car
function createEnemyCar(x, z) {
    const enemyCar = new THREE.Group();
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5);
    const colors = [0x4444ff, 0x44ff44, 0xffff44, 0xff44ff];
    const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: colors[Math.floor(Math.random() * colors.length)] 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.25;
    body.castShadow = true;
    enemyCar.add(body);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1, 0.4, 1.5);
    const roofMaterial = new THREE.MeshLambertMaterial({ 
        color: bodyMaterial.color.clone().multiplyScalar(0.8) 
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7;
    roof.position.z = -0.2;
    roof.castShadow = true;
    enemyCar.add(roof);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    
    const wheels = [
        { x: -0.7, z: 0.8 },
        { x: 0.7, z: 0.8 },
        { x: -0.7, z: -0.8 },
        { x: 0.7, z: -0.8 }
    ];
    
    wheels.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, 0.3, pos.z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        enemyCar.add(wheel);
    });
    
    enemyCar.position.set(x, 0.1, z);
    enemyCar.userData = { speed: gameSpeed + Math.random() * 0.02 };
    
    scene.add(enemyCar);
    return enemyCar;
}

// Create power-up
function createPowerUp(x, z) {
    const powerUp = new THREE.Group();
    
    // Main sphere
    const geometry = new THREE.SphereGeometry(0.3, 12, 12);
    const material = new THREE.MeshLambertMaterial({ 
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.2
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    powerUp.add(sphere);
    
    // Rotating ring
    const ringGeometry = new THREE.TorusGeometry(0.4, 0.05, 8, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    powerUp.add(ring);
    
    powerUp.position.set(x, 0.5, z);
    powerUp.userData = { 
        speed: gameSpeed,
        rotationSpeed: 0.05,
        ring: ring
    };
    
    scene.add(powerUp);
    return powerUp;
}

// Create environment
function createEnvironment() {
    // Sky
    const skyGeometry = new THREE.SphereGeometry(200, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000033,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Ground on sides
    const groundGeometry = new THREE.PlaneGeometry(50, ROAD_LENGTH);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x003300 });
    
    const leftGround = new THREE.Mesh(groundGeometry, groundMaterial);
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-25, -0.1, 0);
    leftGround.receiveShadow = true;
    scene.add(leftGround);
    
    const rightGround = new THREE.Mesh(groundGeometry, groundMaterial);
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(25, -0.1, 0);
    rightGround.receiveShadow = true;
    scene.add(rightGround);
    
    // Trees
    createTrees();
}

// Create trees
function createTrees() {
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 3, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    const leavesGeometry = new THREE.SphereGeometry(1.5, 8, 8);
    const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    
    for (let i = 0; i < 20; i++) {
        const tree = new THREE.Group();
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);
        
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 3.5;
        leaves.castShadow = true;
        tree.add(leaves);
        
        const side = Math.random() > 0.5 ? 1 : -1;
        tree.position.set(
            side * (10 + Math.random() * 15),
            0,
            (Math.random() - 0.5) * ROAD_LENGTH
        );
        
        scene.add(tree);
    }
}

// Initialize game
function initGame() {
    gameRunning = false;
    gameSpeed = 0.04;
    score = 0;
    lives = 3;
    
    // Clear arrays
    enemyCars.forEach(car => scene.remove(car));
    powerUps.forEach(powerUp => scene.remove(powerUp));
    explosions.forEach(explosion => scene.remove(explosion));
    
    enemyCars = [];
    powerUps = [];
    explosions = [];
    
    // Reset player position
    if (playerCar) {
        playerCar.position.x = 0;
    }
    
    updateUI();
}

// Start game
function startGame() {
    if (!scene) {
        init3D();
    }
    
    initGame();
    gameRunning = true;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameLoop();
}

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    updatePlayer();
    updateEnemies();
    updatePowerUps();
    updateExplosions();
    updateRoad();
    spawnEnemies();
    spawnPowerUps();
    checkCollisions();
    updateScore();
    updateUI();
    
    // Increase difficulty
    if (score > 0 && score % 1500 === 0) {
        gameSpeed = Math.min(gameSpeed + 0.008, MAX_SPEED);
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    requestAnimationFrame(gameLoop);
}

// Update player
function updatePlayer() {
    if (!playerCar) return;
    
    // Check for left movement (Arrow Left or A key)
    if ((keys['ArrowLeft'] || keys['KeyA']) && playerCar.position.x > -ROAD_WIDTH/2 + 1) {
        playerCar.position.x -= PLAYER_SPEED;
        playerCar.rotation.z = Math.min(playerCar.rotation.z + 0.05, 0.2);
    } 
    // Check for right movement (Arrow Right or D key)
    else if ((keys['ArrowRight'] || keys['KeyD']) && playerCar.position.x < ROAD_WIDTH/2 - 1) {
        playerCar.position.x += PLAYER_SPEED;
        playerCar.rotation.z = Math.max(playerCar.rotation.z - 0.05, -0.2);
    } else {
        playerCar.rotation.z *= 0.9; // Return to center
    }
    
    // Check for acceleration (Arrow Up or W key)
    if ((keys['ArrowUp'] || keys['KeyW']) && gameSpeed < MAX_SPEED) {
        gameSpeed += 0.002;
    }
    // Check for deceleration (Arrow Down or S key)
    if ((keys['ArrowDown'] || keys['KeyS']) && gameSpeed > 0.02) {
        gameSpeed -= 0.002;
    }
}

// Update road animation
function updateRoad() {
    roadSegments.forEach(segment => {
        segment.position.z += gameSpeed * 5;
        if (segment.position.z > ROAD_LENGTH/2) {
            segment.position.z = -ROAD_LENGTH/2;
        }
    });
}

// Spawn enemies
function spawnEnemies() {
    if (Math.random() < ENEMY_SPAWN_RATE) {
        const x = (Math.random() - 0.5) * (ROAD_WIDTH - 2);
        const z = -30;
        const enemy = createEnemyCar(x, z);
        enemyCars.push(enemy);
    }
}

// Update enemies
function updateEnemies() {
    enemyCars.forEach((enemy, index) => {
        enemy.position.z += enemy.userData.speed * 5;
        
        // Remove enemies that are behind the player
        if (enemy.position.z > 10) {
            scene.remove(enemy);
            enemyCars.splice(index, 1);
        }
    });
}

// Spawn power-ups
function spawnPowerUps() {
    if (Math.random() < POWERUP_SPAWN_RATE) {
        const x = (Math.random() - 0.5) * (ROAD_WIDTH - 2);
        const z = -30;
        const powerUp = createPowerUp(x, z);
        powerUps.push(powerUp);
    }
}

// Update power-ups
function updatePowerUps() {
    powerUps.forEach((powerUp, index) => {
        powerUp.position.z += powerUp.userData.speed * 5;
        powerUp.rotation.y += powerUp.userData.rotationSpeed;
        powerUp.userData.ring.rotation.z += 0.1;
        
        // Floating animation
        powerUp.position.y = 0.5 + Math.sin(Date.now() * 0.005 + index) * 0.2;
        
        // Remove power-ups that are behind the player
        if (powerUp.position.z > 10) {
            scene.remove(powerUp);
            powerUps.splice(index, 1);
        }
    });
}

// Create explosion
function createExplosion(x, y, z) {
    const explosion = new THREE.Group();
    
    // Multiple particles for explosion effect
    for (let i = 0; i < 10; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 6, 6);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.5 ? 0xff4444 : 0xffaa00,
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        particle.position.set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.2
            ),
            life: 1.0
        };
        
        explosion.add(particle);
    }
    
    explosion.position.set(x, y, z);
    explosion.userData = { life: 1.0 };
    explosions.push(explosion);
    scene.add(explosion);
}

// Update explosions
function updateExplosions() {
    explosions.forEach((explosion, index) => {
        explosion.userData.life -= 0.02;
        
        explosion.children.forEach(particle => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.01; // Gravity
            particle.material.opacity = explosion.userData.life;
        });
        
        if (explosion.userData.life <= 0) {
            scene.remove(explosion);
            explosions.splice(index, 1);
        }
    });
}

// Check collisions
function checkCollisions() {
    if (!playerCar) return;
    
    const playerBox = new THREE.Box3().setFromObject(playerCar);
    
    // Check enemy collisions
    enemyCars.forEach((enemy, index) => {
        const enemyBox = new THREE.Box3().setFromObject(enemy);
        
        if (playerBox.intersectsBox(enemyBox)) {
            createExplosion(enemy.position.x, enemy.position.y + 0.5, enemy.position.z);
            scene.remove(enemy);
            enemyCars.splice(index, 1);
            lives--;
            
            if (lives <= 0) {
                gameOver();
            }
        }
    });
    
    // Check power-up collisions
    powerUps.forEach((powerUp, index) => {
        const powerUpBox = new THREE.Box3().setFromObject(powerUp);
        
        if (playerBox.intersectsBox(powerUpBox)) {
            scene.remove(powerUp);
            powerUps.splice(index, 1);
            score += 200;
            
            // Random power-up effect
            if (Math.random() > 0.5) {
                lives = Math.min(lives + 1, 5);
            } else {
                score += 300;
            }
        }
    });
}

// Update score
function updateScore() {
    score += Math.floor(gameSpeed * 60);
}

// Update UI
function updateUI() {
    scoreElement.textContent = score;
    speedElement.textContent = Math.floor(gameSpeed * 240);
    livesElement.textContent = lives;
}

// Game over
function gameOver() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'block';
    
    // Clear all game objects
    enemyCars.forEach(enemy => {
        scene.remove(enemy);
    });
    powerUps.forEach(powerUp => {
        scene.remove(powerUp);
    });
    explosions.forEach(explosion => {
        scene.remove(explosion);
    });
    
    enemyCars = [];
    powerUps = [];
    explosions = [];
}

// Restart game
function restartGame() {
    // Hide game over screen
    gameOverScreen.style.display = 'none';
    
    // Reset all game variables
    gameRunning = false;
    gameSpeed = 0.04;
    score = 0;
    lives = 3;
    
    // Clear all game objects from scene
    enemyCars.forEach(enemy => scene.remove(enemy));
    powerUps.forEach(powerUp => scene.remove(powerUp));
    explosions.forEach(explosion => scene.remove(explosion));
    
    // Reset arrays
    enemyCars = [];
    powerUps = [];
    explosions = [];
    
    // Reset player car position and rotation
    if (playerCar) {
        playerCar.position.x = 0;
        playerCar.rotation.z = 0;
    }
    
    // Update UI
    updateUI();
    
    // Start the game
    gameRunning = true;
    gameLoop();
}

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Check for spacebar to restart game when game over
    if (e.code === 'Space' && !gameRunning && gameOverScreen.style.display === 'block') {
        e.preventDefault();
        restartGame();
        return;
    }
    
    // Check for Enter key to start game from start screen
    if (e.code === 'Enter' && !gameRunning && startScreen.style.display !== 'none') {
        e.preventDefault();
        startGame();
        return;
    }
    
    // Prevent default behavior for arrow keys and WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;

gameArea.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

gameArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement
        if (deltaX > 10 && playerCar && playerCar.position.x < ROAD_WIDTH/2 - 1) {
            playerCar.position.x += PLAYER_SPEED;
        } else if (deltaX < -10 && playerCar && playerCar.position.x > -ROAD_WIDTH/2 + 1) {
            playerCar.position.x -= PLAYER_SPEED;
        }
    } else {
        // Vertical movement
        if (deltaY < -10 && gameSpeed < MAX_SPEED) {
            gameSpeed += 0.002;
        } else if (deltaY > 10 && gameSpeed > 0.02) {
            gameSpeed -= 0.002;
        }
    }
    
    touchStartX = touchX;
    touchStartY = touchY;
});

// Handle window resize
window.addEventListener('resize', () => {
    if (camera && renderer) {
        const width = Math.min(window.innerWidth - 40, 800);
        const height = Math.min(window.innerHeight - 200, 600);
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
});

// Initialize when page loads
window.addEventListener('load', () => {
    // Show loading message
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Loading 3D Engine...';
    gameArea.appendChild(loading);
    
    // Initialize after a short delay to show loading
    setTimeout(() => {
        loading.remove();
        initGame();
    }, 1000);
});
