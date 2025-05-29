// === Jetpack Shooter with Bosses: WW2 Era Version ===

// --- Firebase SDK Imports (now using ES Module syntax) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, limit, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Game Configuration & Constants ---
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 400;
const GROUND_Y_OFFSET = 50;
const PLAYER_START_X = 100;
const PLAYER_START_Y_OFFSET = 100;
const JETPACK_FORCE_MULTIPLIER = 0.85;
const MAX_FUEL = 150;
const FUEL_RECHARGE_RATE = 0.4;
const FUEL_CONSUMPTION_RATE = 1.0;
const INITIAL_GAME_SPEED = 3;
const MAX_GAME_SPEED = 20;
const GAME_SPEED_INCREMENT = 0.0025;

const POWERUP_DURATION = 8000; // General constant, may be unused if specifics are always preferred
const WEAPON_SYSTEM_DURATION = 12000;
const SPREAD_SHOT_DURATION = 10000;
const RAPID_FIRE_DURATION = 7000;
const SCORE_MULTIPLIER_DURATION = 10000;
const COIN_MAGNET_DURATION = 10000;
const SPEED_BURST_DURATION = 6000;

const OBSTACLE_START_INTERVAL = 1800;
const OBSTACLE_MIN_INTERVAL = 450;
const OBSTACLE_INTERVAL_DECREMENT_FACTOR = 0.98;

const POWERUP_REGULAR_INTERVAL = 3200;
const POWERUP_REGULAR_MIN_INTERVAL = 1800;
const POWERUP_BOSS_INTERVAL = 6000;
const POWERUP_BOSS_MIN_INTERVAL = 3000;
const POWERUP_INTERVAL_DECREMENT_FACTOR = 0.975;

const ENEMY_START_INTERVAL = 8000;
const ENEMY_MIN_INTERVAL = 1500;
const ENEMY_INTERVAL_DECREMENT_FACTOR = 0.97;

const BOSS_SPAWN_INTERVAL_MS = 60000; // 1 minute

// --- Scoreboard Constants ---
const MAX_HIGH_SCORES = 5;
const LOCAL_STORAGE_PLAYER_NAME_KEY = 'jetpackJumperPlayerName';

// --- Game State Variables ---
let player;
let bgMusic;
let jumpSound;
let playerProjectileSound;
let enemyProjectileSound;
let objectDestroySound;
let playerProjectiles = [];
let enemyProjectiles = [];
let obstacles = [];
let powerups = [];
let particles = [];
let enemies = [];
let boss = null;
let bossApproaching = false;
let pendingBoss = null;

let activePowerups = {};
let score = 0;
let highScores = [];
let highScore = 0;

let coinsCollectedThisRun = 0;
let scoreMultiplier = 1;

let jetpackFuel = MAX_FUEL;
let playerIsFlying = false;
let playerCanShoot = true;
let playerShootCooldown = 0;
const PLAYER_SHOOT_COOLDOWN_TIME = 300;

let gameSpeed = INITIAL_GAME_SPEED;
let baseGameSpeed = INITIAL_GAME_SPEED;

window.currentScreen = "START";
let gamePaused = false;

let lastObstacleTime = 0;
let lastPowerupTime = 0;
let lastEnemySpawnTime = 0;
let enemySpawnInterval = ENEMY_START_INTERVAL;
let obstacleInterval = OBSTACLE_START_INTERVAL;
let powerupInterval = POWERUP_REGULAR_INTERVAL;

let weaponSystemActive = false;
let currentWeaponMode = "STANDARD";

let distanceTraveled = 0;
let bossCycle = 0;
let timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS;

let gameStartTime = 0;
let gameElapsedTime = 0;

window.playerName = "Player";
let scoreboardDisplayedAfterGameOver = false;

// --- Firebase Variables ---
let db;
let auth;
let userId = "anonymous";
let isAuthReady = false;

