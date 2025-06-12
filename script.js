// Global Error Handler
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global error caught:", {
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        errorObject: error
    });
    const errorDisplay = document.getElementById('criticalErrorDisplay');
    if (errorDisplay) {
        errorDisplay.textContent = "An unexpected error occurred. Please try refreshing the page. Check console for details.";
        errorDisplay.style.display = 'block';
    }
    // Consider stopping the game loop or other critical operations here if needed
    if (typeof gameRunning !== 'undefined') {
        gameRunning = false; // Attempt to stop the game loop
    }
    return true; // Prevent default browser error handling
};

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
    try {
        // Create scene
        scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000044, 0.015); // Adds a fog effect for atmosphere
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000); // Field of view, aspect ratio, near clip, far clip
    camera.position.set(0, 4, 6); // Positioned above and behind the car
    camera.lookAt(0, 0, -10); // Looking down the road
    
    // Create renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, // Target canvas element
        antialias: true, // Smooths edges
        alpha: true, // Allows transparency for effects
        powerPreference: "high-performance" // Prioritizes performance
    });
    renderer.setSize(800, 600); // Initial size, will be updated on resize
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizes for high DPI screens
    renderer.setClearColor(0x000044, 1); // Dark blue background color, matching fog
    renderer.shadowMap.enabled = true; // Enables shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges
    renderer.outputEncoding = THREE.sRGBEncoding; // Correct color output
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Advanced tone mapping for HDR-like effect
    renderer.toneMappingExposure = 1.2; // Adjusts overall brightness
    
    // Add lights
    setupLighting(); // Configures various light sources
    
    // Create road
    createRoad();
    
    // Create player car
    createPlayerCar();
    
        // Add environment
        createEnvironment();
    } catch (e) {
        console.error("Error during 3D initialization (init3D):", e);
        const errorDisplay = document.getElementById('criticalErrorDisplay');
        if (errorDisplay) {
            errorDisplay.textContent = "Failed to initialize the 3D scene. Please ensure your browser supports WebGL and try refreshing.";
            errorDisplay.style.display = 'block';
        }
        // Game cannot run if init3D fails
        gameRunning = false;
        throw e; // Re-throw if you want it to be caught by the global handler or for other reasons
    }
}

// Setup lighting
function setupLighting() {
    // Ambient light - provides overall, non-directional illumination
    const ambientLight = new THREE.AmbientLight(0x404080, 0.25); // Soft blue-ish white, low intensity
    scene.add(ambientLight);
    
    // Directional light (simulates sun/moon) - provides main directional lighting and casts shadows
    const directionalLight = new THREE.DirectionalLight(0x8888ff, 0.9); // Cool white, fairly bright
    directionalLight.position.set(15, 25, 10); // Positioned to cast shadows from an angle
    directionalLight.castShadow = true;
    // Shadow map settings for quality
    directionalLight.shadow.mapSize.width = 4096; // High resolution for sharp shadows
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.bias = -0.0001; // Helps prevent shadow acne
    scene.add(directionalLight);
    
    // Rim lighting - adds highlights to edges of objects, enhancing 3D feel
    const rimLight = new THREE.DirectionalLight(0x4444ff, 0.4); // Blueish, subtle intensity
    rimLight.position.set(-10, 5, -10); // Positioned opposite to the main light
    scene.add(rimLight);
    
    // Point lights for player car headlights - these will be updated to follow the car
    const headlight1 = new THREE.PointLight(0xffffcc, 1.0, 15, 2); // Warm white, intensity, distance, decay
    headlight1.position.set(-0.3, 0.5, 2); // Initial position relative to car
    headlight1.castShadow = true; // Can cast shadows (though might be performance intensive)
    headlight1.shadow.mapSize.width = 1024; // Lower res for performance
    headlight1.shadow.mapSize.height = 1024;
    scene.add(headlight1);
    
    const headlight2 = new THREE.PointLight(0xffffcc, 1.0, 15, 2);
    headlight2.position.set(0.3, 0.5, 2);
    headlight2.castShadow = true;
    headlight2.shadow.mapSize.width = 1024;
    headlight2.shadow.mapSize.height = 1024;
    scene.add(headlight2);
    
    // Store references for dynamic updates in updateLighting()
    scene.userData.headlights = [headlight1, headlight2];
    
    // Street lights - static lights along the road
    createStreetLights(); // Calls function to populate street lights
}

