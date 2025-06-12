// 3D Game variables
let scene, camera, renderer, gameRunning = false;
let gameSpeed = 0.04, score = 0, lives = 3;
let playerCar, enemyCars = [], powerUps = [], explosions = [];
let keys = {}, road, roadSegments = [];
let environmentObjects = { trees: [], buildings: [], streetLights: [], stars: [] };

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
    scene.fog = new THREE.FogExp2(0x000044, 0.015);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
    camera.position.set(0, 4, 6);
    camera.lookAt(0, 0, -10);
    
    // Create renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(800, 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000044, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
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
    // Ambient light - reduced intensity
    const ambientLight = new THREE.AmbientLight(0x404080, 0.25);
    scene.add(ambientLight);
    
    // Directional light (sun/moon) - reduced intensity
    const directionalLight = new THREE.DirectionalLight(0x8888ff, 0.9);
    directionalLight.position.set(15, 25, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Rim lighting - reduced intensity
    const rimLight = new THREE.DirectionalLight(0x4444ff, 0.4);
    rimLight.position.set(-10, 5, -10);
    scene.add(rimLight);
    
    // Point lights for car headlights - reduced intensity
    const headlight1 = new THREE.PointLight(0xffffcc, 1.0, 15, 2);
    headlight1.position.set(-0.3, 0.5, 2);
    headlight1.castShadow = true;
    headlight1.shadow.mapSize.width = 1024;
    headlight1.shadow.mapSize.height = 1024;
    scene.add(headlight1);
    
    const headlight2 = new THREE.PointLight(0xffffcc, 1.0, 15, 2);
    headlight2.position.set(0.3, 0.5, 2);
    headlight2.castShadow = true;
    headlight2.shadow.mapSize.width = 1024;
    headlight2.shadow.mapSize.height = 1024;
    scene.add(headlight2);
    
    // Store references for dynamic updates
    scene.userData.headlights = [headlight1, headlight2];
    
    // Street lights
    createStreetLights();
}

// Create street lights
function createStreetLights() {
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const lightGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffaa,
        emissive: 0xffffaa,
        emissiveIntensity: 0.3
    });
    
    for (let i = -ROAD_LENGTH; i < ROAD_LENGTH * 2; i += 15) {
        // Left street light
        const leftGroup = new THREE.Group();
        const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
        leftPole.position.set(0, 3, 0);
        leftPole.castShadow = true;
        leftGroup.add(leftPole);
        
        const leftLight = new THREE.Mesh(lightGeometry, lightMaterial);
        leftLight.position.set(0, 6, 0);
        leftGroup.add(leftLight);
        
        const leftPointLight = new THREE.PointLight(0xffffaa, 0.5, 12);
        leftPointLight.position.set(0, 6, 0);
        leftGroup.add(leftPointLight);
        
        leftGroup.position.set(-ROAD_WIDTH/2 - 2, 0, i);
        leftGroup.userData = { originalZ: i };
        environmentObjects.streetLights.push(leftGroup);
        scene.add(leftGroup);
        
        // Right street light
        const rightGroup = new THREE.Group();
        const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
        rightPole.position.set(0, 3, 0);
        rightPole.castShadow = true;
        rightGroup.add(rightPole);
        
        const rightLight = new THREE.Mesh(lightGeometry, lightMaterial);
        rightLight.position.set(0, 6, 0);
        rightGroup.add(rightLight);
        
        const rightPointLight = new THREE.PointLight(0xffffaa, 0.5, 12);
        rightPointLight.position.set(0, 6, 0);
        rightGroup.add(rightPointLight);
        
        rightGroup.position.set(ROAD_WIDTH/2 + 2, 0, i);
        rightGroup.userData = { originalZ: i };
        environmentObjects.streetLights.push(rightGroup);
        scene.add(rightGroup);
    }
}

// Create road
function createRoad() {
    road = new THREE.Group();
    
    // Main road surface with enhanced appearance
    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 64, 64);
    const roadMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a,
        shininess: 5,
        specular: 0x111111,
        transparent: false
    });
    
    // Create realistic road texture with height variations
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    const vertices = roadMesh.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        // Add subtle asphalt texture variations
        vertices[i + 2] += (Math.random() - 0.5) * 0.015;
    }
    roadMesh.geometry.attributes.position.needsUpdate = true;
    roadMesh.geometry.computeVertexNormals();
    
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0;
    roadMesh.receiveShadow = false;
    road.add(roadMesh);
    
    // Add road base/foundation
    createRoadBase();
    
    // Enhanced road markings
    createRoadMarkings();
    
    // Add road edge details
    createRoadEdges();
    
    scene.add(road);
}