// --- Firebase Configuration ---
const DEFAULT_APP_ID = "jetpack-7ced6"; // Default App ID if not provided by environment
const DEFAULT_FIREBASE_CONFIG = { // Default Firebase config if not provided
  apiKey: "AIzaSyDkQJHGHZapGD8sKggskwz4kkQRwmr_Kh0",
  authDomain: "jetpack-7ced6.firebaseapp.com",
  projectId: "jetpack-7ced6",
  storageBucket: "jetpack-7ced6.firebaseapp.com",
  appId: "1:34167115128:web:f31520e4bbb37f564e4c8d",
  measurementId: "G-YCEJP443C4"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : DEFAULT_APP_ID;
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : DEFAULT_FIREBASE_CONFIG;


// --- Power-up Types Enum ---
const POWERUP_TYPE = {
  COIN: "coin",
  FUEL_CELL: "fuel_cell",
  SHIELD: "shield",
  COIN_MAGNET: "coin_magnet",
  SPEED_BURST: "speed_burst",
  WEAPON_SYSTEM: "weapon_system",
  SPREAD_SHOT: "spread_shot",
  RAPID_FIRE: "rapid_fire",
  SCORE_MULTIPLIER: "score_multiplier",
};

// --- Colors (WW2 Era Palette) ---
let C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE;
let C_OBSTACLE, C_GROUND_DETAIL, C_POWERUP_COIN, C_POWERUP_FUEL, C_POWERUP_SHIELD, C_POWERUP_WEAPON, C_POWERUP_SPREAD, C_POWERUP_RAPID, C_POWERUP_MULTIPLIER, C_POWERUP_MAGNET, C_POWERUP_SPEED;
let C_BOSS_TANK, C_BOSS_SHIP, C_BOSS_FINAL, C_PARTICLE_JET, C_PARTICLE_EXPLOSION, C_PARTICLE_IMPACT, C_PARTICLE_EMBER;
let C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG;
let C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK;
let C_PILLAR_DARK, C_PILLAR_LIGHT;
let C_SKIN_TONE, C_MUSTACHE_COLOR;
let C_BLOOD_RED;
let C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE; // Specific banner colors

// Global function for drawing faux banner
function drawFauxBanner(x, y, w, h) {
  // Dark red banner background
  fill(C_BANNER_BG_RED);
  rect(x, y, w, h, 2); // Small rounding for corners

  // White circle
  fill(C_BANNER_CIRCLE_WHITE);
  ellipse(x + w / 2, y + h / 2, w * 0.55); // Slightly larger circle for better visibility

  // Stylized, connected angular emblem (not a swastika)
  let cx = x + w / 2;
  let cy = y + h / 2;
  let s = w * 0.07; // Adjusted size for better proportion

  fill(C_BANNER_SYMBOL_BLACK);
  noStroke();

  push();
  translate(cx, cy);
  rotate(PI / 4); // Suggestive 45° rotation

  // Central element
  rect(-s / 2, -s / 2, s, s);

  // Arms - adjusted to be more distinct and less like a swastika
  // Using thicker, shorter arms that clearly connect to the center
  let armLength = s * 1.2;
  let armWidth = s * 0.8;

  rect(-armLength - armWidth / 2 + s/2 , -armWidth / 2, armLength, armWidth); // Left
  rect(armWidth / 2 - s/2, -armLength - armWidth / 2, armWidth, armLength);    // Top
  rect(armWidth/2 - s/2, s/2 , armWidth, armLength);                           // Bottom
  rect(s/2, -armWidth/2, armLength, armWidth);                                 // Right

  pop();
}


function defineColors() {
  C_PLAYER = color(75, 83, 32); // Olive Drab
  C_PLAYER_PROJECTILE = color(180, 160, 50); // Muted Yellow/Brass
  C_ENEMY_DRONE = color(80, 85, 90); // Dark Grey Blue
  C_ENEMY_INTERCEPTOR = color(60, 70, 75); // Darker Grey Blue
  C_ENEMY_TURRET = color(90, 85, 80); // Brownish Grey
  C_ENEMY_PROJECTILE = color(150, 60, 40); // Dull Red/Orange

  C_OBSTACLE = color(150, 160, 170); // Light Grey Concrete
  C_GROUND_DETAIL = color(60, 50, 45); // Dark Brown Earth

  C_POWERUP_COIN = color(184, 134, 11); // Dark Gold
  C_POWERUP_FUEL = color(0, 100, 100); // Teal (unchanged)
  C_POWERUP_SHIELD = color(40, 120, 50); // Muted Green
  C_POWERUP_WEAPON = color(150, 150, 40); // Dark Yellow
  C_POWERUP_SPREAD = color(150, 70, 0); // Burnt Orange
  C_POWERUP_RAPID = color(255, 140, 0); // Bright Orange (stands out)
  C_POWERUP_MULTIPLIER = color(200, 100, 0); // Dark Orange
  C_POWERUP_MAGNET = color(100, 100, 150); // Muted Blue/Purple
  C_POWERUP_SPEED = color(180, 120, 0); // Ochre

  C_BOSS_TANK = color(75, 83, 32); // Olive Drab (like player)
  C_BOSS_SHIP = color(60, 70, 75); // Dark Grey Blue
  C_BOSS_FINAL = color(100, 90, 100); // Dark Purplish Grey

  C_PARTICLE_JET = color(180, 80, 0); // Orange/Red
  C_PARTICLE_EXPLOSION = [
    color(150, 40, 0), color(120, 80, 0), color(100, 100, 20), color(80, 80, 80), // Oranges, Yellows, Greys
  ];
  C_PARTICLE_IMPACT = color(100, 100, 100, 180); // Grey sparks
  C_PARTICLE_EMBER = color(255, 100, 0, 150); // Flickering ember color

  C_TEXT_MAIN = color(220); // Off-white
  C_TEXT_ACCENT = color(180, 160, 50); // Muted Yellow
  C_TEXT_SCORE = color(200, 200, 100); // Pale Yellow
  C_HUD_BG = color(20, 20, 20, 180); // Very Dark Grey, semi-transparent

  C_SKY_OVERCAST = color(60, 70, 80); // Greyish Blue Sky
  C_SKY_HORIZON = color(80, 90, 100); // Lighter Greyish Blue Horizon
  C_BUILDING_DARK = color(35, 35, 35); // Very Dark Grey for buildings
  C_BUILDING_LIGHT = color(55, 50, 45); // Dark Brownish Grey for building details
  C_RUBBLE_DARK = color(45, 40, 35); // Dark Brown/Grey Rubble
  C_RUBBLE_LIGHT = color(65, 60, 55); // Lighter Brown/Grey Rubble
  C_SMOKE_EFFECT = color(70, 70, 70, 50); // Base smoke color (grey, transparent)
  C_FIRE_GLOW_STRONG = color(255, 100, 0, 30); // Distant fire glow (orange, transparent)
  C_FIRE_GLOW_WEAK = color(200, 150, 0, 20);   // Embers/haze glow (yellow-orange, transparent)

  C_PILLAR_DARK = color(50, 55, 60); // Dark Grey Pillar
  C_PILLAR_LIGHT = color(70, 75, 80); // Lighter Grey Pillar Detail

  C_SKIN_TONE = color(200, 160, 120);
  C_MUSTACHE_COLOR = color(30, 30, 30);
  C_BLOOD_RED = color(180, 30, 30); // For health bars, etc.

  // Banner specific colors
  C_BANNER_BG_RED = color(110, 0, 0); // Dark, desaturated red
  C_BANNER_SYMBOL_BLACK = color(0);   // Black for the symbol
  C_BANNER_CIRCLE_WHITE = color(220); // Off-white for the circle (not stark white)
}


window.preload = function() {
  // Load sound assets
  bgMusic = loadSound('assets/background_music.mp3');
  jumpSound = loadSound('assets/jump.mp3');
  playerProjectileSound = loadSound('assets/player_projectile.mp3');
  enemyProjectileSound = loadSound('assets/projectile.mp3');
  objectDestroySound = loadSound('assets/object_destroy.mp3');

  // Configure sound properties
  bgMusic.setVolume(0.4);
  bgMusic.setLoop(true);
  jumpSound.setVolume(0.7);
  playerProjectileSound.setVolume(0.6);
  enemyProjectileSound.setVolume(0.6);
  objectDestroySound.setVolume(0.9);
  jumpSound.setLoop(false);
  playerProjectileSound.setLoop(false);
  enemyProjectileSound.setLoop(false);
  objectDestroySound.setLoop(false);
}

// --- Background Element Class ---
class BackgroundElement {
    constructor(x, y, w, h, type, speedFactor, color1, color2 = null) {
        this.initialX = x;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type; // 'building', 'pillar', 'rubble', 'static_wreck', 'banner_pole' (renamed for clarity)
        this.speedFactor = speedFactor;
        this.color1 = color1;
        this.color2 = color2 || color1;
        this.noiseOffsetX = random(1000); 
        this.noiseOffsetY = random(1000);
        this.bannerSeed = random(100); // Seed for banner randomness per building

        this.wreckRotation = random(-0.15, 0.15); // For static wrecks (tanks)
        this.emberTime = 0; // For rubble embers
    }

    update() {
        // Consistent deltaTime scaling
        this.x -= gameSpeed * this.speedFactor * (deltaTime / (1000 / 60));

        if (this.x + this.w < -100) { // Increased margin before reset
            this.x = SCREEN_WIDTH + random(100, 300); // Reset further off-screen for smoother transitions
            this.bannerSeed = random(100); // Re-randomize banner seed
            this.noiseOffsetX = random(1000); // Re-randomize noise offset for fire/smoke
            this.noiseOffsetY = random(1000);

            // Re-randomize properties for variety on respawn, with slightly adjusted ranges
            if (this.type === 'building') {
                this.h = random(SCREEN_HEIGHT * 0.35, SCREEN_HEIGHT * 0.75); // Slightly less extreme height variation
                this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
                this.w = random(70, 180); // Slightly less extreme width variation
            } else if (this.type === 'pillar') {
                this.h = random(SCREEN_HEIGHT * 0.25, SCREEN_HEIGHT * 0.55);
                this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
                this.w = random(25, 55);
            } else if (this.type === 'rubble') {
                this.h = random(15, 45); // Rubble can be a bit taller
                this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h; // Rubble is grounded
                this.w = random(40, 90);
            } else if (this.type === 'static_wreck') { // Tank silhouette
                this.w = random(70, 110);
                this.h = random(35, 55);
                this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h + random(0,10); // Slightly embedded or on small mound
                this.wreckRotation = random(-0.1, 0.1); // Less extreme rotation
            } else if (this.type === 'banner_pole') { // Banners attached to poles (less common, more standalone)
                this.w = random(40, 60); // Banner width
                this.h = random(60, 100); // Banner height
                this.y = random(SCREEN_HEIGHT * 0.1, SCREEN_HEIGHT * 0.3); // Hanging higher
                 // Pole height will be this.h + some extra
            }
        }
    }

    show() {
        noStroke();
        if (this.type === 'building') {
            fill(this.color1); 
            rect(this.x, this.y, this.w, this.h);

            // Jagged/broken top edge
            fill(this.color1); 
            beginShape();
            vertex(this.x, this.y);
            for (let i = 0; i <= 10; i++) {
                let stepX = this.x + (this.w / 10) * i;
                let stepY = this.y - noise(this.noiseOffsetX + i * 0.3) * this.h * 0.18; // Use noise for more natural broken edge
                vertex(stepX, stepY);
            }
            vertex(this.x + this.w, this.y);
            vertex(this.x + this.w, this.y + random(5,15)); 
            vertex(this.x, this.y + random(5,15));
            endShape(CLOSE);

            fill(this.color2); 
            for (let i = 0; i < random(2, 6); i++) { 
                let spotX = this.x + random(this.w * 0.1, this.w * 0.8);
                let spotY = this.y + random(this.h * 0.1, this.h * 0.8);
                let spotW = random(this.w * 0.15, this.w * 0.35); // Windows/holes
                let spotH = random(this.h * 0.1, this.h * 0.25);
                rect(spotX, spotY, spotW, spotH); 
                
                stroke(C_PILLAR_DARK); // Exposed rebar
                strokeWeight(random(1,2));
                if(random() < 0.6) line(spotX + random(spotW*0.2), spotY + random(spotH*0.2), spotX + spotW - random(spotW*0.2), spotY + spotH - random(spotH*0.2));
                if(random() < 0.4) line(spotX + spotW - random(spotW*0.2), spotY + random(spotH*0.2), spotX + random(spotW*0.2), spotY + spotH - random(spotH*0.2));
                noStroke();
            }
            
            // Smoke/fire glow from some buildings
            if (noise(this.noiseOffsetX + 100) < 0.4) { // Use noise for consistency
                let glowX = this.x + this.w / 2;
                let glowY = this.y - random(5,25); 
                let flicker = noise(this.noiseOffsetY + frameCount * 0.05);
                fill(C_FIRE_GLOW_STRONG.levels[0], C_FIRE_GLOW_STRONG.levels[1], C_FIRE_GLOW_STRONG.levels[2], 30 + flicker * 80);
                ellipse(glowX, glowY, this.w * (0.4 + flicker * 0.25), this.h * (0.15 + flicker * 0.15));
            }

            // Integrate Faux Banner on buildings
            // Use the bannerSeed for consistent banner presence per building instance until it resets
            if (noise(this.bannerSeed) < 0.3) { // ~30% chance based on seed
                let bannerW = this.w * 0.25; // Banner width relative to building
                let bannerH = this.h * 0.4;  // Banner height relative to building
                // Position banner on the building facade, slightly offset
                let bannerX = this.x + this.w * 0.1 + noise(this.bannerSeed + 10) * (this.w * 0.5 - bannerW); // Random horizontal placement
                let bannerY = this.y + this.h * 0.1 + noise(this.bannerSeed + 20) * (this.h * 0.4 - bannerH); // Random vertical placement
                
                // Ensure banner is not too small
                bannerW = max(20, bannerW); 
                bannerH = max(30, bannerH);

                drawFauxBanner(bannerX, bannerY, bannerW, bannerH);
            }


        } else if (this.type === 'pillar') {
            fill(this.color1);
            rect(this.x, this.y, this.w, this.h, 2);
            fill(this.color2);
            stroke(this.color2);
            strokeWeight(1.5);
            line(this.x + this.w * 0.3, this.y + this.h * 0.2, this.x + this.w * 0.7, this.y + this.h * 0.4);
            line(this.x + this.w * 0.2, this.y + this.h * 0.8, this.x + this.w * 0.8, this.y + this.h * 0.7);
            noStroke();
            for (let i = 0; i < random(1, 3); i++) {
                rect(this.x, this.y + this.h * (0.2 + i * 0.25), this.w, random(3, 6), 1);
            }
        } else if (this.type === 'rubble') {
            fill(this.color1); 
            for(let i=0; i< random(2,4); i++){ 
                beginShape();
                vertex(this.x + random(-5,5), this.y + this.h + random(-3,3));
                vertex(this.x + this.w * 0.2 + random(-5,5), this.y + random(-5,5) + this.h*0.5);
                vertex(this.x + this.w * 0.5 + random(-5,5), this.y + random(-5,5));
                vertex(this.x + this.w * 0.8 + random(-5,5), this.y + random(-5,5) + this.h*0.5);
                vertex(this.x + this.w + random(-5,5), this.y + this.h + random(-3,3));
                endShape(CLOSE);
            }
            fill(this.color2); 
             for(let i=0; i<random(1,3); i++){
                rect(this.x + random(this.w*0.1, this.w*0.3), this.y + random(this.h*0.3, this.h*0.5), random(this.w*0.2, this.w*0.5), random(this.h*0.2, this.h*0.4), 1);
            }
            // Small smoke plumes from rubble
            if (noise(this.noiseOffsetX + frameCount * 0.02) < 0.3) {
                fill(C_SMOKE_EFFECT.levels[0], C_SMOKE_EFFECT.levels[1], C_SMOKE_EFFECT.levels[2], 20 + noise(this.noiseOffsetY + frameCount * 0.03) * 30);
                ellipse(this.x + this.w/2 + random(-5,5), this.y - random(5,10), random(10,20), random(15,25));
            }
            // Flickering embers
            this.emberTime += deltaTime;
            if (this.emberTime > 100) { // Update embers periodically
                this.emberTime = 0;
                if (random() < 0.2) { // Chance for an ember
                    let emberX = this.x + random(this.w);
                    let emberY = this.y + random(this.h * 0.5, this.h); // Near bottom of rubble
                    let emberSize = random(2, 5);
                    let emberAlpha = 100 + noise(this.noiseOffsetX + frameCount * 0.1) * 155;
                    fill(C_PARTICLE_EMBER.levels[0], C_PARTICLE_EMBER.levels[1], C_PARTICLE_EMBER.levels[2], emberAlpha);
                    ellipse(emberX, emberY, emberSize, emberSize);
                }
            }

        } else if (this.type === 'static_wreck') { // Enhanced Tank Silhouette
            push();
            translate(this.x + this.w / 2, this.y + this.h / 2);
            rotate(this.wreckRotation);
            // Use a grey or olive color for tank silhouette
            let tankColor = random() < 0.5 ? C_ENEMY_DRONE : C_BOSS_TANK; // Grey or Olive
            fill(tankColor);
            noStroke();

            // Main Hull (more rectangular)
            rect(-this.w / 2, -this.h / 2 + this.h * 0.1, this.w, this.h * 0.7, 2); 
            // Turret (more defined)
            rect(-this.w * 0.25, -this.h / 2 - this.h * 0.2, this.w * 0.5, this.h * 0.4, 1); 
            // Barrel (longer, thinner)
            rect(0, -this.h / 2 - this.h * 0.1, this.w * 0.55, this.h * 0.15, 1); 
            
            // Tracks/Wheels (simplified but distinct)
            fill(lerpColor(tankColor, color(0), 0.3)); // Darker shade for tracks
            rect(-this.w/2, this.h/2 - this.h*0.2, this.w, this.h*0.25, 2); // Continuous track base
            for(let i = -this.w/2 + this.w*0.1; i < this.w/2 - this.w*0.1; i += this.w*0.25){
                 ellipse(i, this.h/2 - this.h*0.075, this.w*0.15, this.w*0.15);
            }
            pop();
        } else if (this.type === 'banner_pole') { // Standalone banner on a pole
            // Pole
            fill(C_PILLAR_DARK);
            rect(this.x - 3, this.y - 10, 6, this.h + 20, 1); // Pole extends above and below banner slightly

            // Draw the banner itself using the global function
            // Position banner relative to its own (this.x, this.y) which is top-left of banner cloth
            drawFauxBanner(this.x, this.y, this.w, this.h);
        }
    }
}


let backgroundElements = []; // Combined array for all background elements for easier management


let bgOffset1 = 0;
let smokeParticles = []; // For more dynamic smoke


window.setup = function() {
  console.log("p5.js setup() called!");
  let canvas = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  canvas.parent('game-container');
  pixelDensity(1);
  defineColors();
  textFont('Oswald'); // Ensure font is set
  noiseSeed(Date.now()); 
  resetGame();
  window.currentScreen = "START";

  // Initialize Firebase
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        console.log("Firebase: User signed in with UID:", userId);
      } else {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
          // Check if currentUser is available after sign-in attempts
          if (auth.currentUser) {
            userId = auth.currentUser.uid;
            console.log("Firebase: Signed in. UID:", userId);
          } else {
            console.error("Firebase: auth.currentUser is null after sign-in attempts.");
            userId = crypto.randomUUID(); 
            console.warn("Firebase: Falling back to random UUID for userId:", userId);
          }
        } catch (error) {
          console.error("Firebase: Authentication failed:", error);
          userId = crypto.randomUUID(); 
          console.warn("Firebase: Falling back to random UUID for userId:", userId);
        }
      }
      isAuthReady = true;
      if (typeof window.loadHighScores === 'function') window.loadHighScores();
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName();

      // This should now be called after auth is ready and playerName might be loaded
      if (typeof window.showNameInput === 'function') {
          window.showNameInput(true); 
      } else {
          console.error("DEBUG: window.showNameInput is not defined!");
      }
    });
  } catch (e) {
      console.error("Firebase initialization error:", e);
      isAuthReady = false; 
      // Fallback if Firebase fails completely
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName(); // Load local name
       if (typeof window.showNameInput === 'function') window.showNameInput(true);
  }


  if (bgMusic && bgMusic.isLoaded()) {
    bgMusic.loop();
  } else if (bgMusic) {
    bgMusic.onended(() => { if(window.currentScreen === "GAME") bgMusic.loop(); }); 
  }
}