// Create street lights
function createStreetLights() {
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const lightGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffaa
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
    road = new THREE.Group(); // Main group for all road elements
    
    // Main road surface with enhanced appearance
    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 64, 64); // Width, length, segments for detail
    const roadMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a, // Dark asphalt color
        shininess: 5, // Low shininess for a matte look
        specular: 0x111111, // Subtle specular highlights
        transparent: false
    });
    
    // Create realistic road texture with height variations
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    const vertices = roadMesh.geometry.attributes.position.array;
    // Add subtle asphalt texture variations by randomly adjusting vertex heights
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] += (Math.random() - 0.5) * 0.015; // Small random offset on Z-axis (height)
    }
    roadMesh.geometry.attributes.position.needsUpdate = true; // Required after modifying vertices
    roadMesh.geometry.computeVertexNormals(); // Recalculate normals for correct lighting
    
    roadMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat
    roadMesh.position.y = 0; // Position at ground level
    roadMesh.receiveShadow = false; // Main road surface doesn't need to receive shadows from itself
    road.add(roadMesh);
    
    // Add road base/foundation for thickness
    createRoadBase();
    
    // Enhanced road markings (lines, arrows)
    createRoadMarkings();
    
    // Add road edge details (curbs)
    createRoadEdges();

    // Add road studs (cat's eyes) for detail - Call this function if it's defined and desired
    createRoadStuds(); 
    
    scene.add(road); // Add the entire road group to the scene
}

// Create road base/foundation
function createRoadBase() {
    // A slightly wider plane beneath the main road surface to give it some thickness/depth
    const baseGeometry = new THREE.PlaneGeometry(ROAD_WIDTH + 1, ROAD_LENGTH, 32, 32);
    const baseMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x0d0d0d, // Very dark grey, almost black
        transparent: true,
        opacity: 0.8 // Slightly transparent
    });
    
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat
    baseMesh.position.y = -0.02; // Position slightly below the main road surface
    road.add(baseMesh); // Add to the road group
}

// Create enhanced road markings
function createRoadMarkings() {
    // Center lane divider - dashed lines
    const centerLineGeometry = new THREE.BoxGeometry(0.2, 0.04, 3); // Width, height, length of each dash
    const centerLineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff // White color
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 5) { // Create dashes along the road length
        const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
        centerLine.position.set(0, 0.02, i); // Position slightly above the road surface
        roadSegments.push(centerLine); // Store for animation in updateRoad()
        road.add(centerLine);
        
        // Add subtle glow effect beneath the lines for better visibility
        const glowGeometry = new THREE.BoxGeometry(0.35, 0.01, 3.5); // Slightly larger and thinner
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.1 // Very subtle glow
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, 0.025, i); // Position slightly above the line
        road.add(glow);
    }
    
    // Side lane markings - solid lines
    const sideLineGeometry = new THREE.BoxGeometry(0.25, 0.04, ROAD_LENGTH); // Full length of the road
    const sideLineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00 // Yellow color for side lines
    });
    
    // Left side line
    const leftLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    leftLine.position.set(-ROAD_WIDTH/2 + 0.3, 0.02, 0); // Position at the left edge of the road
    road.add(leftLine);
    
    // Right side line
    const rightLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    rightLine.position.set(ROAD_WIDTH/2 - 0.3, 0.02, 0); // Position at the right edge of the road
    road.add(rightLine);
    
    // Add lane change arrows for visual detail
    createLaneArrows();
}

// Create lane arrows
function createLaneArrows() {
    const arrowGeometry = new THREE.ConeGeometry(0.3, 1, 6); // Radius, height, segments for arrow shape
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, // White color
        transparent: true,
        opacity: 0.8 // Slightly transparent
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 20) { // Place arrows periodically
        // Left lane arrow
        const leftArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        leftArrow.position.set(-ROAD_WIDTH/4, 0.03, i); // Position in the left lane
        leftArrow.rotation.x = -Math.PI / 2; // Rotate to point along the road
        road.add(leftArrow);
        
        // Right lane arrow
        const rightArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        rightArrow.position.set(ROAD_WIDTH/4, 0.03, i); // Position in the right lane
        rightArrow.rotation.x = -Math.PI / 2; // Rotate to point along the road
        road.add(rightArrow);
    }
}

// Create road edges (curbs)
function createRoadEdges() {
    // Road shoulder/curb geometry
    const curbGeometry = new THREE.BoxGeometry(0.4, 0.1, ROAD_LENGTH); // Width, height, length of the curb
    const curbMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x666666, // Grey color for curbs
        shininess: 30 // Some shininess
    });
    
    // Left curb
    const leftCurb = new THREE.Mesh(curbGeometry, curbMaterial);
    leftCurb.position.set(-ROAD_WIDTH/2 - 0.2, 0.05, 0); // Position just outside the road width
    leftCurb.castShadow = true; // Curbs can cast shadows
    road.add(leftCurb);
    
    // Right curb
    const rightCurb = new THREE.Mesh(curbGeometry, curbMaterial);
    rightCurb.position.set(ROAD_WIDTH/2 + 0.2, 0.05, 0); // Position just outside the road width
    rightCurb.castShadow = true; // Curbs can cast shadows
    road.add(rightCurb);
}