// Create road base/foundation
function createRoadBase() {
    const baseGeometry = new THREE.PlaneGeometry(ROAD_WIDTH + 1, ROAD_LENGTH, 32, 32);
    const baseMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x0d0d0d,
        transparent: true,
        opacity: 0.8
    });
    
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.y = -0.02;
    road.add(baseMesh);
}

// Create enhanced road markings
function createRoadMarkings() {
    // Center lane divider - dashed lines
    const centerLineGeometry = new THREE.BoxGeometry(0.2, 0.04, 3);
    const centerLineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.25
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 5) {
        const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
        centerLine.position.set(0, 0.02, i);
        roadSegments.push(centerLine);
        road.add(centerLine);
        
        // Add subtle glow effect - reduced opacity
        const glowGeometry = new THREE.BoxGeometry(0.35, 0.01, 3.5);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.1
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, 0.025, i);
        road.add(glow);
    }
    
    // Side lane markings - solid lines
    const sideLineGeometry = new THREE.BoxGeometry(0.25, 0.04, ROAD_LENGTH);
    const sideLineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.2
    });
    
    // Left side line
    const leftLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    leftLine.position.set(-ROAD_WIDTH/2 + 0.3, 0.02, 0);
    road.add(leftLine);
    
    // Right side line
    const rightLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    rightLine.position.set(ROAD_WIDTH/2 - 0.3, 0.02, 0);
    road.add(rightLine);
    
    // Add lane change arrows
    createLaneArrows();
}

// Create lane arrows
function createLaneArrows() {
    const arrowGeometry = new THREE.ConeGeometry(0.3, 1, 6);
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 20) {
        // Left lane arrow
        const leftArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        leftArrow.position.set(-ROAD_WIDTH/4, 0.03, i);
        leftArrow.rotation.x = -Math.PI / 2;
        road.add(leftArrow);
        
        // Right lane arrow
        const rightArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        rightArrow.position.set(ROAD_WIDTH/4, 0.03, i);
        rightArrow.rotation.x = -Math.PI / 2;
        road.add(rightArrow);
    }
}

// Create road edges
function createRoadEdges() {
    // Road shoulder/curb
    const curbGeometry = new THREE.BoxGeometry(0.4, 0.1, ROAD_LENGTH);
    const curbMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x666666,
        shininess: 30
    });
    
    // Left curb
    const leftCurb = new THREE.Mesh(curbGeometry, curbMaterial);
    leftCurb.position.set(-ROAD_WIDTH/2 - 0.2, 0.05, 0);
    leftCurb.castShadow = true;
    road.add(leftCurb);
    
    // Right curb
    const rightCurb = new THREE.Mesh(curbGeometry, curbMaterial);
    rightCurb.position.set(ROAD_WIDTH/2 + 0.2, 0.05, 0);
    rightCurb.castShadow = true;
    road.add(rightCurb);
}

// Create road studs (cat's eyes)
function createRoadStuds() {
    const studGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const studMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.1,
        shininess: 200,
        transparent: true,
        opacity: 0.9
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 10) {
        // Center studs
        const centerStud = new THREE.Mesh(studGeometry, studMaterial);
        centerStud.position.set(0, 0.04, i + 2.5);
        road.add(centerStud);
        
        // Side studs with different colors
        const sideStudMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            emissive: 0xff4444,
            emissiveIntensity: 0.05,
            shininess: 200,
            transparent: true,
            opacity: 0.8
        });
        
        const leftStud = new THREE.Mesh(studGeometry, sideStudMaterial);
        leftStud.position.set(-ROAD_WIDTH/2 + 0.3, 0.04, i);
        road.add(leftStud);
        
        const rightStud = new THREE.Mesh(studGeometry, sideStudMaterial);
        rightStud.position.set(ROAD_WIDTH/2 - 0.3, 0.04, i);
        road.add(rightStud);
    }
}