window.resetGameValues = function() {
  console.log("resetGameValues called!");
  player = new Player();
  playerProjectiles = [];
  enemyProjectiles = [];
  obstacles = [];
  powerups = [];
  particles = [];
  enemies = [];
  boss = null;
  bossApproaching = false;
  pendingBoss = null;

  weaponSystemActive = false;
  currentWeaponMode = "STANDARD";
  activePowerups = {};
  scoreMultiplier = 1;

  jetpackFuel = MAX_FUEL;
  gameSpeed = INITIAL_GAME_SPEED;
  baseGameSpeed = INITIAL_GAME_SPEED;
  score = 0;
  coinsCollectedThisRun = 0;
  distanceTraveled = 0;
  bossCycle = 0;
  if(player) player.shieldCharges = 0;

  timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS;
  obstacleInterval = OBSTACLE_START_INTERVAL;
  powerupInterval = POWERUP_REGULAR_INTERVAL;
  enemySpawnInterval = ENEMY_START_INTERVAL;

  gameStartTime = millis();
  gameElapsedTime = 0;
  
  scoreboardDisplayedAfterGameOver = false;

  // Initialize background elements
  backgroundElements = []; // Clear and repopulate
  smokeParticles = []; 
  bgOffset1 = 0;

  // Populate buildings (distant, slow)
  for (let i = 0; i < 6; i++) { // Slightly more buildings
      let bX = random(SCREEN_WIDTH * 0.1, SCREEN_WIDTH * 1.8) + i * (SCREEN_WIDTH / 3.5); // Stagger initial positions
      let bH = random(SCREEN_HEIGHT * 0.35, SCREEN_HEIGHT * 0.75);
      let bY = SCREEN_HEIGHT - GROUND_Y_OFFSET - bH;
      let bW = random(70, 180);
      backgroundElements.push(new BackgroundElement(bX, bY, bW, bH, 'building', 0.15, C_BUILDING_DARK, C_BUILDING_LIGHT));
  }

  // Populate pillars (mid-ground)
  for (let i = 0; i < 8; i++) { // Slightly more pillars
      let pX = random(SCREEN_WIDTH * 0.1, SCREEN_WIDTH * 1.5) + i * (SCREEN_WIDTH / 4);
      let pH = random(SCREEN_HEIGHT * 0.25, SCREEN_HEIGHT * 0.55);
      let pY = SCREEN_HEIGHT - GROUND_Y_OFFSET - pH;
      let pW = random(25, 55);
      backgroundElements.push(new BackgroundElement(pX, pY, pW, pH, 'pillar', 0.3, C_PILLAR_DARK, C_PILLAR_LIGHT));
  }
  
  // Populate static wrecks (tanks) (mid-ground, slower than rubble)
  for (let i = 0; i < 4; i++) { // More tanks
      let wX = random(SCREEN_WIDTH * 0.2, SCREEN_WIDTH * 1.8) + i * (SCREEN_WIDTH / 2);
      let wW = random(70, 110);
      let wH = random(35, 55);
      let wY = SCREEN_HEIGHT - GROUND_Y_OFFSET - wH + random(0,10); 
      backgroundElements.push(new BackgroundElement(wX, wY, wW, wH, 'static_wreck', 0.35, C_ENEMY_DRONE)); // Using drone color for greyish
  }

  // Populate rubble (foreground, fastest)
  for (let i = 0; i < 20; i++) { // More rubble for destroyed feel
      let rX = random(SCREEN_WIDTH * 0.05, SCREEN_WIDTH * 1.2) + i * (SCREEN_WIDTH / 6);
      let rH = random(15, 45);
      let rY = SCREEN_HEIGHT - GROUND_Y_OFFSET - rH;
      let rW = random(40, 90);
      backgroundElements.push(new BackgroundElement(rX, rY, rW, rH, 'rubble', 0.5, C_RUBBLE_DARK, C_RUBBLE_LIGHT));
  }
  
  // Populate standalone banners on poles (less frequent, for variety)
  for (let i = 0; i < 2; i++) {
      let bannerX = random(SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 2.0) + i * (SCREEN_WIDTH / 1.5);
      let bannerPoleH = random(SCREEN_HEIGHT * 0.2, SCREEN_HEIGHT * 0.5); // Height of the pole part
      let bannerActualH = random(60,100); // Height of the cloth
      let bannerY = SCREEN_HEIGHT - GROUND_Y_OFFSET - bannerPoleH - bannerActualH + random(20,50) ; // Ensure pole is grounded, banner hangs from it
      bannerY = max(SCREEN_HEIGHT * 0.1, bannerY); // Don't let it go too low
      let bannerW = random(40, 60);
      // The BackgroundElement's Y will be the top of the banner cloth. The pole is drawn relative to this.
      // For a pole of height `poleTotalHeight` where banner hangs at `bannerY` of height `bannerActualH`,
      // the pole starts at `bannerY - (poleTotalHeight - bannerActualH)` and ends at `bannerY + bannerActualH`.
      // Or, if pole is grounded, its top is `SCREEN_HEIGHT - GROUND_Y_OFFSET - poleTotalHeight`.
      // Let's make banner_pole's Y the top of the pole, and banner hangs from it.
      let poleTopY = random(SCREEN_HEIGHT * 0.1, SCREEN_HEIGHT * 0.3);
      let poleHeight = random(80, 150);

      // For 'banner_pole', this.x, this.y is top-left of banner cloth.
      // this.w, this.h is banner cloth dimensions. Pole drawn relative.
      // For simplicity, let's assume the 'banner_pole' type means the banner itself, and it implies a pole.
      // The `drawFauxBanner` is called within `BackgroundElement.show()` for type 'building'.
      // For 'banner_pole' type, we can call it directly or have specific logic.
      // The current `BackgroundElement.show()` for 'banner_pole' draws a pole and then calls drawFauxBanner.
      // So, the `y` here should be the top of the banner cloth.
      let bannerClothY = random(SCREEN_HEIGHT*0.15, SCREEN_HEIGHT*0.4);
      backgroundElements.push(new BackgroundElement(bannerX, bannerClothY, bannerW, bannerActualH, 'banner_pole', 0.25, C_PILLAR_DARK));
  }


  // Initial smoke particles for atmospheric effect
  for (let i = 0; i < 15; i++) { // More atmospheric smoke
    smokeParticles.push(new Particle(
        random(SCREEN_WIDTH), random(SCREEN_HEIGHT * 0.1, SCREEN_HEIGHT * 0.6), // Wider vertical spread
        C_SMOKE_EFFECT, random(70, 160), random(12000, 20000), // Slightly larger, longer lifetime
        createVector(random(-0.1, 0.1) * gameSpeed * 0.05, random(-0.08, -0.2)), // Slower horizontal, stronger upward drift
        0.995, 'ellipse' // Higher drag, very slow dissipation
    ));
  }
  // Sort background elements by speedFactor (descending) so faster elements are drawn on top (further back in array)
  // Or ascending, so slower elements (further away) are drawn first.
  // Slower elements (smaller speedFactor) should be drawn first (further back).
  backgroundElements.sort((a, b) => a.speedFactor - b.speedFactor);
}

function resetGame() {
  resetGameValues();
}

window.setPlayerFlyingState = function(isFlying) {
    playerIsFlying = isFlying;
};

window.triggerJumpSound = function() {
    if (jumpSound && jumpSound.isLoaded()) {
        jumpSound.rate(random(0.9, 1.1));
        jumpSound.play();
    }
};

window.stopPlayerFlying = function() {
    playerIsFlying = false;
};

window.triggerPlayerShoot = function() {
    if (window.currentScreen === "GAME" && playerCanShoot && player) {
        if (currentWeaponMode === "SPREAD") {
            for (let i = -1; i <= 1; i++) {
                playerProjectiles.push(
                    new PlayerProjectile(
                        player.x + player.w,
                        player.y + player.h / 2,
                        i * 0.2 
                    )
                );
            }
        } else {
            playerProjectiles.push(
                new PlayerProjectile(player.x + player.w, player.y + player.h / 2)
            );
        }
        playerShootCooldown = activePowerups[POWERUP_TYPE.RAPID_FIRE] ? PLAYER_SHOOT_COOLDOWN_TIME * 0.4 : PLAYER_SHOOT_COOLDOWN_TIME;
        playerCanShoot = false;
    }
};


window.loadHighScores = function() {
    if (!isAuthReady || !db) {
        console.log("Firestore not ready, delaying loadHighScores.");
        // Attempt to load from localStorage as a fallback? No, rules specify Firestore.
        return;
    }
    console.log("loadHighScores called. Current userId:", userId);

    const highScoresCollectionRef = collection(db, `/artifacts/${appId}/public/data/highScores`);
    const q = query(highScoresCollectionRef, limit(100)); 

    onSnapshot(q, (snapshot) => {
        console.log("Firestore: onSnapshot triggered for high scores. Number of documents:", snapshot.size);
        const fetchedScores = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.score !== undefined && data.name && data.userId) { // Ensure all fields are present
                fetchedScores.push(data);
            }
        });

        // Get the single highest score for each unique userId
        const uniqueUserHighScores = new Map();
        fetchedScores.forEach(entry => {
            const currentHighest = uniqueUserHighScores.get(entry.userId);
            if (!currentHighest || entry.score > currentHighest.score) {
                uniqueUserHighScores.set(entry.userId, entry);
            }
        });

        // Convert map values to array, sort by score, and take top N
        let filteredScores = Array.from(uniqueUserHighScores.values());
        filteredScores.sort((a, b) => b.score - a.score); // Sort descending by score
        highScores = filteredScores.slice(0, MAX_HIGH_SCORES); // Get top N
        
        highScore = highScores.length > 0 ? highScores[0].score : 0; // Update overall high score
        
        console.log("Firestore: High scores updated:", highScores);
        if (typeof window.displayHighScores === 'function') {
            window.displayHighScores(); 
        }
    }, (error) => {
        console.error("Error fetching high scores from Firestore:", error);
    });
};