// Create road studs (cat's eyes) for visual detail and night driving feel
function createRoadStuds() {
    const studGeometry = new THREE.SphereGeometry(0.08, 8, 8); // Small spheres for studs
    const studMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, // White color
        emissive: 0xffffff, // Emissive to make them glow slightly
        emissiveIntensity: 0.1, // Low intensity glow
        shininess: 200, // Highly shiny
        transparent: true,
        opacity: 0.9
    });
    
    for (let i = -ROAD_LENGTH/2; i < ROAD_LENGTH/2; i += 10) { // Place studs periodically
        // Center studs (between dashed lines)
        const centerStud = new THREE.Mesh(studGeometry, studMaterial);
        centerStud.position.set(0, 0.04, i + 2.5); // Position slightly above road, offset to be between dashes
        road.add(centerStud);
        
        // Side studs with different colors (e.g., red for edges)
        const sideStudMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff4444, // Red color for side studs
            emissive: 0xff4444,
            emissiveIntensity: 0.05,
            shininess: 200,
            transparent: true,
            opacity: 0.8
        });
        
        const leftStud = new THREE.Mesh(studGeometry, sideStudMaterial);
        leftStud.position.set(-ROAD_WIDTH/2 + 0.3, 0.04, i); // Position near the left side line
        road.add(leftStud);
        
        const rightStud = new THREE.Mesh(studGeometry, sideStudMaterial);
        rightStud.position.set(ROAD_WIDTH/2 - 0.3, 0.04, i); // Position near the right side line
        road.add(rightStud);
    }
}

// Create player car
function createPlayerCar() {
    playerCar = new THREE.Group(); // Main group for the player's car
    
    // Enhanced car body with metallic finish
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5); // Dimensions of the car body
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff2222, // Red color for the player car
        shininess: 150, // High shininess for a metallic look
        specular: 0x888888, // Specular highlights
        reflectivity: 0.3 // How much the environment reflects
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.25; // Raise the body slightly off the ground
    body.castShadow = true; // Player car casts shadows
    body.receiveShadow = true; // And receives shadows
    playerCar.add(body);
    
    // Car roof with gradient effect
    const roofGeometry = new THREE.BoxGeometry(1, 0.4, 1.5); // Dimensions of the roof
    const roofMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xaa0000, // Darker red for the roof
        shininess: 200,
        specular: 0xaaaaaa
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7; // Position on top of the body
    roof.position.z = -0.2; // Slightly offset to the back
    roof.castShadow = true;
    roof.receiveShadow = true;
    playerCar.add(roof);
    
    // Enhanced wheels with rims
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12); // Radius, height, segments for tire
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x111111, // Dark grey for tires
        shininess: 50
    });
    
    const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12); // Slightly smaller radius for rim
    const rimMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888, // Silver color for rims
        shininess: 200,
        specular: 0xffffff
    });
    
    const wheels = [ // Positions for the four wheels
        { x: -0.7, z: 0.8 }, // Front left
        { x: 0.7, z: 0.8 },  // Front right
        { x: -0.7, z: -0.8 },// Rear left
        { x: 0.7, z: -0.8 } // Rear right
    ];
    
    wheels.forEach(pos => {
        const wheelGroup = new THREE.Group(); // Group for tire and rim
        
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2; // Rotate to align with car orientation
        wheel.castShadow = true;
        wheelGroup.add(wheel);
        
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2; // Align rim
        rim.castShadow = true;
        wheelGroup.add(rim);
        
        wheelGroup.position.set(pos.x, 0.3, pos.z); // Set wheel position relative to car body
        playerCar.add(wheelGroup);
    });
    
    // Enhanced headlights with lens effect
    const headlightGeometry = new THREE.SphereGeometry(0.12, 12, 12); // Small spheres for headlights
    const headlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffcc, // Pale yellow for headlight glow
        transparent: true,
        opacity: 0.9
    });
    
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.4, 0.4, 1.3); // Position on the front of the car
    playerCar.add(leftHeadlight);
    
    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.4, 0.4, 1.3);
    playerCar.add(rightHeadlight);
    
    // Taillights
    const taillightGeometry = new THREE.SphereGeometry(0.08, 8, 8); // Smaller spheres for taillights
    const taillightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000 // Red for taillights
    });
    
    const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    leftTaillight.position.set(-0.4, 0.3, -1.2); // Position on the rear of the car
    playerCar.add(leftTaillight);
    
    const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    rightTaillight.position.set(0.4, 0.3, -1.2);
    playerCar.add(rightTaillight);
    
    // Car details - grille
    const grilleGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.05); // Thin box for the grille
    const grilleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333, // Dark grey for grille
        shininess: 100
    });
    const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
    grille.position.set(0, 0.3, 1.25); // Position at the front of the car body
    playerCar.add(grille);
    
    playerCar.position.set(0, 0.1, 2); // Initial position of the player car in the scene
    playerCar.userData.boundingBox = new THREE.Box3(); // Initialize bounding box for collision detection
    scene.add(playerCar); // Add the car to the scene
}