// Create player car
function createPlayerCar() {
    playerCar = new THREE.Group();
    
    // Enhanced car body with metallic finish
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff2222,
        shininess: 150,
        specular: 0x888888,
        reflectivity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.25;
    body.castShadow = true;
    body.receiveShadow = true;
    playerCar.add(body);
    
    // Car roof with gradient effect
    const roofGeometry = new THREE.BoxGeometry(1, 0.4, 1.5);
    const roofMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xaa0000,
        shininess: 200,
        specular: 0xaaaaaa
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7;
    roof.position.z = -0.2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    playerCar.add(roof);
    
    // Enhanced wheels with rims
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x111111,
        shininess: 50
    });
    
    const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12);
    const rimMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888,
        shininess: 200,
        specular: 0xffffff
    });
    
    const wheels = [
        { x: -0.7, z: 0.8 },
        { x: 0.7, z: 0.8 },
        { x: -0.7, z: -0.8 },
        { x: 0.7, z: -0.8 }
    ];
    
    wheels.forEach(pos => {
        const wheelGroup = new THREE.Group();
        
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheelGroup.add(wheel);
        
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        wheelGroup.add(rim);
        
        wheelGroup.position.set(pos.x, 0.3, pos.z);
        playerCar.add(wheelGroup);
    });
    
    // Enhanced headlights with lens effect
    const headlightGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const headlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9
    });
    
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.4, 0.4, 1.3);
    playerCar.add(leftHeadlight);
    
    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.4, 0.4, 1.3);
    playerCar.add(rightHeadlight);
    
    // Taillights
    const taillightGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const taillightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    
    const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    leftTaillight.position.set(-0.4, 0.3, -1.2);
    playerCar.add(leftTaillight);
    
    const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    rightTaillight.position.set(0.4, 0.3, -1.2);
    playerCar.add(rightTaillight);
    
    // Car details - grille
    const grilleGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.05);
    const grilleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        shininess: 100
    });
    const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
    grille.position.set(0, 0.3, 1.25);
    playerCar.add(grille);
    
    playerCar.position.set(0, 0.1, 2);
    scene.add(playerCar);
}

// Create enemy car
function createEnemyCar(x, z) {
    const enemyCar = new THREE.Group();
    
    // Enhanced car body with metallic finish
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5);
    const colors = [
        { main: 0x2244ff, spec: 0x4466ff },
        { main: 0x22ff44, spec: 0x44ff66 },
        { main: 0xffff22, spec: 0xffff44 },
        { main: 0xff22ff, spec: 0xff44ff },
        { main: 0x22ffff, spec: 0x44ffff }
    ];
    const colorSet = colors[Math.floor(Math.random() * colors.length)];
    
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: colorSet.main,
        shininess: 120,
        specular: colorSet.spec,
        reflectivity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.25;
    body.castShadow = true;
    body.receiveShadow = true;
    enemyCar.add(body);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1, 0.4, 1.5);
    const roofMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(colorSet.main).multiplyScalar(0.7),
        shininess: 150,
        specular: 0x666666
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7;
    roof.position.z = -0.2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    enemyCar.add(roof);
    
    // Enhanced wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x111111,
        shininess: 50
    });
    
    const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12);
    const rimMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x666666,
        shininess: 150
    });
    
    const wheels = [
        { x: -0.7, z: 0.8 },
        { x: 0.7, z: 0.8 },
        { x: -0.7, z: -0.8 },
        { x: 0.7, z: -0.8 }
    ];
    
    wheels.forEach(pos => {
        const wheelGroup = new THREE.Group();
        
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheelGroup.add(wheel);
        
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        wheelGroup.add(rim);
        
        wheelGroup.position.set(pos.x, 0.3, pos.z);
        enemyCar.add(wheelGroup);
    });
    
    // Headlights
    const headlightGeometry = new THREE.SphereGeometry(0.1, 10, 10);
    const headlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.6
    });
    
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.4, 0.4, 1.3);
    enemyCar.add(leftHeadlight);
    
    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.4, 0.4, 1.3);
    enemyCar.add(rightHeadlight);
    
    // Taillights
    const taillightGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const taillightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.4
    });
    
    const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    leftTaillight.position.set(-0.4, 0.3, -1.2);
    enemyCar.add(leftTaillight);
    
    const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    rightTaillight.position.set(0.4, 0.3, -1.2);
    enemyCar.add(rightTaillight);
    
    enemyCar.position.set(x, 0.1, z);
    enemyCar.userData = { speed: gameSpeed + Math.random() * 0.02 };
    
    scene.add(enemyCar);
    return enemyCar;
}

