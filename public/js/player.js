// ========== PLAYER STATE & PROGRESSION ==========
const Player = {
  username: 'Hero',
  hp: 100,
  max_hp: 100,
  atk: 10,
  def: 5,
  level: 1,
  exp: 0,
  exp_to_next: 100,
  gold: 0,
  current_zone: 'forest',
  potions: 3,
  pos_x: 5,
  pos_y: 5,
  zones_unlocked: ['forest'],
  total_kills: 0,
  total_correct: 0,
  total_questions: 0,
  bosses_defeated: [],
  achievements: [],
  _dirty: false,
  _saveTimer: null,

  // Load from server
  async load() {
    try {
      const res = await Auth.fetch('/api/player');
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      Object.assign(this, data);
      this._dirty = false;
      return true;
    } catch (err) {
      console.error('Failed to load player:', err);
      return false;
    }
  },

  // Save to server (debounced)
  save() {
    this._dirty = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._doSave(), 2000);
  },

  // Force immediate save
  async forceSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    await this._doSave();
  },

  async _doSave() {
    try {
      await Auth.fetch('/api/player/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hp: this.hp,
          max_hp: this.max_hp,
          atk: this.atk,
          def: this.def,
          level: this.level,
          exp: this.exp,
          exp_to_next: this.exp_to_next,
          gold: this.gold,
          current_zone: this.current_zone,
          potions: this.potions,
          pos_x: this.pos_x,
          pos_y: this.pos_y,
          zones_unlocked: this.zones_unlocked,
          total_kills: this.total_kills,
          total_correct: this.total_correct,
          total_questions: this.total_questions,
          bosses_defeated: this.bosses_defeated,
        })
      });
      this._dirty = false;
    } catch (err) {
      console.error('Save failed:', err);
    }
  },

  // Gain EXP and check level up
  gainExp(amount) {
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.exp_to_next) {
      this.exp -= this.exp_to_next;
      this.level++;
      this.exp_to_next = Math.floor(100 * Math.pow(1.3, this.level - 1));
      // Stat increases
      const hpGain = 10 + Math.floor(this.level * 2);
      const atkGain = 2 + Math.floor(this.level * 0.5);
      const defGain = 1 + Math.floor(this.level * 0.3);
      this.max_hp += hpGain;
      this.hp = this.max_hp; // Full heal on level up
      this.atk += atkGain;
      this.def += defGain;
      leveledUp = true;
      UI.showLevelUp(this.level, { hp: hpGain, atk: atkGain, def: defGain });
    }
    this.save();
    return leveledUp;
  },

  // Take damage
  takeDamage(amount) {
    const mitigated = Math.max(1, amount - Math.floor(this.def * 0.5));
    this.hp = Math.max(0, this.hp - mitigated);
    this.save();
    return mitigated;
  },

  // Heal
  usePotion() {
    if (this.potions <= 0) return false;
    if (this.hp >= this.max_hp) return false;
    this.potions--;
    const heal = Math.floor(this.max_hp * 0.4);
    this.hp = Math.min(this.max_hp, this.hp + heal);
    this.save();
    return heal;
  },

  // Check and unlock zones
  checkZoneUnlocks() {
    const zoneReqs = { cave: 5, volcano: 12, space: 20 };
    let newUnlock = null;
    for (const [zone, req] of Object.entries(zoneReqs)) {
      if (this.level >= req && !this.zones_unlocked.includes(zone)) {
        this.zones_unlocked.push(zone);
        newUnlock = zone;
      }
    }
    if (newUnlock) this.save();
    return newUnlock;
  },

  // Die & revive
  die() {
    this.hp = Math.floor(this.max_hp * 0.5);
    this.gold = Math.max(0, this.gold - Math.floor(this.gold * 0.1));
    this.current_zone = 'forest';
    this.pos_x = 5;
    this.pos_y = 5;
    this.save();
  },

  // Check achievements
  checkAchievements() {
    const defs = Achievements.definitions;
    const newOnes = [];
    for (const ach of defs) {
      if (this.achievements.includes(ach.id)) continue;
      if (ach.check(this)) {
        this.achievements.push(ach.id);
        newOnes.push(ach);
        // Save to server
        Auth.fetch('/api/player/achievement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementId: ach.id })
        });
      }
    }
    return newOnes;
  }
};