// Create enemy car
function createEnemyCar(x, z) {
    const enemyCar = new THREE.Group(); // Main group for the enemy car
    
    // Enhanced car body with metallic finish - similar structure to player car but with varied colors
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.5, 2.5);
    const colors = [ // Array of color schemes for variety
        { main: 0x2244ff, spec: 0x4466ff }, // Blue
        { main: 0x22ff44, spec: 0x44ff66 }, // Green
        { main: 0xffff22, spec: 0xffff44 }, // Yellow
        { main: 0xff22ff, spec: 0xff44ff }, // Magenta
        { main: 0x22ffff, spec: 0x44ffff }  // Cyan
    ];
    const colorSet = colors[Math.floor(Math.random() * colors.length)]; // Randomly select a color scheme
    
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
        color: new THREE.Color(colorSet.main).multiplyScalar(0.7), // Darker shade of the main color
        shininess: 150,
        specular: 0x666666
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.7;
    roof.position.z = -0.2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    enemyCar.add(roof);
    
    // Enhanced wheels - same geometry and material as player car wheels for consistency
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
    
    const wheels = [ // Wheel positions
        { x: -0.7, z: 0.8 }, { x: 0.7, z: 0.8 },
        { x: -0.7, z: -0.8 }, { x: 0.7, z: -0.8 }
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
    
    // Headlights - simpler than player car's, non-emissive
    const headlightGeometry = new THREE.SphereGeometry(0.1, 10, 10);
    const headlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffcc // Pale yellow
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
        color: 0xff0000 // Red
    });
    
    const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    leftTaillight.position.set(-0.4, 0.3, -1.2);
    enemyCar.add(leftTaillight);
    
    const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    rightTaillight.position.set(0.4, 0.3, -1.2);
    enemyCar.add(rightTaillight);
    
    enemyCar.position.set(x, 0.1, z); // Set initial position based on arguments
    enemyCar.userData = { 
        speed: gameSpeed + Math.random() * 0.02, // Assign a slightly randomized speed
        boundingBox: new THREE.Box3() // Initialize bounding box
    };
    
    scene.add(enemyCar); // Add to scene
    return enemyCar; // Return the created car object
}

// Create power-up
function createPowerUp(x, z) {
    const powerUp = new THREE.Group(); // Main group for the power-up
    
    // Enhanced main sphere with crystal-like appearance
    const geometry = new THREE.SphereGeometry(0.35, 16, 16); // Main visible part of the power-up
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffd700, // Gold color
        emissive: 0xffd700, // Emissive to make it glow
        emissiveIntensity: 0.4,
        shininess: 200,
        specular: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true; // Power-ups can cast shadows
    powerUp.add(sphere);
    
    // Inner glow sphere for added visual effect
    const innerGeometry = new THREE.SphereGeometry(0.25, 12, 12);
    const innerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff88, // Lighter yellow for inner glow
        transparent: true,
        opacity: 0.6
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    powerUp.add(innerSphere);
    
    // Enhanced rotating rings around the power-up
    const ringGeometry = new THREE.TorusGeometry(0.45, 0.08, 8, 20); // Radius, tube diameter, segments
    const ringMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, // White rings
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
        shininess: 150
    });
    const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring1.rotation.x = Math.PI / 2; // Rotate one ring horizontally
    powerUp.add(ring1);
    
    const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring2.rotation.z = Math.PI / 2; // Rotate the other ring vertically (or along another axis)
    powerUp.add(ring2);
    
    // Particle effects orbiting the power-up
    const particleGeometry = new THREE.SphereGeometry(0.05, 6, 6); // Small spheres for particles
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, // Yellow particles
        transparent: true,
        opacity: 0.7
    });
    
    const particles = []; // Store particles for animation
    for (let i = 0; i < 6; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        const angle = (i / 6) * Math.PI * 2; // Distribute particles in a circle
        particle.position.set(
            Math.cos(angle) * 0.8, // Orbit radius
            Math.sin(angle * 2) * 0.3, // Add some vertical variation
            Math.sin(angle) * 0.8
        );
        particles.push(particle);
        powerUp.add(particle);
    }
    
    powerUp.position.set(x, 0.6, z); // Set initial position, raised slightly
    powerUp.userData = { 
        speed: gameSpeed, // Power-up moves with the game speed initially
        rotationSpeed: 0.08, // How fast the power-up itself rotates
        rings: [ring1, ring2], // References to rings for animation
        particles: particles, // References to particles for animation
        innerSphere: innerSphere, // Reference to inner sphere for animation
        time: 0, // Time counter for animation patterns
        boundingBox: new THREE.Box3() // Initialize bounding box
    };
    
    scene.add(powerUp); // Add to scene
    return powerUp; // Return the created power-up object
}