// Create power-up
function createPowerUp(x, z) {
    const powerUp = new THREE.Group();
    
    // Enhanced main sphere with crystal-like appearance
    const geometry = new THREE.SphereGeometry(0.35, 16, 16);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.4,
        shininess: 200,
        specular: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    powerUp.add(sphere);
    
    // Inner glow sphere
    const innerGeometry = new THREE.SphereGeometry(0.25, 12, 12);
    const innerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff88,
        transparent: true,
        opacity: 0.6
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    powerUp.add(innerSphere);
    
    // Enhanced rotating rings
    const ringGeometry = new THREE.TorusGeometry(0.45, 0.08, 8, 20);
    const ringMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
        shininess: 150
    });
    const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring1.rotation.x = Math.PI / 2;
    powerUp.add(ring1);
    
    const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring2.rotation.z = Math.PI / 2;
    powerUp.add(ring2);
    
    // Particle effects
    const particleGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.7
    });
    
    const particles = [];
    for (let i = 0; i < 6; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        const angle = (i / 6) * Math.PI * 2;
        particle.position.set(
            Math.cos(angle) * 0.8,
            Math.sin(angle * 2) * 0.3,
            Math.sin(angle) * 0.8
        );
        particles.push(particle);
        powerUp.add(particle);
    }
    
    powerUp.position.set(x, 0.6, z);
    powerUp.userData = { 
        speed: gameSpeed,
        rotationSpeed: 0.08,
        rings: [ring1, ring2],
        particles: particles,
        innerSphere: innerSphere,
        time: 0
    };
    
    scene.add(powerUp);
    return powerUp;
}

// Create environment
function createEnvironment() {
    // Enhanced night sky with stars
    const skyGeometry = new THREE.SphereGeometry(300, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000044,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Add stars
    createStars();
    
    // Enhanced ground with texture-like appearance
    const groundGeometry = new THREE.PlaneGeometry(100, ROAD_LENGTH * 3, 50, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x002200,
        transparent: true,
        opacity: 0.8
    });
    
    // Add noise to ground for realistic terrain
    const leftGround = new THREE.Mesh(groundGeometry, groundMaterial);
    const leftVertices = leftGround.geometry.attributes.position.array;
    for (let i = 0; i < leftVertices.length; i += 3) {
        leftVertices[i + 2] += (Math.random() - 0.5) * 0.3;
    }
    leftGround.geometry.attributes.position.needsUpdate = true;
    leftGround.geometry.computeVertexNormals();
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-50, -0.2, -ROAD_LENGTH);
    leftGround.receiveShadow = true;
    scene.add(leftGround);
    
    const rightGround = new THREE.Mesh(groundGeometry, groundMaterial);
    const rightVertices = rightGround.geometry.attributes.position.array;
    for (let i = 0; i < rightVertices.length; i += 3) {
        rightVertices[i + 2] += (Math.random() - 0.5) * 0.3;
    }
    rightGround.geometry.attributes.position.needsUpdate = true;
    rightGround.geometry.computeVertexNormals();
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(50, -0.2, -ROAD_LENGTH);
    rightGround.receiveShadow = true;
    scene.add(rightGround);
    
    // Enhanced trees and buildings
    createTrees();
    createBuildings();
    createParticleEffects();
}

// Create particle effects for atmosphere
function createParticleEffects() {
    // Create dust particles that move past the car
    const dustGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const dustMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x888888,
        transparent: true,
        opacity: 0.3
    });
    
    for (let i = 0; i < 50; i++) {
        const dust = new THREE.Mesh(dustGeometry, dustMaterial);
        dust.position.set(
            (Math.random() - 0.5) * 50,
            Math.random() * 5,
            (Math.random() - 0.5) * ROAD_LENGTH * 2
        );
        
        dust.userData = {
            originalZ: dust.position.z,
            speed: Math.random() * 0.5 + 0.5,
            drift: (Math.random() - 0.5) * 0.01
        };
        
        environmentObjects.particles = environmentObjects.particles || [];
        environmentObjects.particles.push(dust);
        scene.add(dust);
    }
    
    // Add road heat shimmer effect
    createHeatShimmer();
}