window.saveHighScore = async function(newScore) {
    if (!isAuthReady || !db || !userId || userId === "anonymous" || userId.startsWith("anonymous_fallback")) { 
        console.warn("Firestore not ready or user not properly authenticated, cannot save high score. UserID:", userId);
        return;
    }

    if (typeof newScore !== 'number' || newScore <= 0) {
        console.warn("Attempted to save invalid score:", newScore);
        return;
    }

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
        const docRef = await addDoc(collection(db, `/artifacts/${appId}/public/data/highScores`), {
            name: window.playerName,
            score: newScore,
            date: formattedDate,
            userId: userId, 
            timestamp: serverTimestamp() // Use server timestamp for reliable ordering if needed later
        });
        console.log("Firestore: Document written with ID: ", docRef.id, "Score:", newScore, "Player:", window.playerName, "UID:", userId);
    } catch (e) {
        console.error("Firestore: Error adding document: ", e);
    }
};

window.displayHighScores = function() {
    console.log("displayHighScores called!");
    const highScoresList = document.getElementById('highScoresList');
    if (!highScoresList) {
        console.warn("highScoresList element not found.");
        return;
    }
    highScoresList.innerHTML = ''; 

    if (highScores.length === 0) {
        highScoresList.innerHTML = '<li>No combat records yet, Soldier!</li>';
        return;
    }

    highScores.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="rank">${index + 1}.</span> <span class="player-name">${entry.name || 'Unknown Pilot'}:</span> <span class="score-value">${entry.score}</span> <span class="score-date">(${(entry.date || 'N/A')})</span>`;
        highScoresList.appendChild(listItem);
    });
};

window.loadPlayerName = function() {
    const storedName = localStorage.getItem(LOCAL_STORAGE_PLAYER_NAME_KEY);
    if (storedName) {
        window.playerName = storedName;
    } else {
        // Set a default name if nothing is stored
        window.playerName = "Recruit"; 
    }
    console.log("Loaded player name:", window.playerName);
};

window.savePlayerName = function(name) {
    if (name && name.trim().length > 0) {
        window.playerName = name.trim();
        localStorage.setItem(LOCAL_STORAGE_PLAYER_NAME_KEY, window.playerName);
        console.log("Player name saved:", window.playerName);
    } else {
        console.log("Attempted to save empty name, keeping current name:", window.playerName);
    }
};

window.deletePlayerName = function() {
    localStorage.removeItem(LOCAL_STORAGE_PLAYER_NAME_KEY);
    window.playerName = "Recruit"; // Reset to default
    console.log("Player name deleted. Reset to:", window.playerName);
    const nameInputField = document.getElementById('nameInputField');
    if (nameInputField) nameInputField.value = window.playerName;
};


class Player {
  constructor() {
    this.w = 35;
    this.h = 45;
    this.x = PLAYER_START_X;
    this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h - PLAYER_START_Y_OFFSET;
    this.vy = 0;
    this.gravity = 0.55;
    this.lift = -10.5 * JETPACK_FORCE_MULTIPLIER;
    this.onGround = false;

    this.headRadiusX = (this.w * 0.8) / 2;
    this.headRadiusY = (this.h * 0.7) / 2;
    this.headOffsetY = -this.h * 0.2;
    this.shieldCharges = 0;
  }

  update() {
    if (playerIsFlying) {
        jetpackFuel -= FUEL_CONSUMPTION_RATE * (deltaTime / (1000/60)); // Scale fuel consumption
        if (jetpackFuel <= 0) {
            jetpackFuel = 0;
            playerIsFlying = false; 
        }
        this.vy = this.lift; 
        this.onGround = false;
        if (frameCount % 3 === 0) { 
            particles.push(
                new Particle(
                    this.x + this.w * 0.2, 
                    this.y + this.h * 0.9,
                    C_PARTICLE_JET, 
                    random(6, 12), 
                    random(15 * (1000/60), 25 * (1000/60)), // Lifetime in ms
                    createVector(random(-0.5, 0.5), random(1, 3)), 
                    0.95 
                )
            );
        }
    } else { 
      if (this.onGround) { 
        jetpackFuel = min(MAX_FUEL, jetpackFuel + FUEL_RECHARGE_RATE * (deltaTime / (1000/60))); // Scale recharge
      }
    }

    if (!playerIsFlying || jetpackFuel <= 0) {
      this.vy += this.gravity * (deltaTime / (1000/60)); // Scale gravity
    }

    this.y += this.vy * (deltaTime / (1000/60)); // Scale movement

    let groundLevel = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
    if (this.y >= groundLevel) {
      this.y = groundLevel;
      this.vy = 0; 
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.2; 
    }
  }

   show() {
    stroke(20, 30, 40); 
    strokeWeight(2);

    fill(C_PLAYER); 
    rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.8, 3); 

    beginShape();
    vertex(this.x + this.w * 0.1, this.y + this.h * 0.2);
    vertex(this.x + this.w * 0.9, this.y + this.h * 0.2);
    vertex(this.x + this.w, this.y + this.h * 0.4);
    vertex(this.x + this.w * 0.5, this.y + this.h * 0.55); 
    vertex(this.x, this.y + this.h * 0.4);
    endShape(CLOSE);

    fill(C_SKIN_TONE);
    ellipse(this.x + this.w / 2, this.y + this.headOffsetY, this.headRadiusX * 1.8, this.headRadiusY * 1.8);

    fill(C_PLAYER.levels[0] - 10, C_PLAYER.levels[1] - 10, C_PLAYER.levels[2] - 10); 
    rect(this.x + this.w * 0.15, this.y + this.headOffsetY - this.headRadiusY * 1.2, this.w * 0.7, this.headRadiusY * 0.8, 3); 
    beginShape(); 
    vertex(this.x + this.w * 0.1, this.y + this.headOffsetY - this.headRadiusY * 0.4);
    vertex(this.x + this.w * 0.9, this.y + this.headOffsetY - this.headRadiusY * 0.4);
    vertex(this.x + this.w * 0.8, this.y + this.headOffsetY - this.headRadiusY * 0.1);
    vertex(this.x + this.w * 0.2, this.y + this.headOffsetY - this.headRadiusY * 0.1);
    endShape(CLOSE);

    fill(C_MUSTACHE_COLOR);
    ellipse(this.x + this.w / 2, this.y + this.headOffsetY + this.headRadiusY * 0.4, 4, 3);


    fill(40, 45, 50); 
    rect(this.x - 12, this.y + this.h * 0.05, 15, this.h * 0.9, 5); 
    stroke(C_OBSTACLE); 
    strokeWeight(1);
    line(this.x - 12, this.y + this.h * 0.3, this.x + 3, this.y + this.h * 0.3); 
    line(this.x - 12, this.y + this.h * 0.7, this.x + 3, this.y + this.h * 0.7);
    fill(60, 70, 80); 
    ellipse(this.x - 4, this.y + this.h * 0.2, 10, 10);
    ellipse(this.x - 4, this.y + this.h * 0.8, 10, 10);
    noStroke();


    fill(30, 35, 40); 
    rect(this.x + this.w - 5, this.y + this.h * 0.6, 35, 8, 2); 
    rect(this.x + this.w + 10, this.y + this.h * 0.6 + 8, 10, 5, 2); 
    fill(80, 50, 30); 
    rect(this.x + this.w - 10, this.y + this.h * 0.6 - 10, 10, 15, 2); 


    noStroke(); 

    const auraCenterX = this.x + this.w / 2;
    const playerVisualTopY = (this.y + this.headOffsetY) - this.headRadiusY; 
    const playerVisualBottomY = this.y + this.h; 
    const playerVisualHeight = playerVisualBottomY - playerVisualTopY;
    const auraCenterY = playerVisualTopY + playerVisualHeight / 2;

    const auraDiameterX = this.w * 2.2; 
    const auraDiameterY = playerVisualHeight * 1.5; 

    if (weaponSystemActive) {
      let weaponColor = currentWeaponMode === "SPREAD" ? C_POWERUP_SPREAD : color(150, 180, 255, 100); 
      fill( weaponColor.levels[0], weaponColor.levels[1], weaponColor.levels[2], 60 + sin(frameCount * 0.2) * 20 ); 
      ellipse( auraCenterX, auraCenterY, auraDiameterX, auraDiameterY );
    }

    if (this.shieldCharges > 0) {
      fill( C_POWERUP_SHIELD.levels[0], C_POWERUP_SHIELD.levels[1], C_POWERUP_SHIELD.levels[2], 80 + sin(frameCount * 0.15) * 40 ); 
      ellipse( auraCenterX, auraCenterY, auraDiameterX * 1.05, auraDiameterY * 1.05 ); 
    }
  }

  hits(obj) {
    const playerHitboxX = this.x;
    const playerHitboxY = (this.y + this.headOffsetY) - this.headRadiusY; 
    const playerHitboxW = this.w;
    const playerHitboxH = (this.y + this.h) - playerHitboxY; 

    return collideRectRect(
      playerHitboxX, playerHitboxY, playerHitboxW, playerHitboxH,
      obj.x, obj.y, obj.w, obj.h
    );
  }
}
class PlayerProjectile {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.w = 20; 
    this.h = 4;  
    this.baseSpeed = 15 + gameSpeed * 1.2; 
    this.vx = cos(angle) * this.baseSpeed;
    this.vy = sin(angle) * this.baseSpeed;
    this.color = C_PLAYER_PROJECTILE; 
    this.damage = 10; 
    this.angle = angle;

    if (playerProjectileSound && playerProjectileSound.isLoaded()) {
      playerProjectileSound.rate(random(0.9, 1.1));
      playerProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60)); // Scale movement
    this.y += this.vy * (deltaTime / (1000/60)); // Scale movement
  }
  show() {
    push(); 
    translate(this.x, this.y); 
    rotate(this.angle); 
    
    fill(this.color);
    noStroke();
    rect(0, -this.h / 2, this.w, this.h, 1); 
    triangle(this.w, -this.h / 2, this.w, this.h / 2, this.w + 5, 0); 
    
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 100); 
    rect(-5, -this.h / 2, 5, this.h); 

    pop(); 
  }
  offscreen() {
    return ( this.x > width + this.w || this.x < -this.w || this.y < -this.h || this.y > height + this.h );
  }
  hits(target) { 
    return collideRectRect( this.x, this.y - this.h / 2, this.w, this.h, target.x, target.y, target.w, target.h );
  }
}

class EnemyProjectile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.r = 6; 
    this.speed = 2.5 + gameSpeed * 0.55;
    this.vx = cos(angle) * this.speed;
    this.vy = sin(angle) * this.speed;
    this.color = C_ENEMY_PROJECTILE; 
    this.rotation = random(TWO_PI); 

    if (enemyProjectileSound && enemyProjectileSound.isLoaded()) {
      enemyProjectileSound.rate(random(0.9, 1.1));
      enemyProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60)); // Scale movement
    this.y += this.vy * (deltaTime / (1000/60)); // Scale movement
    this.rotation += 0.1 * (deltaTime / (1000/60)); // Scale rotation
  }
  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    fill(this.color);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) ); 
    strokeWeight(1.5);
    rect(-this.r, -this.r, this.r * 2, this.r * 2, 2); 
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 150);
    triangle(-this.r, -this.r, this.r, -this.r, 0, -this.r * 1.5); 
    pop();
  }
  offscreen() {
    return ( this.x < -this.r || this.x > width + this.r || this.y < -this.r || this.y > height + this.r );
  }
  hits(playerRect) { 
    return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 );
  }
  hitsObstacle(obstacle) { 
    return collideRectCircle( obstacle.x, obstacle.y, obstacle.w, obstacle.h, this.x, this.y, this.r * 2 );
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; 
    this.isDestroyed = false;
    this.droneAngle = random(TWO_PI); 

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      this.w = 50; 
      this.h = 40;
      this.maxHealth = this.type === "INTERCEPTOR" ? 3 : 4;
      this.color = this.type === "INTERCEPTOR" ? C_ENEMY_INTERCEPTOR : C_ENEMY_DRONE;
      this.shootAccuracy = 0.18; 
      this.baseShootCooldown = this.type === "INTERCEPTOR" ? 2200 : 2800; 
      this.movementSpeedFactor = 1.0;
    } else { // TURRET
      this.w = 45;
      this.h = 45;
      this.maxHealth = 6;
      this.color = C_ENEMY_TURRET;
      this.shootAccuracy = 0.1;
      this.baseShootCooldown = 1800;
      this.movementSpeedFactor = 0.6; 
    }
    this.health = this.maxHealth;
    this.shootCooldown = random( this.baseShootCooldown * 0.5, this.baseShootCooldown * 1.5 ); 
  }

  update() {
    if (this.isDestroyed) return; 
    this.x -= gameSpeed * this.movementSpeedFactor * (deltaTime / (1000/60)); 

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      let ySpeed = this.type === "INTERCEPTOR" ? 0.08 : 0.05;
      let yAmplitude = this.type === "INTERCEPTOR" ? 1.3 : 1.0;
      this.y += sin(this.droneAngle + frameCount * ySpeed) * yAmplitude * (deltaTime / (1000/60)); // Scale sinusoidal movement
      this.y = constrain( this.y, this.h, SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h * 2 ); 
    }

    this.shootCooldown -= deltaTime;
    if (this.shootCooldown <= 0 && this.x < width - 20 && this.x > 20 && player) { 
      let angleToPlayer = atan2( (player.y + player.h / 2) - (this.y + this.h / 2), (player.x + player.w / 2) - (this.x + this.w / 2) );
      let randomOffset = random(-this.shootAccuracy, this.shootAccuracy);
      enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2, this.y + this.h / 2, angleToPlayer + randomOffset ) );
      this.shootCooldown = this.baseShootCooldown / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootCooldown = max(this.baseShootCooldown / 3, this.shootCooldown); 
    }
  }
  show() {
    if (this.isDestroyed) return;
    strokeWeight(2);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) );
    fill(this.color);

    if (this.type === "DRONE") {
      rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.6, 2); 
      rect(this.x + this.w * 0.2, this.y, this.w * 0.6, 5); 
      rect(this.x + this.w * 0.2, this.y + this.h - 5, this.w * 0.6, 5); 
      triangle(this.x + this.w, this.y + this.h * 0.2, this.x + this.w, this.y + this.h * 0.8, this.x + this.w + 10, this.y + this.h * 0.5); 
    } else if (this.type === "INTERCEPTOR") {
      beginShape(); 
      vertex(this.x, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y);
      vertex(this.x + this.w, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y + this.h);
      endShape(CLOSE);
      rect(this.x + this.w * 0.3, this.y + this.h * 0.3, this.w * 0.4, this.h * 0.4); 
      fill(100); 
      ellipse(this.x + this.w - 5, this.y + this.h / 2, 8, 20);
    } else { // TURRET
      rect(this.x, this.y + this.h * 0.5, this.w, this.h * 0.5, 3); 
      ellipse(this.x + this.w / 2, this.y + this.h * 0.5, this.w * 0.8, this.h * 0.8); 
      push(); 
      translate(this.x + this.w / 2, this.y + this.h * 0.5);
      if (player) { 
        rotate(atan2((player.y + player.h / 2) - (this.y + this.h * 0.5), (player.x + player.w / 2) - (this.x + this.w / 2)));
      }
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); 
      rect(0, -5, 30, 10, 2); 
      pop();
    }
    noStroke();
    if (this.health < this.maxHealth) {
      fill(C_BLOOD_RED); 
      rect(this.x, this.y - 12, this.w, 6);
      fill(70, 120, 70); 
      rect( this.x, this.y - 12, map(this.health, 0, this.maxHealth, 0, this.w), 6 );
    }
  }
takeDamage(amount) {
    this.health -= amount;
    createExplosion( this.x + this.w / 2, this.y + this.h / 2, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) ); 

    if (this.health <= 0) {
      this.isDestroyed = true;
      score += this.maxHealth * 20 * scoreMultiplier; 

      if (objectDestroySound && objectDestroySound.isLoaded()) {
        objectDestroySound.rate(random(0.9, 1.1));
        objectDestroySound.play();
      }
      createExplosion( this.x + this.w / 2, this.y + this.h / 2, 10 + floor(this.maxHealth * 2), this.color, 5 * (1000/60), 25 * (1000/60) ); 
      
      if (random() < 0.5) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.COIN ) );
      } else if (random() < 0.15) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.FUEL_CELL ) );
      }
    }
  }
  offscreen() {
    return this.x < -this.w - 20; 
  }
}

class Obstacle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = C_OBSTACLE; 
    this.detailColor = lerpColor(this.color, color(0), 0.3); 
  }
  update() {
    this.x -= gameSpeed * (deltaTime / (1000/60)); 
  }
  show() {
    fill(this.color);
    stroke(this.detailColor);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 2); 
    noStroke();
    
    fill(this.detailColor.levels[0], this.detailColor.levels[1], this.detailColor.levels[2], 180); 
    
    stroke(this.detailColor);
    strokeWeight(1.5);
    line(this.x + random(this.w * 0.1, this.w * 0.9), this.y, this.x + random(this.w * 0.1, this.w * 0.9), this.y + this.h);
    line(this.x, this.y + random(this.h * 0.1, this.h * 0.9), this.x + this.w, this.y + random(this.h * 0.1, this.h * 0.9));
    noStroke();

    for (let i = 0; i < random(3, 7); i++) {
        rect(this.x + random(0, this.w - 5), this.y + random(0, this.h - 5), random(3, 8), random(3, 6), 1);
    }
    
    fill(this.color.levels[0] - 10, this.color.levels[1] - 10, this.color.levels[2] - 10); 
    triangle(this.x, this.y, this.x + random(5, 15), this.y, this.x, this.y + random(5, 15));
    triangle(this.x + this.w, this.y, this.x + this.w - random(5, 15), this.y, this.x + this.w, this.y + random(5, 15));
    triangle(this.x, this.y + this.h, this.x + random(5, 15), this.y + this.h, this.x, this.y + this.h - random(5, 15));
    triangle(this.x + this.w, this.y + this.h, this.x + this.w - random(5, 15), this.y + this.h, this.x + this.w, this.y + this.h - random(5, 15));
  }
  offscreen() {
    return this.x < -this.w; 
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.s = type === POWERUP_TYPE.COIN ? 20 : 30; 
    this.initialY = y; 
    this.bobOffset = random(TWO_PI); 
    this.rotation = random(TWO_PI); 
    this.type = type; 
    switch (type) {
      case POWERUP_TYPE.COIN: this.color = C_POWERUP_COIN; break;
      case POWERUP_TYPE.FUEL_CELL: this.color = C_POWERUP_FUEL; break;
      case POWERUP_TYPE.SHIELD: this.color = C_POWERUP_SHIELD; break;
      case POWERUP_TYPE.WEAPON_SYSTEM: this.color = C_POWERUP_WEAPON; break;
      case POWERUP_TYPE.SPREAD_SHOT: this.color = C_POWERUP_SPREAD; break;
      case POWERUP_TYPE.RAPID_FIRE: this.color = C_POWERUP_RAPID; break;
      case POWERUP_TYPE.SCORE_MULTIPLIER: this.color = C_POWERUP_MULTIPLIER; break;
      case POWERUP_TYPE.COIN_MAGNET: this.color = C_POWERUP_MAGNET; break;
      case POWERUP_TYPE.SPEED_BURST: this.color = C_POWERUP_SPEED; break;
      default: this.color = color(150); 
    }
  }
  update() {
    if (this.type === POWERUP_TYPE.COIN && activePowerups[POWERUP_TYPE.COIN_MAGNET] > 0 && player) {
        let angleToPlayer = atan2(player.y - this.y, player.x - this.x);
        let distance = dist(player.x, player.y, this.x, this.y);
        let magnetForce = map(distance, 0, 200, 5, 0.5, true); 
        this.x += cos(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
        this.y += sin(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
    } else {
        this.x -= gameSpeed * 0.85 * (deltaTime / (1000/60)); 
    }
    this.y = this.initialY + sin(frameCount * 0.08 + this.bobOffset) * 8;
    if ( this.type === POWERUP_TYPE.COIN || this.type === POWERUP_TYPE.SPREAD_SHOT ) this.rotation += 0.08 * (deltaTime / (1000/60));
  }
  show() {
    push();
    translate(this.x + this.s / 2, this.y + this.s / 2); 
    if ( this.type === POWERUP_TYPE.COIN || this.type === POWERUP_TYPE.SPREAD_SHOT ) rotate(this.rotation);
    
    textAlign(CENTER, CENTER);
    textSize(this.s * 0.5);
    
    strokeWeight(2);
    stroke(max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30));
    fill(this.color);

    switch (this.type) {
      case POWERUP_TYPE.COIN:
        ellipse(0, 0, this.s, this.s); 
        noStroke(); 
        fill(lerpColor(this.color, color(255), 0.2)); 
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200); 
        text("$", 0, 1);
        break;
      case POWERUP_TYPE.FUEL_CELL:
        rect(-this.s * 0.3, -this.s * 0.4, this.s * 0.6, this.s * 0.8, 3); 
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        rect(-this.s * 0.2, -this.s * 0.5, this.s * 0.4, this.s * 0.1, 2); 
        fill(0, 0, 0, 200);
        text("F", 0, 1);
        break;
      case POWERUP_TYPE.SHIELD:
        beginShape(); 
        vertex(0, -this.s / 2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, this.s * 0.2);
        vertex(0, this.s / 2); vertex(-this.s * 0.4, this.s * 0.2); vertex(-this.s * 0.4, -this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        text("S", 0, 1);
        break;
      case POWERUP_TYPE.WEAPON_SYSTEM:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2); 
        noStroke();
        fill(lerpColor(this.color, color(0), 0.2));
        rect(-this.s * 0.3, -this.s * 0.3, this.s * 0.6, this.s * 0.6, 1); 
        fill(0, 0, 0, 200);
        text("W", 0, 1);
        break;
      case POWERUP_TYPE.SPREAD_SHOT:
        for (let i = -1; i <= 1; i++) rect(i * this.s * 0.25, -this.s * 0.1, this.s * 0.15, this.s * 0.4, 1); 
        fill(0, 0, 0, 200);
        textSize(this.s * 0.25); 
        text("SP", 0, 1);
        break;
      case POWERUP_TYPE.RAPID_FIRE:
        ellipse(0, 0, this.s, this.s); 
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200);
        text("RF", 0, 1);
        break;
      case POWERUP_TYPE.SCORE_MULTIPLIER:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2); 
        noStroke();
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text("x" + (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] > 0 ? scoreMultiplier : "?"), 0, 1); 
        break;
      case POWERUP_TYPE.COIN_MAGNET:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.2, 2); 
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2); 
        rect(this.s * 0.2, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2); 
        fill(0, 0, 0, 200);
        textSize(this.s * 0.4);
        text("M", 0, 1);
        break;
      case POWERUP_TYPE.SPEED_BURST:
        beginShape();
        vertex(-this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.4);
        vertex(this.s * 0.6, 0); vertex(this.s * 0.4, this.s * 0.4); vertex(this.s * 0.4, this.s * 0.2);
        vertex(-this.s * 0.4, this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text(">>", 0, 1);
        break;
      default: 
        ellipse(0, 0, this.s, this.s);
        fill(0, 0, 0, 200);
        text("?", 0, 1);
    }
    pop();
  }
  offscreen() {
    return this.x < -this.s - 20; 
  }
  hits(playerRect) { 
    return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x + this.s / 2, this.y + this.s / 2, this.s );
  }
}

class Boss {
  constructor(x, y, w, h, r, maxHealth, entrySpeed, targetX, colorVal) {
    this.x = x;
    this.y = y;
    this.w = w; 
    this.h = h; 
    this.r = r; 
    this.maxHealth = maxHealth * (1 + bossCycle * 0.25); 
    this.health = this.maxHealth;
    this.entrySpeed = entrySpeed * (1 + bossCycle * 0.1); 
    this.targetX = targetX; 
    this.color = colorVal;
    this.detailColor = lerpColor(this.color, color(0), 0.3);
    this.shootTimer = 1500; 
    this.isActive = false; 
    this.vy = 0; 
    this.gravity = 0.3; 
  }
  updateEntry() { 
    if (this.x > this.targetX) {
      this.x -= this.entrySpeed * (deltaTime / (1000 / 60));
    }
  }
  hasEntered() { 
    return this.x <= this.targetX;
  }
  updateActive() { throw new Error("UpdateActive method must be implemented by subclass"); }
  showActive() { throw new Error("ShowActive method must be implemented by subclass"); }

  update() {
    if (!this.isActive) return; 
    this.updateActive(); 
    
    this.vy += this.gravity * (deltaTime / (1000/60)); // Scale gravity
    this.y += this.vy * (deltaTime / (1000/60)); // Scale movement
    if (this.r) { 
        this.y = constrain(this.y, this.r, height - GROUND_Y_OFFSET - this.r);
    } else { 
        this.y = constrain(this.y, 0, height - GROUND_Y_OFFSET - this.h);
    }
  }
  show() {
    this.showActive(); 
    let barX = this.x - (this.r || this.w / 2);
    let barY = this.y - (this.r || this.h / 2) - 20; 
    let barW = this.r ? this.r * 2 : this.w;
    let barH = 10;
    fill(C_BLOOD_RED); 
    rect(barX, barY, barW, barH, 2);
    fill(70, 120, 70); 
    rect(barX, barY, map(this.health, 0, this.maxHealth, 0, barW), barH, 2);
    fill(this.detailColor);
    rect(barX - 2, barY, 2, barH);
    rect(barX + barW, barY, 2, barH);
  }
  takeDamage(dmg) {
    if (!this.isActive) return;
    this.health -= dmg;
    let pLast = playerProjectiles[playerProjectiles.length -1];
    let explosionX = pLast ? pLast.x : this.x + random(-20, 20);
    let explosionY = pLast ? pLast.y : this.y + random(-20, 20);
    createExplosion( explosionX, explosionY, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) );
    
    if (this.health <= 0) {
      this.health = 0;
      score += this.maxHealth * 25 * scoreMultiplier; 
    }
  }
  hits(playerRect) { 
    if (!this.isActive) return false;
    if (this.r) { 
      return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 );
    } else { 
      return collideRectRect( this.x, this.y, this.w, this.h, playerRect.x, playerRect.y, playerRect.w, playerRect.h );
    }
  }
}

class BossTank extends Boss {
  constructor() {
    super( width + 150, SCREEN_HEIGHT - GROUND_Y_OFFSET - 90, 150, 100, null, 100, 2.0, width - 150 - 70, C_BOSS_TANK );
    this.turretAngle = PI; 
  }
  updateActive() {
    if(player) {
        this.turretAngle = lerp( this.turretAngle, atan2( (player.y + player.h / 2) - (this.y + 25), (player.x + player.w / 2) - (this.x + this.w / 2 - 30) ), 0.03 * (deltaTime / (1000/60)) ); // Scale lerp
    }
    this.shootTimer -= deltaTime;
    if (this.shootTimer <= 0) {
      for (let i = -1; i <= 1; i++) {
        enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2 - 30 + cos(this.turretAngle) * 30, this.y + 25 + sin(this.turretAngle) * 30, this.turretAngle + i * 0.2 ) );
      }
      this.shootTimer = (2500 - bossCycle * 100) / (gameSpeed / INITIAL_GAME_SPEED); 
      this.shootTimer = max(900, this.shootTimer); 
      this.vy = -5; 
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x, this.y, this.w, this.h, 5); 
    fill(this.detailColor);
    rect(this.x, this.y + this.h - 30, this.w, 30, 3); 
    for (let i = 0; i < this.w; i += 20) { 
      rect(this.x + i + 2, this.y + this.h - 28, 15, 26, 2);
    }
    fill(this.color);
    ellipse(this.x + this.w / 2 - 30, this.y + 25, 60, 60); 
    push(); 
    translate(this.x + this.w / 2 - 30, this.y + 25);
    rotate(this.turretAngle);
    fill(this.detailColor);
    rect(20, -10, 50, 20, 3); 
    pop();
    noStroke();
  }
}

class BossShip extends Boss {
  constructor() {
    super( width + 120, 150, null, null, 55, 100, 1.8, width - 55 - 120, C_BOSS_SHIP );
    this.movePatternAngle = random(TWO_PI); 
    this.attackMode = 0; 
    this.modeTimer = 6000 - bossCycle * 500; 
  }
  updateActive() {
    this.y = SCREEN_HEIGHT / 2.5 + sin(this.movePatternAngle) * (SCREEN_HEIGHT / 3);
    this.movePatternAngle += 0.02 / (gameSpeed / INITIAL_GAME_SPEED) * (deltaTime / (1000/60));
    
    this.shootTimer -= deltaTime;
    this.modeTimer -= deltaTime;
    if (this.modeTimer <= 0) { 
      this.attackMode = (this.attackMode + 1) % 2;
      this.modeTimer = random(5000, 8000) - bossCycle * 500;
    }
    if (this.shootTimer <= 0 && player) {
      if (this.attackMode === 0) { 
        let angleToPlayer = atan2( (player.y + player.h / 2) - this.y, (player.x + player.w / 2) - this.x );
        for (let i = -1; i <= 1; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, angleToPlayer + i * 0.15) );
      } else { 
        for (let i = -2; i <= 2; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, PI + i * 0.3) );
      }
      this.shootTimer = (this.attackMode === 0 ? 2000 : 2800 - bossCycle * 150) / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootTimer = max(800, this.shootTimer);
      this.vy = -4; 
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    ellipse(this.x, this.y, this.r * 2.2, this.r * 1.5); 
    beginShape(); vertex(this.x - this.r * 1.2, this.y - this.r * 0.4); vertex(this.x - this.r * 2.0, this.y); vertex(this.x - this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    beginShape(); vertex(this.x + this.r * 1.2, this.y - this.r * 0.4); vertex(this.x + this.r * 2.0, this.y); vertex(this.x + this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    fill(this.detailColor); 
    rect(this.x - this.r * 1.8, this.y - 8, 10, 16, 2);
    noStroke();
  }
}

class BossFinal extends Boss {
  constructor() {
    super( width + 150, height / 2, null, null, 65, 100, 1.2, width - 65 - 70, C_BOSS_FINAL );
    this.movePatternAngle = random(TWO_PI);
    this.phase = 0; 
    this.phaseTimer = 18000 - bossCycle * 1000; 
  }
  updateActive() {
    this.x = this.targetX + cos(this.movePatternAngle) * (this.phase === 1 ? 90 : 70);
    this.y = height / 2 + sin(this.movePatternAngle * (this.phase === 2 ? 2.5 : 1.5)) * (height / 2 - this.r - 40);
    this.movePatternAngle += (0.015 + this.phase * 0.005) / (gameSpeed / INITIAL_GAME_SPEED) * (deltaTime / (1000/60));
    
    this.shootTimer -= deltaTime;
    this.phaseTimer -= deltaTime;
    if (this.phaseTimer <= 0 && this.phase < 2) { 
      this.phase++;
      this.phaseTimer = 15000 - this.phase * 2000 - bossCycle * 500;
      createExplosion(this.x, this.y, 30, this.detailColor, 10 * (1000/60), 40 * (1000/60)); 
    }
    if (this.shootTimer <= 0) {
      let numProj = 6 + this.phase * 2 + bossCycle;
      let speedMult = 0.8 + this.phase * 0.1 + bossCycle * 0.05;
      for (let a = 0; a < TWO_PI; a += TWO_PI / numProj) {
        let proj = new EnemyProjectile( this.x, this.y, a + frameCount * 0.01 * (this.phase % 2 === 0 ? 1 : -1) ); 
        proj.speed *= speedMult;
        enemyProjectiles.push(proj);
      }
      this.shootTimer = (3000 - this.phase * 500 - bossCycle * 100) / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootTimer = max(1000 - this.phase * 100, this.shootTimer);
      this.vy = -6; 
    }
  }
  showActive() {
    strokeWeight(4); 
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2, 5); 
    fill(this.detailColor);
    rect(this.x - this.r * 0.8, this.y - this.r * 1.2, this.r * 1.6, this.r * 0.4, 3); 
    rect(this.x - this.r * 1.2, this.y - this.r * 0.8, this.r * 0.4, this.r * 1.6, 3); 
    for (let i = 0; i < 4; i++) {
      push();
      translate(this.x, this.y);
      rotate(i * HALF_PI); 
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); 
      rect(this.r * 0.8, -10, 20, 20, 4); 
      pop();
    }
    noStroke();
  }
}

function updateGameLogic() {
  if (window.currentScreen !== "GAME" || gamePaused) return; 
  
  gameElapsedTime = millis() - gameStartTime;

  let speedBurstFactor = activePowerups[POWERUP_TYPE.SPEED_BURST] > 0 ? 1.5 : 1;
  
  baseGameSpeed = min(MAX_GAME_SPEED / speedBurstFactor, baseGameSpeed + GAME_SPEED_INCREMENT * (deltaTime / (1000 / 60)));
  gameSpeed = baseGameSpeed * speedBurstFactor;


  distanceTraveled += gameSpeed * (deltaTime / (1000 / 60));
  score = floor(distanceTraveled * scoreMultiplier) + coinsCollectedThisRun * 10 * scoreMultiplier; 
  
  if(player) player.update();

  if (!playerCanShoot) {
      playerShootCooldown -= deltaTime;
      if (playerShootCooldown <= 0) playerCanShoot = true;
  }

  if (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0 && player) {
    weaponSystemActive = true; 
    let fireRate = currentWeaponMode === "SPREAD" ? 12 : 8; // Frames per shot
    if (activePowerups[POWERUP_TYPE.RAPID_FIRE]) fireRate = currentWeaponMode === "SPREAD" ? 6 : 4;
    
    // Convert frame-based fire rate to time-based, considering deltaTime
    // If target FPS is 60, fireRate of 12 frames = 12 * (1000/60) ms = 200ms
    // This logic needs a timer, not frameCount % fireRate when using deltaTime for movement.
    // For now, let's assume this is intended to be frame-based for simplicity of original logic.
    // If issues arise, this should be converted to a time-based cooldown.
    if (frameCount % fireRate === 0) { 
      if (currentWeaponMode === "SPREAD") {
        for (let i = -1; i <= 1; i++) playerProjectiles.push( new PlayerProjectile( player.x + player.w, player.y + player.h / 2, i * 0.2 ) );
      } else {
        playerProjectiles.push( new PlayerProjectile(player.x + player.w, player.y + player.h / 2) );
      }
    }
  } else {
    weaponSystemActive = false; 
  }

  if ( millis() - lastObstacleTime > obstacleInterval && !boss && !bossApproaching ) {
    let oW = random(25, 60); let oH = random(40, 180); let oX = width;
    let oYT = random(1); let oY;
    if (oYT < 0.4) oY = 0; 
    else if (oYT < 0.8) oY = height - GROUND_Y_OFFSET - oH; 
    else oY = random(height * 0.15, height - GROUND_Y_OFFSET - oH - 40); 
    obstacles.push(new Obstacle(oX, oY, oW, oH));
    lastObstacleTime = millis();
    obstacleInterval = max( OBSTACLE_MIN_INTERVAL, obstacleInterval * OBSTACLE_INTERVAL_DECREMENT_FACTOR );
  }

  let currentPInterval = boss && boss.isActive ? POWERUP_BOSS_INTERVAL : POWERUP_REGULAR_INTERVAL;
  let currentMinPInterval = boss && boss.isActive ? POWERUP_BOSS_MIN_INTERVAL : POWERUP_REGULAR_MIN_INTERVAL;
  if (millis() - lastPowerupTime > powerupInterval) {
    let pType; let rand = random();
    if (boss && boss.isActive) { 
      if (rand < 0.25) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.7) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.85) pType = POWERUP_TYPE.SPREAD_SHOT;
      else pType = POWERUP_TYPE.RAPID_FIRE;
    } else { 
      if (rand < 0.2) pType = POWERUP_TYPE.COIN;
      else if (rand < 0.35) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.6) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.7) pType = POWERUP_TYPE.SPREAD_SHOT;
      else if (rand < 0.8) pType = POWERUP_TYPE.RAPID_FIRE;
      else if (rand < 0.87) pType = POWERUP_TYPE.SCORE_MULTIPLIER;
      else if (rand < 0.94) pType = POWERUP_TYPE.COIN_MAGNET;
      else pType = POWERUP_TYPE.SPEED_BURST;
    }
    powerups.push( new Powerup(width, random(60, height - GROUND_Y_OFFSET - 90), pType) );
    lastPowerupTime = millis();
    powerupInterval = max( currentMinPInterval, currentPInterval * POWERUP_INTERVAL_DECREMENT_FACTOR );
  }

  if ( millis() - lastEnemySpawnTime > enemySpawnInterval && !boss && !bossApproaching ) {
    let eTypeRand = random(); let type;
    if (eTypeRand < 0.6) type = "DRONE";
    else if (eTypeRand < 0.85) type = "INTERCEPTOR";
    else type = "TURRET";
    let eY = type === "TURRET" ? (random() < 0.5 ? 30 : SCREEN_HEIGHT - GROUND_Y_OFFSET - 40 - 30) : random(60, height - GROUND_Y_OFFSET - 90);
    enemies.push(new Enemy(width + 30, eY, type));
    lastEnemySpawnTime = millis();
    enemySpawnInterval = max( ENEMY_MIN_INTERVAL, enemySpawnInterval * ENEMY_INTERVAL_DECREMENT_FACTOR );
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    if (player && player.hits(obstacles[i])) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        createExplosion( obstacles[i].x + obstacles[i].w / 2, obstacles[i].y + obstacles[i].h / 2, 10, C_OBSTACLE, 5 * (1000/60), 20 * (1000/60) );
        obstacles.splice(i, 1);
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
        break; 
      }
    }
    if (obstacles[i].offscreen()) obstacles.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return; 

  for (let i = powerups.length - 1; i >= 0; i--) {
    powerups[i].update();
    if (player && powerups[i].hits(player)) {
      activatePowerup(powerups[i].type);
      createExplosion( powerups[i].x + powerups[i].s / 2, powerups[i].y + powerups[i].s / 2, 10, powerups[i].color, 3 * (1000/60), 15 * (1000/60) );
      powerups.splice(i, 1);
    } else if (powerups[i].offscreen()) powerups.splice(i, 1);
  }

  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    let pProj = playerProjectiles[i];
    pProj.update();
    let hitObj = false;
    for (let k = obstacles.length - 1; k >= 0; k--) {
      if (pProj.hits(obstacles[k])) {
        hitObj = true;
        createExplosion( pProj.x + pProj.w / 2, pProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60) );
        break; 
      }
    }
    if (!hitObj) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (!enemies[j].isDestroyed && pProj.hits(enemies[j])) {
          enemies[j].takeDamage(pProj.damage);
          hitObj = true;
          break;
        }
      }
    }
    if (!hitObj && boss && boss.isActive && boss.health > 0) {
      let bH = boss.r ? collideRectCircle(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.r * 2) 
                       : collideRectRect(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.w, boss.h);
      if (bH) {
        boss.takeDamage(pProj.damage);
        hitObj = true;
      }
    }
    if (hitObj || pProj.offscreen()) {
      if (hitObj && !pProj.offscreen()) createExplosion( pProj.x + pProj.w, pProj.y, 3, C_PLAYER_PROJECTILE, 2 * (1000/60), 8 * (1000/60) );
      playerProjectiles.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    if (e.isDestroyed) { enemies.splice(i, 1); continue; }
    e.update();
    if (player && player.hits(e)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        e.takeDamage(100); 
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
        break;
      }
    }
    if (e.offscreen() && !e.isDestroyed) enemies.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return;

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    let eProj = enemyProjectiles[i];
    eProj.update();
    let hitPlayerOrObstacle = false;
    if (player && eProj.hits(player)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        createExplosion(eProj.x, eProj.y, 8, eProj.color, 3 * (1000/60), 12 * (1000/60));
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
      }
      hitPlayerOrObstacle = true;
    } else {
      for (let k = obstacles.length - 1; k >= 0; k--) {
        if (eProj.hitsObstacle(obstacles[k])) {
          hitPlayerOrObstacle = true;
          createExplosion(eProj.x, eProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60));
          break;
        }
      }
    }
    if (hitPlayerOrObstacle || eProj.offscreen()) enemyProjectiles.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].finished()) particles.splice(i, 1);
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    smokeParticles[i].update();
    if (smokeParticles[i].finished()) {
        smokeParticles.splice(i, 1);
        if (random() < 0.3) { 
             smokeParticles.push(new Particle(
                random(SCREEN_WIDTH), SCREEN_HEIGHT - GROUND_Y_OFFSET - random(0, 50), 
                C_SMOKE_EFFECT, random(60, 120), random(8000, 15000),
                createVector(random(-0.05, 0.05) * gameSpeed * 0.1, random(-0.08, -0.18)),
                0.99, 'ellipse'
            ));
        }
    }
  }


  if (boss) {
    if (!boss.isActive) {
      boss.updateEntry();
      if (boss.hasEntered()) boss.isActive = true;
    } else {
      boss.update();
      if (boss.health <= 0) {
        createExplosion( boss.x + (boss.r || boss.w / 2), boss.y + (boss.r || boss.h / 2), 50, boss.color, 10 * (1000/60), 60 * (1000/60) );
        boss = null; bossApproaching = false; pendingBoss = null;
        bossCycle++; 
        timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS; 
        gameSpeed = min(MAX_GAME_SPEED, gameSpeed + 1.5); 
        baseGameSpeed = gameSpeed / (activePowerups[POWERUP_TYPE.SPEED_BURST] > 0 ? 1.5 : 1); 
      }
    }
  } else if (!bossApproaching) {
    timeUntilNextBoss -= deltaTime;
    if (timeUntilNextBoss <= 0) {
        bossApproaching = true;
        let bossType = random();
        if (bossType < 0.4) pendingBoss = new BossTank();
        else if (bossType < 0.8) pendingBoss = new BossShip();
        else pendingBoss = new BossFinal();
    }
  } else if (bossApproaching && !boss && enemies.length === 0 && obstacles.length === 0) {
    boss = pendingBoss;
    bossApproaching = false;
    pendingBoss = null;
  }

  for (const type in activePowerups) {
    activePowerups[type] -= deltaTime;
    if (activePowerups[type] <= 0) {
      delete activePowerups[type];
      if (type === POWERUP_TYPE.WEAPON_SYSTEM && !(activePowerups[POWERUP_TYPE.SPREAD_SHOT] > 0 || activePowerups[POWERUP_TYPE.RAPID_FIRE] > 0) ) {
        weaponSystemActive = false; 
        currentWeaponMode = "STANDARD";
      } else if (type === POWERUP_TYPE.SPREAD_SHOT && !(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0) ) {
         currentWeaponMode = "STANDARD"; 
      } else if (type === POWERUP_TYPE.SCORE_MULTIPLIER) {
        scoreMultiplier = 1; 
      }
    }
  }
}

function activatePowerup(type) {
  console.log("Activating powerup:", type);
  switch (type) {
    case POWERUP_TYPE.COIN:
      coinsCollectedThisRun++; 
      break;
    case POWERUP_TYPE.FUEL_CELL:
      jetpackFuel = MAX_FUEL;
      break;
    case POWERUP_TYPE.SHIELD:
      if(player) player.shieldCharges = min(3, player.shieldCharges + 1);
      break;
    case POWERUP_TYPE.COIN_MAGNET:
      activePowerups[POWERUP_TYPE.COIN_MAGNET] = (activePowerups[POWERUP_TYPE.COIN_MAGNET] || 0) + COIN_MAGNET_DURATION;
      break;
    case POWERUP_TYPE.SPEED_BURST:
      activePowerups[POWERUP_TYPE.SPEED_BURST] = (activePowerups[POWERUP_TYPE.SPEED_BURST] || 0) + SPEED_BURST_DURATION;
      break;
    case POWERUP_TYPE.WEAPON_SYSTEM:
      weaponSystemActive = true;
      if (currentWeaponMode !== "SPREAD" && currentWeaponMode !== "RAPID") currentWeaponMode = "STANDARD";
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0) + WEAPON_SYSTEM_DURATION;
      break;
    case POWERUP_TYPE.SPREAD_SHOT:
      weaponSystemActive = true; 
      currentWeaponMode = "SPREAD";
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0, SPREAD_SHOT_DURATION); 
      activePowerups[POWERUP_TYPE.SPREAD_SHOT] = (activePowerups[POWERUP_TYPE.SPREAD_SHOT] || 0) + SPREAD_SHOT_DURATION; 
      break;
    case POWERUP_TYPE.RAPID_FIRE:
      weaponSystemActive = true; 
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0, RAPID_FIRE_DURATION);
      activePowerups[POWERUP_TYPE.RAPID_FIRE] = (activePowerups[POWERUP_TYPE.RAPID_FIRE] || 0) + RAPID_FIRE_DURATION;
      break;
    case POWERUP_TYPE.SCORE_MULTIPLIER:
      scoreMultiplier *= 2; 
      activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] = (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] || 0) + SCORE_MULTIPLIER_DURATION;
      break;
  }
}

class Particle {
  constructor(x, y, color, size, lifetime, velocity, drag, shape = 'ellipse') {
    this.x = x; this.y = y; this.color = color; this.size = size; this.lifetime = lifetime; 
    this.vel = velocity || createVector(random(-1, 1), random(-1, 1));
    this.acc = createVector(0, 0); this.drag = drag || 1; this.alpha = 255;
    this.startLifetime = lifetime; this.shape = shape;
    this.initialSize = size; 
  }

  applyForce(force) { this.acc.add(force); }

  update() {
    this.vel.add(this.acc); 
    this.vel.mult(this.drag); // Apply drag
    this.x += this.vel.x * (deltaTime / (1000/60)); 
    this.y += this.vel.y * (deltaTime / (1000/60));
    this.acc.mult(0); 

    this.lifetime -= deltaTime;
    this.alpha = map(this.lifetime, 0, this.startLifetime, 0, 255);
    this.size = map(this.lifetime, 0, this.startLifetime, 0, this.initialSize); // Shrink to 0
    if (this.size < 0) this.size = 0; 
  }

  show() {
    noStroke();
    let displayColor = this.color;
    if (Array.isArray(this.color)) displayColor = this.color[floor(random(this.color.length))];
    
    if (displayColor && displayColor.levels) { 
        fill( displayColor.levels[0], displayColor.levels[1], displayColor.levels[2], this.alpha );
        if (this.shape === 'ellipse') ellipse(this.x, this.y, this.size);
        else if (this.shape === 'rect') rect(this.x - this.size/2, this.y - this.size/2, this.size, this.size * random(0.5, 1.5), 1);
    }
  }
  finished() { return this.lifetime < 0; }
}

function createExplosion(x, y, count, baseColor, minLifetimeMs, maxLifetimeMs) { // Lifetimes in ms
  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(1, 6); 
    let vel = createVector(cos(angle) * speed, sin(angle) * speed);
    let particleType = random();
    let pColor = Array.isArray(baseColor) ? baseColor[floor(random(baseColor.length))] : baseColor;
    let lifetime = random(minLifetimeMs, maxLifetimeMs);
    let size = random(3,10); // Explosion particle sizes

    if (particleType < 0.7) { 
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), pColor, size, lifetime, vel, 0.9 ) );
    } else { 
        let shrapnelColor = lerpColor(pColor || color(100), color(80,80,80), random(0.2,0.6)); 
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), shrapnelColor, size * random(0.5, 0.8), lifetime * 0.8, vel.mult(random(1.2, 1.8)), 0.98, 'rect' ) );
    }
  }
}

function drawHUD() {
  fill(C_HUD_BG); noStroke();
  rect(0, 0, width, 50); 

  let fuelBarWidth = map(jetpackFuel, 0, MAX_FUEL, 0, 150);
  fill(C_POWERUP_FUEL); rect(10, 10, fuelBarWidth, 20);
  noFill(); stroke(C_TEXT_MAIN); strokeWeight(2); rect(10, 10, 150, 20);
  noStroke(); fill(C_TEXT_MAIN); textSize(14); textAlign(LEFT, CENTER); text("FUEL", 15, 20);

  fill(C_TEXT_SCORE); textSize(24); textAlign(RIGHT, CENTER); text("SCORE: " + score, width - 20, 25);
  fill(C_TEXT_ACCENT); textSize(18); text("HIGH: " + highScore, width - 20, 40);
  fill(C_TEXT_MAIN); textSize(18); textAlign(LEFT, CENTER); text("PILOT: " + window.playerName, 180, 25);
  let minutes = floor(gameElapsedTime / 60000); let seconds = floor((gameElapsedTime % 60000) / 1000);
  let timerString = nf(minutes, 2) + ':' + nf(seconds, 2);
  fill(C_TEXT_MAIN); textSize(20); textAlign(CENTER, CENTER); text("TIME: " + timerString, width / 2, 25);

  let pX = width / 2 + 80; let pY = 40; let iconSize = 15;

  if(player && player.shieldCharges > 0) {
    fill(C_POWERUP_SHIELD); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("S x" + player.shieldCharges, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25; 
  }
  if (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0) {
    fill(C_POWERUP_WEAPON); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER);
    let wsText = "W";
    if (currentWeaponMode === "SPREAD") wsText = "W(S)";
    if (activePowerups[POWERUP_TYPE.RAPID_FIRE]) wsText += "(R)";
    text(wsText, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] > 0) {
    fill(C_POWERUP_MULTIPLIER); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("x" + scoreMultiplier, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.COIN_MAGNET] > 0) {
    fill(C_POWERUP_MAGNET); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("M", pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.SPEED_BURST] > 0) {
    fill(C_POWERUP_SPEED); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text(">>", pX + iconSize / 2, pY + iconSize / 2 + 1);
  }
}

function drawBackground() {
  background(C_SKY_OVERCAST); 

  let horizonY = SCREEN_HEIGHT * 0.6;
  let fireGlowHeight = SCREEN_HEIGHT * 0.15;
  for (let y = 0; y < fireGlowHeight; y++) {
    let inter = map(y, 0, fireGlowHeight, 0, 1);
    let c = lerpColor(C_FIRE_GLOW_STRONG, C_SKY_HORIZON, inter);
    fill(c);
    rect(0, horizonY + y, SCREEN_WIDTH, 1);
  }
  fill(C_SKY_HORIZON);
  rect(0, horizonY + fireGlowHeight, SCREEN_WIDTH, SCREEN_HEIGHT * 0.4 - GROUND_Y_OFFSET - fireGlowHeight);


  fill(C_GROUND_DETAIL); 
  rect(0, SCREEN_HEIGHT - GROUND_Y_OFFSET, SCREEN_WIDTH, GROUND_Y_OFFSET);
  fill(C_GROUND_DETAIL.levels[0] + 10, C_GROUND_DETAIL.levels[1] + 10, C_GROUND_DETAIL.levels[2] + 10);
  for(let i = 0; i < SCREEN_WIDTH; i += 20) { 
    rect(i + (frameCount * gameSpeed * 0.5 * (deltaTime / (1000/60))) % 20, SCREEN_HEIGHT - GROUND_Y_OFFSET + 5, 8, 3);
  }

  // Draw background elements - they are already sorted by speedFactor in resetGameValues
  for (let bgEl of backgroundElements) { 
      bgEl.update(); 
      bgEl.show(); 
  }
  
  for (let sp of smokeParticles) { sp.show(); }

  fill(C_SMOKE_EFFECT.levels[0], C_SMOKE_EFFECT.levels[1], C_SMOKE_EFFECT.levels[2], 25 + sin(frameCount * 0.01 + bgOffset1*0.1) * 10); // Even more subtle general haze
  rect(0, SCREEN_HEIGHT * 0.15, SCREEN_WIDTH, SCREEN_HEIGHT * 0.55); // Adjusted height for haze
  bgOffset1 += gameSpeed * 0.02 * (deltaTime / (1000/60));
  if (bgOffset1 > TWO_PI) bgOffset1 -= TWO_PI;
}


window.draw = function() {
  drawBackground(); 

  if (window.currentScreen === "START") {
    drawStartScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(true);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  } else if (window.currentScreen === "GAME") {
    updateGameLogic(); 
    if(player) player.show();
    for (let o of obstacles) o.show();
    for (let e of enemies) e.show();
    for (let pp of playerProjectiles) pp.show();
    for (let ep of enemyProjectiles) ep.show();
    for (let pu of powerups) pu.show();
    for (let p of particles) p.show(); 
    if (boss) boss.show();
    drawHUD(); 
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(true);
  } else if (window.currentScreen === "GAME_OVER") {
    drawGameOverScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(true);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);

    if (!scoreboardDisplayedAfterGameOver) {
      if(typeof window.saveHighScore === 'function') window.saveHighScore(score);
      scoreboardDisplayedAfterGameOver = true; 
    }
  } else if (window.currentScreen === "SCOREBOARD") {
    // Scoreboard display is handled by HTML/CSS, p5 just needs to trigger population
    // if(typeof window.displayHighScores === 'function') window.displayHighScores(); // This is called when scoreboard is shown
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  }
}

function drawStartScreen() {
  fill(C_TEXT_MAIN); textAlign(CENTER, CENTER);
  textSize(48); text("FLAPPY ADOLF", width / 2, height / 2 - 120); 
  textSize(20); text("Based on true events when Fuhrer had to poop.", width / 2, height / 2 - 70);

  textSize(18); fill(C_TEXT_ACCENT);
  text("PILOT: " + window.playerName, width / 2, height / 2 + 20);

  fill(C_TEXT_MAIN); textSize(16);
  text("Use [SPACE] or JUMP button for ass thrust", width / 2, height / 2 + 70);
  text("Use [LEFT MOUSE] or SHOOT button to fire", width / 2, height / 2 + 95);
  text("Survive the nasty enemies of the Reich. Get to poop.", width / 2, height / 2 + 120);
}

function drawGameOverScreen() {
  fill(C_BLOOD_RED); textAlign(CENTER, CENTER);
  textSize(64); text("MISSION FAILED", width / 2, height / 2 - 100);
  fill(C_TEXT_MAIN); textSize(36);
  text("SCORE: " + score, width / 2, height / 2 - 30);
  text("HIGH SCORE: " + highScore, width / 2, height / 2 + 20);
}

window.keyPressed = function() {
  if (key === " " && window.currentScreen === "GAME") {
    playerIsFlying = true;
    if(typeof window.triggerJumpSound === 'function') window.triggerJumpSound();
  } else if (key === " " && window.currentScreen === "START") {
    const startButton = document.getElementById('startButton');
    if(startButton) startButton.click();
  } else if (key === " " && window.currentScreen === "GAME_OVER") {
     const retryButton = document.getElementById('retryButton');
    if(retryButton) retryButton.click();
  }
}

window.keyReleased = function() {
  if (key === " " && window.currentScreen === "GAME") {
    playerIsFlying = false;
  }
}

window.mousePressed = function() {
  if (window.currentScreen === "GAME" && mouseButton === LEFT && 
      mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    if(typeof window.triggerPlayerShoot === 'function') window.triggerPlayerShoot();
  }
}