// ========== ACHIEVEMENTS ==========
const Achievements = {
  definitions: [
    { id: 'first_blood', name: 'First Blood', icon: '🗡️', desc: 'Defeat your first monster', check: p => p.total_kills >= 1 },
    { id: 'monster_slayer', name: 'Monster Slayer', icon: '⚔️', desc: 'Defeat 10 monsters', check: p => p.total_kills >= 10 },
    { id: 'exterminator', name: 'Exterminator', icon: '💀', desc: 'Defeat 50 monsters', check: p => p.total_kills >= 50 },
    { id: 'scholar', name: 'Scholar', icon: '📚', desc: 'Answer 10 questions correctly', check: p => p.total_correct >= 10 },
    { id: 'genius', name: 'Genius', icon: '🧠', desc: 'Answer 50 questions correctly', check: p => p.total_correct >= 50 },
    { id: 'level5', name: 'Adventurer', icon: '🌟', desc: 'Reach level 5', check: p => p.level >= 5 },
    { id: 'level10', name: 'Veteran', icon: '⭐', desc: 'Reach level 10', check: p => p.level >= 10 },
    { id: 'level20', name: 'Legend', icon: '🌠', desc: 'Reach level 20', check: p => p.level >= 20 },
    { id: 'cave_unlock', name: 'Spelunker', icon: '🕳️', desc: 'Unlock the Cave zone', check: p => p.zones_unlocked.includes('cave') },
    { id: 'volcano_unlock', name: 'Firewalker', icon: '🔥', desc: 'Unlock the Volcano zone', check: p => p.zones_unlocked.includes('volcano') },
    { id: 'space_unlock', name: 'Star Voyager', icon: '🚀', desc: 'Unlock the Space zone', check: p => p.zones_unlocked.includes('space') },
    { id: 'boss_forest', name: 'Forest Guardian', icon: '🌲', desc: 'Defeat the Forest Boss', check: p => p.bosses_defeated.includes('forest') },
    { id: 'boss_cave', name: 'Cave Conqueror', icon: '🦇', desc: 'Defeat the Cave Boss', check: p => p.bosses_defeated.includes('cave') },
    { id: 'boss_volcano', name: 'Dragon Slayer', icon: '🐉', desc: 'Defeat the Volcano Boss', check: p => p.bosses_defeated.includes('volcano') },
    { id: 'boss_space', name: 'Cosmic Champion', icon: '👾', desc: 'Defeat the Space Boss', check: p => p.bosses_defeated.includes('space') },
    { id: 'rich', name: 'Gold Hoarder', icon: '💰', desc: 'Accumulate 500 gold', check: p => p.gold >= 500 },
    { id: 'potion_master', name: 'Alchemist', icon: '🧪', desc: 'Use 10 potions (total kills as proxy)', check: p => p.total_kills >= 15 },
    { id: 'perfect', name: 'Perfect Score', icon: '💯', desc: 'Answer 20 in a row (tracked via ratio)', check: p => p.total_correct >= 20 && p.total_correct === p.total_questions },
  ]
};