// Create heat shimmer effect on road
function createHeatShimmer() {
    const shimmerGeometry = new THREE.PlaneGeometry(ROAD_WIDTH * 0.8, 20, 16, 16);
    const shimmerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide
    });
    
    for (let i = 0; i < 5; i++) {
        const shimmer = new THREE.Mesh(shimmerGeometry, shimmerMaterial);
        shimmer.rotation.x = -Math.PI / 2;
        shimmer.position.set(0, 0.05, -40 + i * 20);
        
        // Add wave animation to vertices
        const vertices = shimmer.geometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
            vertices[j + 2] += Math.sin(j * 0.1) * 0.02;
        }
        shimmer.geometry.attributes.position.needsUpdate = true;
        
        shimmer.userData = {
            originalZ: shimmer.position.z,
            waveTime: Math.random() * Math.PI * 2
        };
        
        environmentObjects.shimmer = environmentObjects.shimmer || [];
        environmentObjects.shimmer.push(shimmer);
        scene.add(shimmer);
    }
}

// Create stars
function createStars() {
    const starGeometry = new THREE.SphereGeometry(0.5, 6, 6);
    const starMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.8
    });
    
    for (let i = 0; i < 200; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        const radius = 250 + Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
        
        star.scale.setScalar(Math.random() * 0.5 + 0.5);
        star.userData = { 
            originalPosition: star.position.clone(),
            twinkleSpeed: Math.random() * 0.02 + 0.01
        };
        environmentObjects.stars.push(star);
        scene.add(star);
    }
}

// Create buildings
function createBuildings() {
    const buildingMaterials = [
        new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 50 }),
        new THREE.MeshPhongMaterial({ color: 0x333366, shininess: 30 }),
        new THREE.MeshPhongMaterial({ color: 0x663333, shininess: 40 })
    ];
    
    for (let i = 0; i < 30; i++) {
        const building = new THREE.Group();
        
        const height = 8 + Math.random() * 20;
        const width = 3 + Math.random() * 4;
        const depth = 3 + Math.random() * 4;
        
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingMesh.position.y = height / 2;
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        building.add(buildingMesh);
        
        // Add windows
        const windowGeometry = new THREE.PlaneGeometry(0.8, 1.2);
        const windowMaterial = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.7 ? 0xffff88 : 0x222222,
            emissive: Math.random() > 0.7 ? 0xffff88 : 0x000000,
            emissiveIntensity: 0.3
        });
        
        for (let j = 0; j < Math.floor(height / 3); j++) {
            for (let k = 0; k < Math.floor(width / 2); k++) {
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    -width/2 + 1 + k * 1.5,
                    j * 3 + 2,
                    depth/2 + 0.01
                );
                building.add(window);
            }
        }
        
        const side = Math.random() > 0.5 ? 1 : -1;
        const zPosition = (Math.random() - 0.5) * ROAD_LENGTH * 2;
        building.position.set(
            side * (15 + Math.random() * 25),
            0,
            zPosition
        );
        
        building.userData = { originalZ: zPosition };
        environmentObjects.buildings.push(building);
        scene.add(building);
    }
}

// Create trees
function createTrees() {
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 12);
    const trunkMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513,
        shininess: 10
    });
    
    const leavesGeometry = new THREE.SphereGeometry(2, 12, 12);
    const leavesMaterials = [
        new THREE.MeshLambertMaterial({ color: 0x228B22 }),
        new THREE.MeshLambertMaterial({ color: 0x32CD32 }),
        new THREE.MeshLambertMaterial({ color: 0x006400 })
    ];
    
    for (let i = 0; i < 50; i++) {
        const tree = new THREE.Group();
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        const leavesMaterial = leavesMaterials[Math.floor(Math.random() * leavesMaterials.length)];
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4.5;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);
        
        // Add some variation to tree shapes
        leaves.scale.set(
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4
        );
        
        const side = Math.random() > 0.5 ? 1 : -1;
        const zPosition = (Math.random() - 0.5) * ROAD_LENGTH * 2;
        tree.position.set(
            side * (12 + Math.random() * 20),
            0,
            zPosition
        );
        
        tree.userData = { 
            originalZ: zPosition,
            swaySpeed: Math.random() * 0.008 + 0.004,
            swayAmount: Math.random() * 0.05 + 0.02
        };
        environmentObjects.trees.push(tree);
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
    
    // Reset environment positions
    resetEnvironmentPositions();
    
    updateUI();
}

