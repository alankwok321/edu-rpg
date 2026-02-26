// ========== GAME ENGINE ==========
const Game = {
  canvas: null,
  ctx: null,
  tileSize: 40,
  mapWidth: 20,
  mapHeight: 15,
  map: [],
  camera: { x: 0, y: 0 },
  inCombat: false,
  keys: {},
  moveTimer: 0,
  moveDelay: 150, // ms between moves
  lastMove: 0,
  encounterCooldown: 0,
  particles: [],
  frameCount: 0,
  bossSpawned: {},  // track boss tile per zone
  npcPositions: [],
  stepsSinceEncounter: 0,

  async init() {
    // Check auth via JWT
    if (!Auth.isLoggedIn()) { window.location.href = '/'; return; }
    try {
      const res = await Auth.fetch('/api/me');
      const data = await res.json();
      if (!data.userId) { Auth.clearToken(); window.location.href = '/'; return; }
    } catch (e) { window.location.href = '/'; return; }

    // Load player data
    const loaded = await Player.load();
    if (!loaded) { window.location.href = '/'; return; }

    // Setup canvas
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Generate initial map
    this.generateMap(Player.current_zone);

    // Init UI
    UI.init();

    // Input handlers
    this.setupInput();

    // Hide loading, show game
    setTimeout(() => {
      document.getElementById('loadingScreen').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameWrapper').classList.remove('hidden');
      }, 500);
    }, 1500);

    // Start game loop
    this.loop();

    // Auto-save every 30 seconds
    setInterval(() => Player.save(), 30000);
  },

  resize() {
    const wrapper = document.getElementById('gameWrapper');
    const hud = document.getElementById('hud');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - (hud ? hud.offsetHeight : 60);
  },

  // ========== MAP GENERATION ==========
  generateMap(zoneId) {
    const zone = Zones[zoneId];
    this.map = [];
    this.npcPositions = [];

    // Generate tile map
    // 0 = grass/floor, 1 = wall/tree, 2 = path, 3 = water, 4 = boss portal, 5 = NPC
    for (let y = 0; y < this.mapHeight; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        // Border walls
        if (x === 0 || y === 0 || x === this.mapWidth - 1 || y === this.mapHeight - 1) {
          this.map[y][x] = 1;
          continue;
        }

        const r = Math.random();
        if (r < 0.15) {
          this.map[y][x] = 1; // tree/wall
        } else if (r < 0.25) {
          this.map[y][x] = 2; // path
        } else if (r < 0.28) {
          this.map[y][x] = 3; // water/lava
        } else {
          this.map[y][x] = 0; // grass/floor
        }
      }
    }

    // Ensure player start is walkable
    this.map[Player.pos_y][Player.pos_x] = 2;
    // Clear around player
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = Player.pos_y + dy;
        const nx = Player.pos_x + dx;
        if (ny > 0 && ny < this.mapHeight - 1 && nx > 0 && nx < this.mapWidth - 1) {
          if (this.map[ny][nx] === 1 || this.map[ny][nx] === 3) this.map[ny][nx] = 0;
        }
      }
    }

    // Create paths from player towards center and edges
    this._carve_path(Player.pos_x, Player.pos_y, Math.floor(this.mapWidth / 2), Math.floor(this.mapHeight / 2));
    this._carve_path(Math.floor(this.mapWidth / 2), Math.floor(this.mapHeight / 2), this.mapWidth - 3, this.mapHeight - 3);

    // Place boss portal
    const bx = this.mapWidth - 3;
    const by = this.mapHeight - 3;
    this.map[by][bx] = 4;
    // Ensure accessible
    if (this.map[by][bx - 1] === 1) this.map[by][bx - 1] = 0;
    if (this.map[by - 1][bx] === 1) this.map[by - 1][bx] = 0;

    // Place a rest NPC
    const nx = 3, ny = 3;
    if (this.map[ny] && this.map[ny][nx] !== undefined) {
      this.map[ny][nx] = 5;
      this.npcPositions.push({ x: nx, y: ny, type: 'healer' });
    }
  },

  _carve_path(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    while (cx !== x2 || cy !== y2) {
      if (cx > 0 && cx < this.mapWidth - 1 && cy > 0 && cy < this.mapHeight - 1) {
        if (this.map[cy][cx] !== 4 && this.map[cy][cx] !== 5) {
          this.map[cy][cx] = 2;
        }
      }
      if (Math.random() < 0.5) {
        cx += cx < x2 ? 1 : cx > x2 ? -1 : 0;
      } else {
        cy += cy < y2 ? 1 : cy > y2 ? -1 : 0;
      }
    }
  },

  // ========== INPUT ==========
  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      // Prevent scroll
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });

    // Mobile d-pad
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.dir;
      const onStart = (e) => {
        e.preventDefault();
        this.keys[`_mobile_${dir}`] = true;
      };
      const onEnd = (e) => {
        e.preventDefault();
        this.keys[`_mobile_${dir}`] = false;
      };
      btn.addEventListener('touchstart', onStart, { passive: false });
      btn.addEventListener('touchend', onEnd, { passive: false });
      btn.addEventListener('mousedown', onStart);
      btn.addEventListener('mouseup', onEnd);
      btn.addEventListener('mouseleave', onEnd);
    });
  },

  // ========== GAME LOOP ==========
  loop() {
    const now = performance.now();
    this.frameCount++;

    if (!this.inCombat) {
      this.handleMovement(now);
    }

    this.updateParticles();
    this.render();
    requestAnimationFrame(() => this.loop());
  },

  handleMovement(now) {
    if (now - this.lastMove < this.moveDelay) return;

    let dx = 0, dy = 0;
    if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.keys['_mobile_up']) dy = -1;
    else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.keys['_mobile_down']) dy = 1;
    else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] || this.keys['_mobile_left']) dx = -1;
    else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this.keys['_mobile_right']) dx = 1;

    if (dx === 0 && dy === 0) return;

    const nx = Player.pos_x + dx;
    const ny = Player.pos_y + dy;

    // Bounds check
    if (ny < 0 || ny >= this.mapHeight || nx < 0 || nx >= this.mapWidth) return;

    const tile = this.map[ny][nx];
    // Can't walk on walls or water
    if (tile === 1 || tile === 3) return;

    Player.pos_x = nx;
    Player.pos_y = ny;
    this.lastMove = now;

    // Step particles
    this.addStepParticle(nx, ny);

    // Boss portal
    if (tile === 4) {
      this.triggerBoss();
      return;
    }

    // NPC interaction
    if (tile === 5) {
      this.interactNPC(nx, ny);
      return;
    }

    // Random encounter
    this.stepsSinceEncounter++;
    if (this.stepsSinceEncounter > 3) { // Minimum 3 steps between encounters
      const zone = Zones[Player.current_zone];
      if (Math.random() < zone.encounterRate) {
        this.triggerEncounter();
      }
    }
  },

  triggerEncounter() {
    if (this.inCombat) return;
    this.inCombat = true;
    this.stepsSinceEncounter = 0;

    const zone = Zones[Player.current_zone];
    const monster = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];

    // Flash effect
    this.flashScreen();

    setTimeout(() => {
      Combat.start(monster);
    }, 300);
  },

  triggerBoss() {
    if (this.inCombat) return;
    const zone = Zones[Player.current_zone];

    if (Player.bosses_defeated.includes(Player.current_zone)) {
      UI.toast('The boss has already been defeated here. The portal is quiet.', 'info');
      return;
    }

    this.inCombat = true;
    UI.toast(`⚠️ Boss battle: ${zone.boss.name}!`, 'warning');

    this.flashScreen('#ff000044');

    setTimeout(() => {
      Combat.start(zone.boss);
    }, 500);
  },

  interactNPC(x, y) {
    const npc = this.npcPositions.find(n => n.x === x && n.y === y);
    if (!npc) return;

    if (npc.type === 'healer') {
      if (Player.hp < Player.max_hp) {
        const heal = Math.floor(Player.max_hp * 0.5);
        Player.hp = Math.min(Player.max_hp, Player.hp + heal);
        Player.save();
        UI.updateHUD();
        UI.toast(`💚 The healer restores ${heal} HP!`, 'success');
      } else {
        UI.toast('💚 "You look healthy, adventurer. Be safe!"', 'info');
      }
    }
    // Move player back so they don't stand on NPC
    Player.pos_x = Player.pos_x;
  },

  changeZone(zoneId) {
    Player.current_zone = zoneId;
    Player.pos_x = 5;
    Player.pos_y = 5;
    this.stepsSinceEncounter = 0;
    this.generateMap(zoneId);
    UI.updateHUD();
    Player.save();
  },

  flashScreen(color = '#ffffff33') {
    this._flashColor = color;
    this._flashTime = 10;
  },

  // ========== PARTICLES ==========
  addStepParticle(x, y) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x * this.tileSize + this.tileSize / 2 + (Math.random() - 0.5) * 10,
        y: y * this.tileSize + this.tileSize / 2 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 20,
        maxLife: 20,
        color: '#ffffff'
      });
    }
  },

  updateParticles() {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      return p.life > 0;
    });
  },

  // ========== RENDERING ==========
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ts = this.tileSize;

    // Camera centering
    this.camera.x = Player.pos_x * ts - w / 2 + ts / 2;
    this.camera.y = Player.pos_y * ts - h / 2 + ts / 2;

    // Clamp camera
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.mapWidth * ts - w));
    this.camera.y = Math.max(0, Math.min(this.camera.y, this.mapHeight * ts - h));

    const zone = Zones[Player.current_zone];
    const tc = zone.tileColors;

    // Clear
    ctx.fillStyle = zone.bg;
    ctx.fillRect(0, 0, w, h);

    // Calculate visible tile range
    const startX = Math.max(0, Math.floor(this.camera.x / ts));
    const startY = Math.max(0, Math.floor(this.camera.y / ts));
    const endX = Math.min(this.mapWidth, Math.ceil((this.camera.x + w) / ts) + 1);
    const endY = Math.min(this.mapHeight, Math.ceil((this.camera.y + h) / ts) + 1);

    // Draw tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const sx = x * ts - this.camera.x;
        const sy = y * ts - this.camera.y;
        const tile = this.map[y] ? this.map[y][x] : 0;

        switch (tile) {
          case 0: // Grass/floor
            ctx.fillStyle = tc.grass[(x + y) % tc.grass.length];
            ctx.fillRect(sx, sy, ts, ts);
            // Random grass detail
            if ((x * 7 + y * 13) % 5 === 0) {
              ctx.fillStyle = tc.grass[0] + '88';
              ctx.fillRect(sx + ts * 0.3, sy + ts * 0.2, 2, 6);
              ctx.fillRect(sx + ts * 0.6, sy + ts * 0.5, 2, 5);
            }
            break;

          case 1: // Tree/wall
            ctx.fillStyle = tc.grass[0];
            ctx.fillRect(sx, sy, ts, ts);
            // Draw tree or rock
            ctx.fillStyle = tc.tree[0];
            if (Player.current_zone === 'cave' || Player.current_zone === 'space') {
              // Rock
              ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
              ctx.fillStyle = tc.tree[1] || tc.tree[0];
              ctx.fillRect(sx + 8, sy + 6, ts - 16, ts - 16);
            } else {
              // Tree trunk
              ctx.fillStyle = '#5c3a1e';
              ctx.fillRect(sx + ts * 0.35, sy + ts * 0.5, ts * 0.3, ts * 0.5);
              // Canopy
              ctx.fillStyle = tc.tree[0];
              ctx.beginPath();
              ctx.arc(sx + ts / 2, sy + ts * 0.35, ts * 0.4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = tc.tree[1] || tc.tree[0];
              ctx.beginPath();
              ctx.arc(sx + ts / 2 - 3, sy + ts * 0.3, ts * 0.25, 0, Math.PI * 2);
              ctx.fill();
            }
            break;

          case 2: // Path
            ctx.fillStyle = tc.path[(x + y) % tc.path.length];
            ctx.fillRect(sx, sy, ts, ts);
            // Path detail
            ctx.fillStyle = tc.path[0] + '44';
            if ((x + y) % 3 === 0) {
              ctx.fillRect(sx + 5, sy + 12, 3, 3);
              ctx.fillRect(sx + 18, sy + 25, 4, 3);
            }
            break;

          case 3: // Water/lava
            const waterAnim = Math.sin(this.frameCount * 0.05 + x + y) * 0.5 + 0.5;
            ctx.fillStyle = tc.water[Math.floor(waterAnim * tc.water.length) % tc.water.length];
            ctx.fillRect(sx, sy, ts, ts);
            // Shimmer
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            const shimX = (Math.sin(this.frameCount * 0.03 + x * 2) + 1) * ts * 0.3;
            ctx.fillRect(sx + shimX, sy + ts * 0.3, ts * 0.15, 2);
            break;

          case 4: // Boss portal
            ctx.fillStyle = tc.grass[(x + y) % tc.grass.length];
            ctx.fillRect(sx, sy, ts, ts);
            // Portal animation
            const pulse = Math.sin(this.frameCount * 0.05) * 0.3 + 0.7;
            ctx.fillStyle = zone.tileColors.special;
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Skull icon
            ctx.fillStyle = '#fff';
            ctx.font = `${ts * 0.5}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const bossDefeated = Player.bosses_defeated.includes(Player.current_zone);
            ctx.fillText(bossDefeated ? '✨' : '💀', sx + ts / 2, sy + ts / 2);
            break;

          case 5: // NPC
            ctx.fillStyle = tc.grass[(x + y) % tc.grass.length];
            ctx.fillRect(sx, sy, ts, ts);
            // NPC sprite
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(sx + ts * 0.25, sy + ts * 0.1, ts * 0.5, ts * 0.5);
            // NPC head
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(sx + ts / 2, sy + ts * 0.2, ts * 0.18, 0, Math.PI * 2);
            ctx.fill();
            // Cross (healer)
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx + ts * 0.42, sy + ts * 0.3, ts * 0.16, ts * 0.35);
            ctx.fillRect(sx + ts * 0.32, sy + ts * 0.42, ts * 0.36, ts * 0.12);
            break;
        }

        // Grid lines (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(sx, sy, ts, ts);
      }
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - this.camera.x - 1, p.y - this.camera.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Draw player
    this._drawPlayer();

    // Flash effect
    if (this._flashTime > 0) {
      ctx.fillStyle = this._flashColor || '#ffffff33';
      ctx.globalAlpha = this._flashTime / 10;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      this._flashTime--;
    }

    // Minimap
    this._drawMinimap();
  },

  _drawPlayer() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = Player.pos_x * ts - this.camera.x;
    const py = Player.pos_y * ts - this.camera.y;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px + ts / 2, py + ts - 3, ts * 0.35, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(px + ts * 0.25, py + ts * 0.35, ts * 0.5, ts * 0.4);

    // Head
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + ts * 0.3, py + ts * 0.1, ts * 0.4, ts * 0.3);

    // Helmet
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(px + ts * 0.25, py + ts * 0.05, ts * 0.5, ts * 0.15);

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + ts * 0.35, py + ts * 0.22, ts * 0.1, ts * 0.08);
    ctx.fillRect(px + ts * 0.55, py + ts * 0.22, ts * 0.1, ts * 0.08);

    // Sword
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + ts * 0.78, py + ts * 0.2, ts * 0.08, ts * 0.4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + ts * 0.72, py + ts * 0.55, ts * 0.2, ts * 0.08);

    // Legs
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(px + ts * 0.28, py + ts * 0.72, ts * 0.18, ts * 0.2);
    ctx.fillRect(px + ts * 0.54, py + ts * 0.72, ts * 0.18, ts * 0.2);

    // Bob animation
    const bob = Math.sin(this.frameCount * 0.1) * 1;
    // Translate was too complex, the static look is fine with pixel art style
  },

  _drawMinimap() {
    const ctx = this.ctx;
    const mmSize = 3; // pixel per tile
    const mmW = this.mapWidth * mmSize;
    const mmH = this.mapHeight * mmSize;
    const mmX = this.canvas.width - mmW - 10;
    const mmY = 10;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);

    const zone = Zones[Player.current_zone];

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.map[y][x];
        switch (tile) {
          case 0: ctx.fillStyle = zone.tileColors.grass[0]; break;
          case 1: ctx.fillStyle = '#333'; break;
          case 2: ctx.fillStyle = zone.tileColors.path[0]; break;
          case 3: ctx.fillStyle = zone.tileColors.water[0]; break;
          case 4: ctx.fillStyle = zone.tileColors.special; break;
          case 5: ctx.fillStyle = '#4ade80'; break;
        }
        ctx.fillRect(mmX + x * mmSize, mmY + y * mmSize, mmSize, mmSize);
      }
    }

    // Player dot
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(mmX + Player.pos_x * mmSize - 1, mmY + Player.pos_y * mmSize - 1, mmSize + 2, mmSize + 2);
  },
};

// ========== BOOT ==========
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