// Helper function to dispose of THREE.js objects
function disposeObject(object) {
    if (!object) return;

    // If the object is a THREE.Group, iterate through children
    if (object.isGroup) {
        object.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
    } else if (object.isMesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        }
    }
    // For other object types like lights, if they have dispose methods
    if (object.dispose && typeof object.dispose === 'function') {
        object.dispose();
    }
}

// Create environment elements (sky, ground, trees, buildings, etc.)
function createEnvironment() {
    // Enhanced night sky with stars
    const skyGeometry = new THREE.SphereGeometry(300, 32, 32); // Large sphere for the skybox
    const skyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000044, // Dark blue for night sky
        side: THREE.BackSide // Render material on the inside of the sphere
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Add stars to the sky
    createStars();
    
    // Enhanced ground with texture-like appearance (noise displacement)
    const groundGeometry = new THREE.PlaneGeometry(100, ROAD_LENGTH * 3, 50, 50); // Large plane for ground
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x002200, // Dark green for ground
        transparent: true,
        opacity: 0.8 // Slightly transparent for a softer look
    });
    
    // Add noise to ground for realistic terrain on the left side of the road
    const leftGround = new THREE.Mesh(groundGeometry.clone(), groundMaterial); // Clone geometry to modify vertices independently
    const leftVertices = leftGround.geometry.attributes.position.array;
    for (let i = 0; i < leftVertices.length; i += 3) {
        leftVertices[i + 2] += (Math.random() - 0.5) * 0.3; // Random height variation
    }
    leftGround.geometry.attributes.position.needsUpdate = true;
    leftGround.geometry.computeVertexNormals();
    leftGround.rotation.x = -Math.PI / 2; // Lay flat
    leftGround.position.set(-50, -0.2, -ROAD_LENGTH); // Position to the left of the road, slightly below
    leftGround.receiveShadow = true; // Ground receives shadows
    scene.add(leftGround);
    
    // Add noise to ground for realistic terrain on the right side of the road
    const rightGround = new THREE.Mesh(groundGeometry.clone(), groundMaterial);
    const rightVertices = rightGround.geometry.attributes.position.array;
    for (let i = 0; i < rightVertices.length; i += 3) {
        rightVertices[i + 2] += (Math.random() - 0.5) * 0.3;
    }
    rightGround.geometry.attributes.position.needsUpdate = true;
    rightGround.geometry.computeVertexNormals();
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(50, -0.2, -ROAD_LENGTH); // Position to the right of the road
    rightGround.receiveShadow = true;
    scene.add(rightGround);
    
    // Populate the environment with trees, buildings, and particle effects
    createTrees();
    createBuildings();
    createParticleEffects(); // Includes dust and heat shimmer
}

// Create particle effects for atmosphere (dust, etc.)
function createParticleEffects() {
    // Create dust particles that move past the car, adding to the sense of speed
    const dustGeometry = new THREE.SphereGeometry(0.02, 4, 4); // Very small particles
    const dustMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x888888, // Greyish color for dust
        transparent: true,
        opacity: 0.3 // Low opacity
    });
    
    for (let i = 0; i < 50; i++) { // Create a number of dust particles
        const dust = new THREE.Mesh(dustGeometry, dustMaterial);
        dust.position.set(
            (Math.random() - 0.5) * 50, // Spread randomly across a wide area
            Math.random() * 5,          // Random height
            (Math.random() - 0.5) * ROAD_LENGTH * 2 // Spread along the road length
        );
        
        dust.userData = { // Store data for animation
            originalZ: dust.position.z,
            speed: Math.random() * 0.5 + 0.5, // Individual speed variation
            drift: (Math.random() - 0.5) * 0.01 // Slight sideways drift
        };
        
        environmentObjects.particles = environmentObjects.particles || []; // Initialize if not present
        environmentObjects.particles.push(dust);
        scene.add(dust);
    }
    
    // Add road heat shimmer effect for more realism, especially at high speeds
    createHeatShimmer();
}

// Create heat shimmer effect on road surface
function createHeatShimmer() {
    const shimmerGeometry = new THREE.PlaneGeometry(ROAD_WIDTH * 0.8, 20, 16, 16); // Plane above the road
    const shimmerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, // White, but opacity will make it subtle
        transparent: true,
        opacity: 0.05, // Very low opacity for a faint effect
        side: THREE.DoubleSide // Visible from both sides
    });
    
    for (let i = 0; i < 5; i++) { // Create a few shimmer planes
        const shimmer = new THREE.Mesh(shimmerGeometry, shimmerMaterial);
        shimmer.rotation.x = -Math.PI / 2; // Lay flat over the road
        shimmer.position.set(0, 0.05, -40 + i * 20); // Position slightly above road, spaced out
        
        // Add wave animation to vertices to simulate heat distortion
        const vertices = shimmer.geometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
            vertices[j + 2] += Math.sin(j * 0.1) * 0.02; // Apply a sine wave to Z positions (relative to plane)
        }
        shimmer.geometry.attributes.position.needsUpdate = true;
        
        shimmer.userData = { // Store data for animation
            originalZ: shimmer.position.z,
            waveTime: Math.random() * Math.PI * 2 // Random start time for wave animation
        };
        
        environmentObjects.shimmer = environmentObjects.shimmer || []; // Initialize if not present
        environmentObjects.shimmer.push(shimmer);
        scene.add(shimmer);
    }
}