// Reset environment positions
function resetEnvironmentPositions() {
    environmentObjects.trees.forEach(tree => {
        tree.position.z = tree.userData.originalZ;
    });
    
    environmentObjects.buildings.forEach(building => {
        building.position.z = building.userData.originalZ;
    });
    
    environmentObjects.streetLights.forEach(light => {
        light.position.z = light.userData.originalZ;
    });
    
    if (environmentObjects.particles) {
        environmentObjects.particles.forEach(particle => {
            particle.position.z = particle.userData.originalZ;
        });
    }
    
    // Reset camera position
    if (camera) {
        camera.position.set(0, 4, 6);
        camera.lookAt(0, 0, -10);
    }
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
    updateEnvironment();
    updateLighting();
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

// Update environment movement
function updateEnvironment() {
    const movementSpeed = gameSpeed * 8;
    
    // Update trees
    environmentObjects.trees.forEach(tree => {
        tree.position.z += movementSpeed;
        
        // Add subtle swaying animation
        tree.rotation.z = Math.sin(Date.now() * tree.userData.swaySpeed) * tree.userData.swayAmount;
        
        // Reset position when tree goes behind camera
        if (tree.position.z > 20) {
            tree.position.z = tree.userData.originalZ - ROAD_LENGTH * 2;
        }
    });
    
    // Update buildings
    environmentObjects.buildings.forEach(building => {
        building.position.z += movementSpeed;
        
        // Reset position when building goes behind camera
        if (building.position.z > 20) {
            building.position.z = building.userData.originalZ - ROAD_LENGTH * 2;
        }
    });
    
    // Update street lights
    environmentObjects.streetLights.forEach(light => {
        light.position.z += movementSpeed;
        
        // Reset position when light goes behind camera
        if (light.position.z > 20) {
            light.position.z = light.userData.originalZ - ROAD_LENGTH * 2;
        }
    });
    
    // Update particles
    if (environmentObjects.particles) {
        environmentObjects.particles.forEach(particle => {
            particle.position.z += movementSpeed * particle.userData.speed;
            particle.position.x += particle.userData.drift;
            
            // Reset particle position
            if (particle.position.z > 15) {
                particle.position.z = particle.userData.originalZ - ROAD_LENGTH * 2;
                particle.position.x = (Math.random() - 0.5) * 50;
            }
        });
    }
    
    // Update heat shimmer effects
    if (environmentObjects.shimmer) {
        environmentObjects.shimmer.forEach(shimmer => {
            shimmer.position.z += movementSpeed;
            shimmer.userData.waveTime += 0.05;
            
            // Animate shimmer waves
            const vertices = shimmer.geometry.attributes.position.array;
            for (let i = 0; i < vertices.length; i += 3) {
                vertices[i + 2] = Math.sin(i * 0.1 + shimmer.userData.waveTime) * 0.02;
            }
            shimmer.geometry.attributes.position.needsUpdate = true;
            
            // Adjust opacity based on speed
            shimmer.material.opacity = 0.05 + (gameSpeed / MAX_SPEED) * 0.1;
            
            // Reset position
            if (shimmer.position.z > 15) {
                shimmer.position.z = shimmer.userData.originalZ - 100;
            }
        });
    }
    
    // Update stars (subtle movement for parallax effect)
    environmentObjects.stars.forEach(star => {
        // Stars move much slower to create parallax effect
        const starMovement = movementSpeed * 0.1;
        star.position.z += starMovement;
        
        // Add twinkling effect
        const twinkle = Math.sin(Date.now() * star.userData.twinkleSpeed) * 0.3 + 0.7;
        star.material.emissiveIntensity = 0.8 * twinkle;
        
        // Reset star position (much larger range due to distance)
        if (star.position.z > 100) {
            star.position.z -= 200;
        }
    });
    
    // Add camera shake effect based on speed for more immersion
    if (camera && gameSpeed > 0.08) {
        const shakeIntensity = (gameSpeed - 0.08) * 0.5;
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
        
        // Return camera to original position gradually
        camera.position.x *= 0.9;
        camera.position.y = 4 + (camera.position.y - 4) * 0.9;
    }
}

// Update lighting dynamically
function updateLighting() {
    if (scene.userData.headlights && playerCar) {
        // Update headlight positions to follow player car
        scene.userData.headlights[0].position.set(
            playerCar.position.x - 0.3,
            playerCar.position.y + 0.5,
            playerCar.position.z + 1.3
        );
        scene.userData.headlights[1].position.set(
            playerCar.position.x + 0.3,
            playerCar.position.y + 0.5,
            playerCar.position.z + 1.3
        );
        
        // Adjust headlight intensity based on speed - reduced intensity
        const intensity = 1.0 + (gameSpeed / MAX_SPEED) * 0.3;
        scene.userData.headlights[0].intensity = intensity;
        scene.userData.headlights[1].intensity = intensity;
    }
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
    
    // Add dynamic road effects based on speed - reduced intensity
    if (gameSpeed > 0.08) {
        // Add speed blur effect to road markings
        roadSegments.forEach((segment, index) => {
            if (segment.material.emissiveIntensity !== undefined) {
                segment.material.emissiveIntensity = 0.25 + Math.sin(Date.now() * 0.01 + index) * 0.1;
            }
        });
    }
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
        
        // Enhanced animations
        powerUp.userData.time += 0.05;
        const time = powerUp.userData.time;
        
        // Rotate rings in different directions
        powerUp.userData.rings[0].rotation.z += 0.12;
        powerUp.userData.rings[1].rotation.x += 0.08;
        
        // Animate particles in orbit
        powerUp.userData.particles.forEach((particle, i) => {
            const angle = (i / 6) * Math.PI * 2 + time;
            particle.position.set(
                Math.cos(angle) * (0.8 + Math.sin(time * 2) * 0.2),
                Math.sin(angle * 3) * 0.4,
                Math.sin(angle) * (0.8 + Math.cos(time * 2) * 0.2)
            );
        });
        
        // Pulsing inner sphere
        const scale = 1 + Math.sin(time * 4) * 0.2;
        powerUp.userData.innerSphere.scale.setScalar(scale);
        
        // Floating animation with more complex motion
        powerUp.position.y = 0.6 + Math.sin(time * 2) * 0.3 + Math.cos(time * 3) * 0.1;
        
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
    
    // Enhanced explosion with more particles and effects
    for (let i = 0; i < 20; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.5 ? 0xff2222 : (Math.random() > 0.5 ? 0xffaa00 : 0xffffff),
            transparent: true,
            opacity: 0.9
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        particle.position.set(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3
        );
        
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 0.4
            ),
            life: 1.0,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        };
        
        explosion.add(particle);
    }
    
    // Add shockwave effect
    const shockwaveGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.userData = { scale: 0.1, opacity: 0.8 };
    explosion.add(shockwave);
    
    explosion.position.set(x, y, z);
    explosion.userData = { life: 1.0, shockwave: shockwave };
    explosions.push(explosion);
    scene.add(explosion);
}

// Update explosions
function updateExplosions() {
    explosions.forEach((explosion, index) => {
        explosion.userData.life -= 0.025;
        
        explosion.children.forEach(child => {
            if (child.userData.velocity) {
                // Particle
                child.position.add(child.userData.velocity);
                child.userData.velocity.y -= 0.015; // Gravity
                child.material.opacity = explosion.userData.life;
                
                if (child.userData.rotationSpeed) {
                    child.rotation.x += child.userData.rotationSpeed;
                    child.rotation.y += child.userData.rotationSpeed;
                }
            } else if (child === explosion.userData.shockwave) {
                // Shockwave
                child.userData.scale += 0.3;
                child.userData.opacity -= 0.03;
                child.scale.setScalar(child.userData.scale);
                child.material.opacity = Math.max(0, child.userData.opacity);
            }
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
    
    // Reset environment positions
    resetEnvironmentPositions();
    
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
