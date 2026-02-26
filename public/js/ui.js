// ========== UI RENDERING & ANIMATIONS ==========
const UI = {
  init() {
    this.cacheElements();
    this.bindEvents();
    this.updateHUD();
  },

  cacheElements() {
    this.els = {
      hudName: document.getElementById('hudName'),
      hudLevel: document.getElementById('hudLevel'),
      hudHpBar: document.getElementById('hudHpBar'),
      hudHpText: document.getElementById('hudHpText'),
      hudExpBar: document.getElementById('hudExpBar'),
      hudExpText: document.getElementById('hudExpText'),
      hudZone: document.getElementById('hudZone'),
      hudAtk: document.getElementById('hudAtk'),
      hudDef: document.getElementById('hudDef'),
      hudGold: document.getElementById('hudGold'),
      hudPotions: document.getElementById('hudPotions'),
      combatOverlay: document.getElementById('combatOverlay'),
      monsterName: document.getElementById('monsterName'),
      monsterHpBar: document.getElementById('monsterHpBar'),
      monsterHpText: document.getElementById('monsterHpText'),
      monsterSprite: document.getElementById('monsterSprite'),
      questionCategory: document.getElementById('questionCategory'),
      questionText: document.getElementById('questionText'),
      questionOptions: document.getElementById('questionOptions'),
      combatFeedback: document.getElementById('combatFeedback'),
      combatPotions: document.getElementById('combatPotions'),
      damagePopup: document.getElementById('damagePopup'),
      levelUpOverlay: document.getElementById('levelUpOverlay'),
      levelUpLevel: document.getElementById('levelUpLevel'),
      levelUpStats: document.getElementById('levelUpStats'),
      deathOverlay: document.getElementById('deathOverlay'),
      zoneMapModal: document.getElementById('zoneMapModal'),
      zoneGrid: document.getElementById('zoneGrid'),
      achievementsModal: document.getElementById('achievementsModal'),
      achievementsList: document.getElementById('achievementsList'),
      toastContainer: document.getElementById('toastContainer'),
    };
  },

  bindEvents() {
    document.getElementById('btnMap').addEventListener('click', () => this.showZoneMap());
    document.getElementById('closeZoneMap').addEventListener('click', () => this.els.zoneMapModal.classList.add('hidden'));
    document.getElementById('btnAchievements').addEventListener('click', () => this.showAchievements());
    document.getElementById('closeAchievements').addEventListener('click', () => this.els.achievementsModal.classList.add('hidden'));
    document.getElementById('btnLogout').addEventListener('click', async () => {
      await Player.forceSave();
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    });
    document.getElementById('btnInventory').addEventListener('click', () => {
      this.toast(`🎒 HP: ${Player.hp}/${Player.max_hp} | ATK: ${Player.atk} | DEF: ${Player.def} | Gold: ${Player.gold} | Potions: ${Player.potions}`, 'info');
    });
    document.getElementById('levelUpContinue').addEventListener('click', () => {
      this.els.levelUpOverlay.classList.add('hidden');
    });
    document.getElementById('deathRevive').addEventListener('click', () => {
      Player.die();
      this.els.deathOverlay.classList.add('hidden');
      this.updateHUD();
      if (typeof Game !== 'undefined') {
        Game.changeZone('forest');
      }
    });
  },

  updateHUD() {
    this.els.hudName.textContent = Player.username;
    this.els.hudLevel.textContent = Player.level;
    const hpPct = (Player.hp / Player.max_hp) * 100;
    this.els.hudHpBar.style.width = hpPct + '%';
    this.els.hudHpText.textContent = `${Player.hp}/${Player.max_hp}`;
    const expPct = (Player.exp / Player.exp_to_next) * 100;
    this.els.hudExpBar.style.width = expPct + '%';
    this.els.hudExpText.textContent = `${Player.exp}/${Player.exp_to_next}`;
    const zone = Zones[Player.current_zone];
    this.els.hudZone.textContent = zone ? zone.name : Player.current_zone;
    this.els.hudAtk.textContent = Player.atk;
    this.els.hudDef.textContent = Player.def;
    this.els.hudGold.textContent = Player.gold;
    this.els.hudPotions.textContent = Player.potions;
  },

  // Show combat
  showCombat(monster, monsterHp, monsterMaxHp) {
    this.els.combatOverlay.classList.remove('hidden');
    this.els.monsterName.textContent = monster.name;
    this.updateMonsterHp(monsterHp, monsterMaxHp);
    this.els.combatPotions.textContent = Player.potions;
    this.drawMonsterSprite(monster);
    this.drawPlayerSprite();
    this.els.combatFeedback.classList.add('hidden');
  },

  hideCombat() {
    this.els.combatOverlay.classList.add('hidden');
  },

  updateMonsterHp(current, max) {
    const pct = Math.max(0, (current / max) * 100);
    this.els.monsterHpBar.style.width = pct + '%';
    this.els.monsterHpText.textContent = `${Math.max(0,current)}/${max}`;
  },

  showQuestion(q, onAnswer) {
    this.els.questionCategory.textContent = `${q.category.toUpperCase()} • ${q.difficulty}`;
    this.els.questionText.textContent = q.question;
    this.els.combatFeedback.classList.add('hidden');
    this.els.questionOptions.innerHTML = '';

    const labels = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = `${labels[i]}. ${opt}`;
      btn.addEventListener('click', () => {
        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        onAnswer(i, btn);
      });
      this.els.questionOptions.appendChild(btn);
    });
  },

  showAnswerResult(correct, correctIdx, clickedBtn) {
    const buttons = document.querySelectorAll('.option-btn');
    if (correct) {
      clickedBtn.classList.add('correct');
    } else {
      clickedBtn.classList.add('wrong');
      buttons[correctIdx].classList.add('correct');
    }

    const fb = this.els.combatFeedback;
    fb.classList.remove('hidden', 'correct-fb', 'wrong-fb');
    if (correct) {
      fb.classList.add('correct-fb');
      fb.textContent = '✅ Correct! You strike the enemy!';
    } else {
      fb.classList.add('wrong-fb');
      fb.textContent = '❌ Wrong! The enemy attacks you!';
    }
  },

  showDamagePopup(amount, isPlayerDamage) {
    const popup = this.els.damagePopup;
    popup.className = 'damage-popup ' + (isPlayerDamage ? 'player-dmg' : 'monster-dmg');
    popup.textContent = (isPlayerDamage ? '-' : '-') + amount;
    popup.classList.remove('hidden');
    // Reset animation
    popup.style.animation = 'none';
    popup.offsetHeight; // trigger reflow
    popup.style.animation = '';
    setTimeout(() => popup.classList.add('hidden'), 1000);
  },

  showLevelUp(level, stats) {
    this.els.levelUpLevel.textContent = `Level ${level}`;
    this.els.levelUpStats.innerHTML = `
      ❤️ HP +${stats.hp}<br>
      ⚔️ ATK +${stats.atk}<br>
      🛡️ DEF +${stats.def}
    `;
    this.els.levelUpOverlay.classList.remove('hidden');
  },

  showDeath() {
    this.els.deathOverlay.classList.remove('hidden');
  },

  // Zone map
  showZoneMap() {
    const grid = this.els.zoneGrid;
    grid.innerHTML = '';
    for (const [id, zone] of Object.entries(Zones)) {
      const card = document.createElement('div');
      const unlocked = Player.zones_unlocked.includes(id);
      const active = Player.current_zone === id;
      card.className = `zone-card ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}`;
      card.innerHTML = `
        <div class="zone-icon">${zone.icon}</div>
        <div class="zone-title">${zone.name}</div>
        <div class="zone-desc">Difficulty: ${zone.difficulty}</div>
        ${!unlocked ? `<div class="zone-req">Requires Lv. ${zone.reqLevel}</div>` : ''}
      `;
      if (unlocked && !active) {
        card.addEventListener('click', () => {
          Player.current_zone = id;
          Player.pos_x = 5;
          Player.pos_y = 5;
          Player.save();
          this.updateHUD();
          this.els.zoneMapModal.classList.add('hidden');
          if (typeof Game !== 'undefined') Game.changeZone(id);
          this.toast(`Traveled to ${zone.name}`, 'info');
        });
      }
      grid.appendChild(card);
    }
    this.els.zoneMapModal.classList.remove('hidden');
  },

  // Achievements
  showAchievements() {
    const list = this.els.achievementsList;
    list.innerHTML = '';
    for (const ach of Achievements.definitions) {
      const unlocked = Player.achievements.includes(ach.id);
      const item = document.createElement('div');
      item.className = `achievement-item ${unlocked ? 'unlocked' : ''}`;
      item.innerHTML = `
        <div class="ach-icon">${unlocked ? ach.icon : '🔒'}</div>
        <div class="ach-info">
          <div class="ach-name">${unlocked ? ach.name : '???'}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
      `;
      list.appendChild(item);
    }
    this.els.achievementsModal.classList.remove('hidden');
  },

  // Toast notification
  toast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.els.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  // ========== SPRITE DRAWING ==========
  drawMonsterSprite(monster) {
    const container = this.els.monsterSprite;
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    this._drawMonster(ctx, monster, 60, 60, monster.isBoss ? 55 : 45);
  },

  drawPlayerSprite() {
    const container = document.getElementById('combatPlayerSprite');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // Draw a pixel-art knight
    ctx.fillStyle = '#3b82f6';
    // Body
    ctx.fillRect(22, 24, 20, 24);
    // Head
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(24, 10, 16, 14);
    // Helmet
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(22, 8, 20, 8);
    ctx.fillRect(26, 6, 12, 4);
    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(28, 16, 3, 3);
    ctx.fillRect(34, 16, 3, 3);
    // Sword
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(44, 18, 4, 20);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(42, 36, 8, 4);
    // Shield
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(10, 26, 12, 16);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(14, 30, 4, 8);
    // Legs
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(24, 48, 8, 10);
    ctx.fillRect(34, 48, 8, 10);
    // Boots
    ctx.fillStyle = '#78350f';
    ctx.fillRect(22, 56, 10, 4);
    ctx.fillRect(32, 56, 10, 4);
  },

  _drawMonster(ctx, monster, cx, cy, size) {
    const c = monster.color;
    ctx.save();

    switch(monster.shape) {
      case 'slime':
        // Blob shape
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10, size, size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 15, cy - 2, 10, 10);
        ctx.fillRect(cx + 5, cy - 2, 10, 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 12, cy + 2, 5, 5);
        ctx.fillRect(cx + 8, cy + 2, 5, 5);
        break;

      case 'mushroom':
        // Stem
        ctx.fillStyle = '#f5f0e0';
        ctx.fillRect(cx - 8, cy, 16, 25);
        // Cap
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(cx, cy, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Spots
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - 12, cy - 5, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 10, cy - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 2, cy - 15, 3, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 10, cy + 5, 4, 4);
        ctx.fillRect(cx + 6, cy + 5, 4, 4);
        break;

      case 'wolf':
        // Body
        ctx.fillStyle = c;
        ctx.fillRect(cx - 25, cy - 5, 50, 25);
        // Head
        ctx.fillRect(cx + 15, cy - 20, 22, 22);
        // Ears
        ctx.fillRect(cx + 17, cy - 28, 6, 10);
        ctx.fillRect(cx + 29, cy - 28, 6, 10);
        // Legs
        ctx.fillRect(cx - 22, cy + 20, 8, 15);
        ctx.fillRect(cx - 8, cy + 20, 8, 15);
        ctx.fillRect(cx + 8, cy + 20, 8, 15);
        ctx.fillRect(cx + 20, cy + 20, 8, 15);
        // Eyes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx + 20, cy - 15, 4, 4);
        ctx.fillRect(cx + 30, cy - 15, 4, 4);
        // Tail
        ctx.fillStyle = c;
        ctx.fillRect(cx - 30, cy - 10, 10, 6);
        break;

      case 'goblin':
        // Body
        ctx.fillStyle = c;
        ctx.fillRect(cx - 15, cy - 5, 30, 30);
        // Head
        ctx.fillRect(cx - 12, cy - 25, 24, 22);
        // Ears
        ctx.fillStyle = c;
        ctx.fillRect(cx - 20, cy - 20, 10, 6);
        ctx.fillRect(cx + 10, cy - 20, 10, 6);
        // Eyes
        ctx.fillStyle = '#ff0';
        ctx.fillRect(cx - 8, cy - 18, 6, 6);
        ctx.fillRect(cx + 3, cy - 18, 6, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 6, cy - 16, 3, 3);
        ctx.fillRect(cx + 5, cy - 16, 3, 3);
        // Weapon
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(cx + 18, cy - 10, 4, 30);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(cx + 15, cy - 15, 10, 6);
        break;

      case 'bat':
        // Body
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 15, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy - 5);
        ctx.lineTo(cx - 45, cy - 20);
        ctx.lineTo(cx - 40, cy + 5);
        ctx.lineTo(cx - 15, cy + 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 15, cy - 5);
        ctx.lineTo(cx + 45, cy - 20);
        ctx.lineTo(cx + 40, cy + 5);
        ctx.lineTo(cx + 15, cy + 5);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#f00';
        ctx.fillRect(cx - 8, cy - 8, 5, 5);
        ctx.fillRect(cx + 3, cy - 8, 5, 5);
        // Fangs
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 4, cy + 5, 3, 6);
        ctx.fillRect(cx + 2, cy + 5, 3, 6);
        break;

      case 'spider':
        // Body
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(cx, cy - 18, 10, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const angle = (i * 0.4 + 0.3);
          ctx.beginPath(); ctx.moveTo(cx - 18, cy - 5 + i * 7); ctx.lineTo(cx - 40, cy - 20 + i * 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 18, cy - 5 + i * 7); ctx.lineTo(cx + 40, cy - 20 + i * 12); ctx.stroke();
        }
        // Eyes (8 eyes!)
        ctx.fillStyle = '#f00';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(cx - 8 + i * 4, cy - 22, 3, 3);
          ctx.fillRect(cx - 6 + i * 4, cy - 17, 2, 2);
        }
        break;

      case 'skeleton':
        // Skull
        ctx.fillStyle = c;
        ctx.fillRect(cx - 12, cy - 30, 24, 22);
        // Eye sockets
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 8, cy - 25, 7, 7);
        ctx.fillRect(cx + 2, cy - 25, 7, 7);
        // Jaw
        ctx.fillStyle = c;
        ctx.fillRect(cx - 8, cy - 10, 16, 6);
        // Teeth
        ctx.fillStyle = '#000';
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - 6 + i * 4, cy - 10, 2, 3);
        // Ribcage
        ctx.fillStyle = c;
        ctx.fillRect(cx - 2, cy - 4, 4, 30);
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(cx - 14, cy + i * 6, 28, 2);
        }
        // Arms
        ctx.fillRect(cx - 20, cy, 8, 3);
        ctx.fillRect(cx + 12, cy, 8, 3);
        ctx.fillRect(cx - 22, cy, 3, 18);
        ctx.fillRect(cx + 18, cy, 3, 18);
        // Legs
        ctx.fillRect(cx - 8, cy + 26, 4, 18);
        ctx.fillRect(cx + 4, cy + 26, 4, 18);
        break;

      case 'golem':
        // Body - crystal shape
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 35);
        ctx.lineTo(cx + 25, cy - 10);
        ctx.lineTo(cx + 20, cy + 25);
        ctx.lineTo(cx - 20, cy + 25);
        ctx.lineTo(cx - 25, cy - 10);
        ctx.closePath();
        ctx.fill();
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 30);
        ctx.lineTo(cx + 10, cy - 10);
        ctx.lineTo(cx - 5, cy + 10);
        ctx.lineTo(cx - 15, cy - 10);
        ctx.closePath();
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 10, cy - 10, 6, 6);
        ctx.fillRect(cx + 5, cy - 10, 6, 6);
        break;

      case 'treant':
        // Trunk
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(cx - 18, cy - 10, 36, 50);
        // Crown
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(cx, cy - 25, 30, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - 20, cy - 15, 20, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 20, cy - 15, 20, 0, Math.PI * 2); ctx.fill();
        // Eyes (angry)
        ctx.fillStyle = '#f00';
        ctx.fillRect(cx - 12, cy - 5, 8, 6);
        ctx.fillRect(cx + 4, cy - 5, 8, 6);
        // Mouth
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 8, cy + 8, 16, 4);
        // Arms/branches
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(cx - 40, cy - 5, 24, 6);
        ctx.fillRect(cx + 16, cy - 5, 24, 6);
        break;

      case 'vampire':
        // Cloak
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy - 15);
        ctx.lineTo(cx, cy - 35);
        ctx.lineTo(cx + 30, cy - 15);
        ctx.lineTo(cx + 25, cy + 40);
        ctx.lineTo(cx - 25, cy + 40);
        ctx.closePath();
        ctx.fill();
        // Face
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(cx - 10, cy - 25, 20, 18);
        // Hair
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(cx - 12, cy - 30, 24, 8);
        // Eyes
        ctx.fillStyle = '#f00';
        ctx.fillRect(cx - 7, cy - 20, 5, 4);
        ctx.fillRect(cx + 3, cy - 20, 5, 4);
        // Fangs
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 4, cy - 10, 2, 5);
        ctx.fillRect(cx + 3, cy - 10, 2, 5);
        break;

      case 'imp':
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, cy, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
        // Horns
        ctx.fillRect(cx - 15, cy - 28, 5, 12);
        ctx.fillRect(cx + 10, cy - 28, 5, 12);
        // Wings
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 10); ctx.lineTo(cx - 38, cy - 25); ctx.lineTo(cx - 30, cy + 5); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 18, cy - 10); ctx.lineTo(cx + 38, cy - 25); ctx.lineTo(cx + 30, cy + 5); ctx.closePath();
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#ff0';
        ctx.fillRect(cx - 8, cy - 8, 6, 6);
        ctx.fillRect(cx + 3, cy - 8, 6, 6);
        // Mouth
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 6, cy + 5, 12, 3);
        break;

      case 'worm':
        ctx.fillStyle = c;
        // Segmented body
        for (let i = 0; i < 5; i++) {
          const y = cy - 20 + i * 12;
          const r = 18 - i * 2;
          ctx.beginPath(); ctx.ellipse(cx + Math.sin(i) * 5, y, r, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Mouth
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx, cy - 25, 10, 0, Math.PI * 2); ctx.fill();
        // Teeth
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 8, cy - 30, 4, 6);
        ctx.fillRect(cx + 4, cy - 30, 4, 6);
        ctx.fillRect(cx - 2, cy - 20, 4, 6);
        break;

      case 'elemental':
        // Flame body
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 40);
        ctx.quadraticCurveTo(cx + 30, cy - 20, cx + 20, cy + 10);
        ctx.quadraticCurveTo(cx + 15, cy + 30, cx, cy + 25);
        ctx.quadraticCurveTo(cx - 15, cy + 30, cx - 20, cy + 10);
        ctx.quadraticCurveTo(cx - 30, cy - 20, cx, cy - 40);
        ctx.fill();
        // Inner flame
        ctx.fillStyle = '#fff3';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 25);
        ctx.quadraticCurveTo(cx + 12, cy - 10, cx + 8, cy + 5);
        ctx.quadraticCurveTo(cx, cy + 15, cx - 8, cy + 5);
        ctx.quadraticCurveTo(cx - 12, cy - 10, cx, cy - 25);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 8, cy - 8, 5, 5);
        ctx.fillRect(cx + 4, cy - 8, 5, 5);
        break;

      case 'knight':
        // Armor body
        ctx.fillStyle = c;
        ctx.fillRect(cx - 16, cy - 10, 32, 35);
        // Helmet
        ctx.fillStyle = '#4a0000';
        ctx.fillRect(cx - 14, cy - 30, 28, 22);
        // Visor slit
        ctx.fillStyle = '#f00';
        ctx.fillRect(cx - 8, cy - 22, 16, 4);
        // Horns
        ctx.fillStyle = '#666';
        ctx.fillRect(cx - 18, cy - 32, 5, 15);
        ctx.fillRect(cx + 13, cy - 32, 5, 15);
        // Sword
        ctx.fillStyle = '#ccc';
        ctx.fillRect(cx + 20, cy - 25, 5, 40);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx + 16, cy + 10, 13, 5);
        // Legs
        ctx.fillStyle = c;
        ctx.fillRect(cx - 12, cy + 25, 10, 15);
        ctx.fillRect(cx + 2, cy + 25, 10, 15);
        break;

      case 'dragon':
        // Body
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, cy + 5, 35, 25, 0, 0, Math.PI * 2); ctx.fill();
        // Neck & Head
        ctx.fillRect(cx + 15, cy - 25, 12, 25);
        ctx.fillRect(cx + 10, cy - 40, 22, 18);
        // Jaw
        ctx.fillRect(cx + 28, cy - 35, 15, 8);
        // Eyes
        ctx.fillStyle = '#ff0';
        ctx.fillRect(cx + 18, cy - 38, 6, 5);
        // Teeth
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + 30, cy - 28, 3, 5);
        ctx.fillRect(cx + 36, cy - 28, 3, 5);
        // Wings
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 10); ctx.lineTo(cx - 45, cy - 45); ctx.lineTo(cx - 30, cy - 10); ctx.lineTo(cx - 50, cy - 20); ctx.lineTo(cx - 20, cy + 5);
        ctx.closePath(); ctx.fill();
        // Tail
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy + 10); ctx.lineTo(cx - 50, cy + 25); ctx.lineTo(cx - 45, cy + 15); ctx.lineTo(cx - 30, cy + 20);
        ctx.closePath(); ctx.fill();
        // Legs
        ctx.fillRect(cx - 15, cy + 25, 10, 15);
        ctx.fillRect(cx + 8, cy + 25, 10, 15);
        // Fire breath
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(cx + 43, cy - 33); ctx.lineTo(cx + 55, cy - 40); ctx.lineTo(cx + 55, cy - 25); ctx.closePath(); ctx.fill();
        break;

      case 'probe':
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, cy, 25, 12, 0, 0, Math.PI * 2); ctx.fill();
        // Dome
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.ellipse(cx, cy - 5, 15, 15, 0, Math.PI, 0); ctx.fill();
        // Antenna
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 30); ctx.stroke();
        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.arc(cx, cy - 30, 3, 0, Math.PI * 2); ctx.fill();
        // Lights
        ctx.fillStyle = '#0f0';
        ctx.fillRect(cx - 15, cy + 5, 4, 4);
        ctx.fillRect(cx + 11, cy + 5, 4, 4);
        break;

      case 'jellyfish':
        // Bell
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, cy - 10, 25, 20, 0, 0, Math.PI); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy - 10, 25, 30, 0, Math.PI, 0); ctx.fill();
        // Tentacles
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 8, cy + 10);
          for (let j = 0; j < 4; j++) {
            ctx.lineTo(cx + i * 8 + (j % 2 ? 8 : -8), cy + 15 + j * 8);
          }
          ctx.stroke();
        }
        // Glow
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.ellipse(cx, cy - 15, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        break;

      case 'walker':
        ctx.fillStyle = c;
        // Void body
        ctx.beginPath(); ctx.ellipse(cx, cy - 5, 20, 30, 0, 0, Math.PI * 2); ctx.fill();
        // Cloak wisps
        ctx.fillStyle = 'rgba(99,102,241,0.5)';
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy + 15); ctx.lineTo(cx - 30, cy + 40); ctx.lineTo(cx + 30, cy + 40); ctx.lineTo(cx + 20, cy + 15);
        ctx.closePath(); ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 10, cy - 15, 7, 4);
        ctx.fillRect(cx + 3, cy - 15, 7, 4);
        break;

      case 'darkmatter':
        // Swirling orb
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        // Inner rings
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 25, 15, 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, 20, 25, -0.5, 0, Math.PI * 2); ctx.stroke();
        // Core
        ctx.fillStyle = '#818cf8';
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
        // Particles
        ctx.fillStyle = '#c084fc';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.fillRect(cx + Math.cos(a) * 35 - 2, cy + Math.sin(a) * 35 - 2, 4, 4);
        }
        break;

      case 'overlord':
        // Giant cosmic entity
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, cy, 40, 45, 0, 0, Math.PI * 2); ctx.fill();
        // Crown
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(cx - 25, cy - 40);
        ctx.lineTo(cx - 20, cy - 55); ctx.lineTo(cx - 10, cy - 42);
        ctx.lineTo(cx, cy - 58); ctx.lineTo(cx + 10, cy - 42);
        ctx.lineTo(cx + 20, cy - 55); ctx.lineTo(cx + 25, cy - 40);
        ctx.closePath(); ctx.fill();
        // Face
        ctx.fillStyle = '#818cf8';
        // Multiple eyes
        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.arc(cx - 15, cy - 15, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 15, cy - 15, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy - 5, 8, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx - 15, cy - 15, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 15, cy - 15, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy - 5, 4, 0, Math.PI * 2); ctx.fill();
        // Tentacles
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 5;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 10, cy + 30);
          ctx.quadraticCurveTo(cx + i * 15, cy + 55, cx + i * 8, cy + 50);
          ctx.stroke();
        }
        break;

      default:
        // Generic circle monster
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 10, cy - 8, 8, 8);
        ctx.fillRect(cx + 2, cy - 8, 8, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 8, cy - 5, 4, 4);
        ctx.fillRect(cx + 4, cy - 5, 4, 4);
    }
    ctx.restore();
  }
};