// Create stars in the sky
function createStars() {
    const starGeometry = new THREE.SphereGeometry(0.5, 6, 6); // Small spheres for stars
    const starMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff // White stars
    });
    
    for (let i = 0; i < 200; i++) { // Create many stars
        const star = new THREE.Mesh(starGeometry, starMaterial);
        const radius = 250 + Math.random() * 50; // Distance from origin (center of sky sphere)
        const theta = Math.random() * Math.PI * 2; // Angle for spherical distribution (longitude)
        const phi = Math.random() * Math.PI;       // Angle for spherical distribution (latitude)
        
        // Convert spherical coordinates to Cartesian for positioning
        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
        
        star.scale.setScalar(Math.random() * 0.5 + 0.5); // Randomize star size slightly
        star.userData = { 
            originalPosition: star.position.clone(), // Store for parallax effect
            twinkleSpeed: Math.random() * 0.02 + 0.01 // Speed of twinkling effect
        };
        environmentObjects.stars.push(star);
        scene.add(star);
    }
}

// Create buildings alongside the road
function createBuildings() {
    const buildingMaterials = [ // Array of materials for building variety
        new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 50 }), // Dark grey
        new THREE.MeshPhongMaterial({ color: 0x333366, shininess: 30 }), // Dark blue
        new THREE.MeshPhongMaterial({ color: 0x663333, shininess: 40 })  // Dark red/brown
    ];
    
    for (let i = 0; i < 30; i++) { // Create a number of buildings
        const building = new THREE.Group(); // Group for building and its windows
        
        // Randomize building dimensions
        const height = 8 + Math.random() * 20;
        const width = 3 + Math.random() * 4;
        const depth = 3 + Math.random() * 4;
        
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingMesh.position.y = height / 2; // Position base at ground level
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        building.add(buildingMesh);
        
        // Add windows to the front face of the building
        const windowGeometry = new THREE.PlaneGeometry(0.8, 1.2); // Dimensions of a window
        const windowMaterial = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.7 ? 0xffff88 : 0x222222 // Randomly lit (yellow) or dark windows
        });
        
        // Create a grid of windows
        for (let j = 0; j < Math.floor(height / 3); j++) { // Rows of windows
            for (let k = 0; k < Math.floor(width / 2); k++) { // Columns of windows
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    -width/2 + 1 + k * 1.5, // Position across the building face
                    j * 3 + 2,              // Position up the building face
                    depth/2 + 0.01          // Slightly in front of the building face
                );
                building.add(window);
            }
        }
        
        // Position building randomly to the left or right of the road, and along its length
        const side = Math.random() > 0.5 ? 1 : -1; // -1 for left, 1 for right
        const zPosition = (Math.random() - 0.5) * ROAD_LENGTH * 2; // Random z position
        building.position.set(
            side * (15 + Math.random() * 25), // Random x offset from road
            0,                                // Base at ground level
            zPosition
        );
        
        building.userData = { originalZ: zPosition }; // Store for repositioning
        environmentObjects.buildings.push(building);
        scene.add(building);
    }
}

// Create trees alongside the road
function createTrees() {
    // Materials for tree trunk and leaves
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 12); // Tapered cylinder for trunk
    const trunkMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513, // Brown color for trunk
        shininess: 10
    });
    
    const leavesGeometry = new THREE.SphereGeometry(2, 12, 12); // Sphere for leaves canopy
    const leavesMaterials = [ // Array of green materials for variety
        new THREE.MeshLambertMaterial({ color: 0x228B22 }), // Forest green
        new THREE.MeshLambertMaterial({ color: 0x32CD32 }), // Lime green
        new THREE.MeshLambertMaterial({ color: 0x006400 })  // Dark green
    ];
    
    for (let i = 0; i < 50; i++) { // Create a number of trees
        const tree = new THREE.Group(); // Group for trunk and leaves
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2; // Position base of trunk at ground level
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        const leavesMaterial = leavesMaterials[Math.floor(Math.random() * leavesMaterials.length)];
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4.5; // Position leaves on top of the trunk
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);
        
        // Add some variation to tree shapes by scaling the leaves canopy
        leaves.scale.set(
            0.8 + Math.random() * 0.4, // Random width
            0.8 + Math.random() * 0.4, // Random height
            0.8 + Math.random() * 0.4  // Random depth
        );
        
        // Position tree randomly to the left or right of the road, and along its length
        const side = Math.random() > 0.5 ? 1 : -1;
        const zPosition = (Math.random() - 0.5) * ROAD_LENGTH * 2;
        tree.position.set(
            side * (12 + Math.random() * 20), // Random x offset from road
            0,
            zPosition
        );
        
        tree.userData = { // Store data for animation and repositioning
            originalZ: zPosition,
            swaySpeed: Math.random() * 0.008 + 0.004, // Speed of swaying animation
            swayAmount: Math.random() * 0.05 + 0.02   // Amount of sway
        };
        environmentObjects.trees.push(tree);
        scene.add(tree);
    }
}