// ========== ZONE & MONSTER DEFINITIONS ==========
const Zones = {
  forest: {
    name: '🌲 Enchanted Forest',
    icon: '🌲',
    bg: '#1a3a1a',
    difficulty: 'easy',
    encounterRate: 0.12,
    reqLevel: 1,
    tileColors: {
      grass: ['#2d5a1e', '#3a6b2a', '#245216'],
      path: ['#8b7355', '#9b8465', '#7a6245'],
      tree: ['#1a3a1a', '#0d2e0d'],
      water: ['#1a4a6a', '#1a5a7a'],
      special: '#ffd700'
    },
    monsters: [
      { name: 'Slime', hp: 30, atk: 5, exp: 15, gold: 5, color: '#4ade80', shape: 'slime' },
      { name: 'Mushroom', hp: 40, atk: 7, exp: 20, gold: 8, color: '#f87171', shape: 'mushroom' },
      { name: 'Wolf', hp: 50, atk: 10, exp: 25, gold: 10, color: '#94a3b8', shape: 'wolf' },
      { name: 'Goblin', hp: 45, atk: 12, exp: 30, gold: 15, color: '#86efac', shape: 'goblin' },
    ],
    boss: { name: '🌳 Elder Treant', hp: 150, atk: 18, exp: 100, gold: 50, color: '#166534', shape: 'treant', isBoss: true }
  },
  cave: {
    name: '🕳️ Crystal Cave',
    icon: '🕳️',
    bg: '#1a1a2e',
    difficulty: 'medium',
    encounterRate: 0.14,
    reqLevel: 5,
    tileColors: {
      grass: ['#2a2a3e', '#333350', '#252540'],
      path: ['#4a4a5e', '#555570', '#3f3f55'],
      tree: ['#3a3a5e', '#2e2e4e'],
      water: ['#1a2a5a', '#1a3a6a'],
      special: '#a855f7'
    },
    monsters: [
      { name: 'Bat', hp: 55, atk: 14, exp: 35, gold: 12, color: '#6b21a8', shape: 'bat' },
      { name: 'Spider', hp: 65, atk: 16, exp: 40, gold: 15, color: '#1e1e1e', shape: 'spider' },
      { name: 'Skeleton', hp: 80, atk: 20, exp: 50, gold: 20, color: '#f1f5f9', shape: 'skeleton' },
      { name: 'Crystal Golem', hp: 100, atk: 15, exp: 55, gold: 25, color: '#7dd3fc', shape: 'golem' },
    ],
    boss: { name: '🦇 Vampire Lord', hp: 300, atk: 30, exp: 200, gold: 100, color: '#7f1d1d', shape: 'vampire', isBoss: true }
  },
  volcano: {
    name: '🌋 Scorched Volcano',
    icon: '🌋',
    bg: '#2e1a0a',
    difficulty: 'hard',
    encounterRate: 0.16,
    reqLevel: 12,
    tileColors: {
      grass: ['#4a2010', '#5a2a15', '#3e1a0d'],
      path: ['#8b4513', '#9b5523', '#7a3a0f'],
      tree: ['#6b2010', '#5b1505'],
      water: ['#ff4500', '#ff6a00'],
      special: '#ef4444'
    },
    monsters: [
      { name: 'Fire Imp', hp: 90, atk: 25, exp: 60, gold: 20, color: '#f97316', shape: 'imp' },
      { name: 'Lava Worm', hp: 110, atk: 28, exp: 70, gold: 25, color: '#ef4444', shape: 'worm' },
      { name: 'Fire Elemental', hp: 130, atk: 32, exp: 80, gold: 30, color: '#fbbf24', shape: 'elemental' },
      { name: 'Demon Knight', hp: 150, atk: 35, exp: 90, gold: 35, color: '#991b1b', shape: 'knight' },
    ],
    boss: { name: '🐉 Inferno Dragon', hp: 500, atk: 45, exp: 400, gold: 200, color: '#dc2626', shape: 'dragon', isBoss: true }
  },
  space: {
    name: '🚀 Cosmic Void',
    icon: '🚀',
    bg: '#050510',
    difficulty: 'hard',
    encounterRate: 0.18,
    reqLevel: 20,
    tileColors: {
      grass: ['#0a0a20', '#0f0f2a', '#080818'],
      path: ['#1a1a4a', '#2a2a5a', '#15153f'],
      tree: ['#2a0a3a', '#1f0530'],
      water: ['#4a0a8a', '#5a1a9a'],
      special: '#3b82f6'
    },
    monsters: [
      { name: 'Alien Probe', hp: 130, atk: 35, exp: 80, gold: 30, color: '#22d3ee', shape: 'probe' },
      { name: 'Space Jellyfish', hp: 160, atk: 38, exp: 90, gold: 35, color: '#c084fc', shape: 'jellyfish' },
      { name: 'Void Walker', hp: 190, atk: 42, exp: 100, gold: 40, color: '#6366f1', shape: 'walker' },
      { name: 'Dark Matter', hp: 220, atk: 48, exp: 120, gold: 50, color: '#1e1b4b', shape: 'darkmatter' },
    ],
    boss: { name: '👾 Cosmic Overlord', hp: 800, atk: 60, exp: 600, gold: 400, color: '#312e81', shape: 'overlord', isBoss: true }
  }
};