// Initialize game state and objects
function initGame() {
    gameRunning = false; // Stop the game loop if it's running
    gameSpeed = 0.04;    // Reset game speed
    score = 0;           // Reset score
    lives = 3;           // Reset lives

    // Clear dynamic game objects from the scene and dispose of them
    enemyCars.forEach(car => {
        disposeObject(car);
        if (scene) scene.remove(car); // Check if scene exists
    });
    powerUps.forEach(powerUp => {
        disposeObject(powerUp);
        if (scene) scene.remove(powerUp);
    });
    explosions.forEach(explosion => {
        disposeObject(explosion);
        if (scene) scene.remove(explosion);
    });
    
    // Reset arrays
    enemyCars = [];
    powerUps = [];
    explosions = [];
    
    // Reset player car position and rotation (if it exists)
    if (playerCar) {
        playerCar.position.set(0, 0.1, 2); // Reset to initial position
        playerCar.rotation.set(0, 0, 0);   // Reset rotation
        if (playerCar.userData.boundingBox) { 
            playerCar.userData.boundingBox.setFromObject(playerCar);
        }
    }
    
    // Reset positions of environment elements
    resetEnvironmentPositions();
    
    // Update UI elements
    updateUI();
}

// Reset environment positions to their initial state
function resetEnvironmentPositions() {
    // Iterate over each type of environment object and reset its Z position
    for (const key in environmentObjects) {
        if (Array.isArray(environmentObjects[key])) {
            environmentObjects[key].forEach(obj => {
                if (obj.userData && typeof obj.userData.originalZ === 'number') {
                    obj.position.z = obj.userData.originalZ;
                }
                // For objects that might have an X drift (like particles)
                if (obj.userData && typeof obj.userData.originalX === 'number') {
                    obj.position.x = obj.userData.originalX;
                } else if (key === 'particles' && obj.userData) { 
                     obj.position.x = (Math.random() - 0.5) * 50; // Specific reset for particles
                }
            });
        }
    }
    
    // Reset camera to its initial position and orientation
    if (camera) {
        camera.position.set(0, 4, 6);
        camera.lookAt(0, 0, -10);
    }
}

// Start game
function startGame() {
    if (!scene) { // Ensure scene is initialized only once, typically on first start
        init3D();
    }
    
    initGame(); // Initialize or reset all game variables and objects
    gameRunning = true; // Set game state to running
    if(startScreen) startScreen.style.display = 'none'; // Hide start screen
    if(gameOverScreen) gameOverScreen.style.display = 'none'; // Ensure game over screen is hidden
    
    // Start the main game animation loop, ensuring it's not already running
    // and that requestAnimationFrame is available.
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(gameLoop);
    }
}

// Game loop - the core of the game's real-time updates
function gameLoop() {
    if (!gameRunning) return; // Exit if the game is not in a running state

    try {
        // Update game elements
        if(playerCar) updatePlayer(); // Handle player input and movement, check playerCar exists
    updateEnemies();      // Move and manage enemy cars
    updatePowerUps();     // Move and manage power-ups
    updateExplosions();   // Animate and manage explosions
    updateRoad();         // Animate road markings
    updateEnvironment();  // Move environment elements for scrolling effect
    updateLighting();     // Update dynamic lights (e.g., player headlights)
    
    // Spawn new game elements
    spawnEnemies();       // Randomly spawn new enemy cars
    spawnPowerUps();      // Randomly spawn new power-ups
    
    // Game logic
    if(playerCar) checkCollisions(); // Detect collisions, check playerCar exists
    updateScore();        // Increment score based on game speed/time
    
    // Update UI
    updateUI();           // Refresh on-screen display of score, lives, speed
    
    // Increase difficulty over time by gradually increasing game speed
    // Check score > 0 to avoid increasing speed at the very beginning if score starts at 0.
    if (score > 0 && score % 1500 === 0 && gameSpeed < MAX_SPEED) { 
        gameSpeed = Math.min(gameSpeed + 0.008, MAX_SPEED); 
    }
    
    // Render the 3D scene
    if (renderer && scene && camera) { // Ensure essential THREE.js objects are initialized
        renderer.render(scene, camera);
    }
    
        // Request the next frame for smooth animation, only if game is still running
        if (gameRunning && typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(gameLoop);
        }
    } catch (e) {
        console.error("Error during game loop:", e);
        // Display error to user via the global mechanism, or a more specific one
        const errorDisplay = document.getElementById('criticalErrorDisplay');
        if (errorDisplay) {
            errorDisplay.textContent = "An error occurred during gameplay. Please try refreshing. Check console for details.";
            errorDisplay.style.display = 'block';
        }
        gameRunning = false; // Stop the game to prevent further errors
        // Optionally, re-throw if needed, but the global handler should catch it.
    }
}

// Update environment movement and looping
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
            if (!particle.userData) return; // Null check for particle.userData
            particle.position.z += movementSpeed * particle.userData.speed;
            particle.position.x += particle.userData.drift; // Apply drift
            
            // Reset particle position
            if (particle.position.z > 15) { // If particle moves past the camera
                particle.position.z = (particle.userData.originalZ || 0) - ROAD_LENGTH * 2; // Reset Z
                // Reset X to a new random position or original if available
                particle.position.x = particle.userData.originalX !== undefined ? particle.userData.originalX : (Math.random() - 0.5) * 50;
            }
            // Keep particle within horizontal bounds if drifting
            if (Math.abs(particle.position.x) > 50) {
                if(particle.userData.drift) particle.userData.drift *= -1; // Reverse drift direction
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

    // Update player bounding box
    playerCar.userData.boundingBox.setFromObject(playerCar);
    
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
        enemy.userData.boundingBox.setFromObject(enemy); // Update bounding box
        
        // Remove enemies that are behind the player
        if (enemy.position.z > 10) {
            disposeObject(enemy); // Dispose of the enemy car
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
        powerUp.userData.boundingBox.setFromObject(powerUp); // Update bounding box
        
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
            disposeObject(powerUp); // Dispose of the power-up
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
            disposeObject(explosion); // Dispose of the explosion
            scene.remove(explosion);
            explosions.splice(index, 1);
        }
    });
}

// Check collisions
function checkCollisions() {
    if (!playerCar || !playerCar.userData.boundingBox) return;
    
    const playerBox = playerCar.userData.boundingBox;
    
    // Check enemy collisions
    enemyCars.forEach((enemy, index) => {
        if (!enemy.userData.boundingBox) return;
        const enemyBox = enemy.userData.boundingBox;
        
        if (playerBox.intersectsBox(enemyBox)) {
            createExplosion(enemy.position.x, enemy.position.y + 0.5, enemy.position.z);
            disposeObject(enemy); // Dispose of the enemy car
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
        if (!powerUp.userData.boundingBox) return;
        const powerUpBox = powerUp.userData.boundingBox;
        
        if (playerBox.intersectsBox(powerUpBox)) {
            disposeObject(powerUp); // Dispose of the power-up
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
    gameRunning = false; // Stop the game loop
    if(finalScoreElement) finalScoreElement.textContent = score; // Display final score
    if(gameOverScreen) gameOverScreen.style.display = 'block'; // Show game over screen

    // No need to clear objects here if restartGame calls initGame, which does the clearing.
    // If a scenario exists where gameOver is called WITHOUT a subsequent restart, 
    // then object clearing might be needed here. For this game's flow, it seems okay.
}

// Restart game
function restartGame() {
    if(gameOverScreen) gameOverScreen.style.display = 'none'; // Hide game over screen
    
    // initGame handles resetting variables, clearing objects, and resetting positions.
    initGame(); 
    
    // Start the game again
    gameRunning = true;
    // Ensure game loop restarts if it had fully stopped or requestAnimationFrame is available
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(gameLoop);
    }
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
    // Show loading message or splash screen
    const loadingElement = document.getElementById('loadingMessage') || document.createElement('div');
    if (!loadingElement.id) { // If we just created it
        loadingElement.id = 'loadingMessage';
        loadingElement.className = 'loading'; // Assuming 'loading' class styles this
        loadingElement.textContent = 'Loading 3D Engine... Please Wait...';
        if(gameArea) gameArea.appendChild(loadingElement);
    } else {
        loadingElement.style.display = 'block'; // Ensure it's visible if it exists
    }
    
    // Defer initialization of 3D scene and game until after loading message display
    setTimeout(() => {
        if (loadingElement) {
            loadingElement.style.display = 'none'; // Hide loading message instead of removing, for potential reuse
        }
        // Game starts by showing the start screen.
        // init3D() will be called by startGame() if scene is not yet created.
        if(startScreen) startScreen.style.display = 'block'; // Show start screen
        
        // Pre-initialize essential parts if not already done by a specific game flow.
        // This helps ensure that if a user tries to interact before "Start Game" is clicked,
        // critical components like UI updaters don't fail.
        if (!scene) { // If init3D hasn't run (e.g. direct jump to game w/o start screen)
            // It's generally better to ensure startGame is the only entry point to init3D & initGame.
            // For robustness, one might consider a minimal UI setup here.
        }
        updateUI(); // Initial UI update for score/lives if they are displayed before game start.

    }, 1000); // Delay for loading message visibility
});
