// Simple in-memory database (works on Vercel serverless + locally)
// Data persists during the process lifetime. On Vercel, each cold start resets.
// For production, swap with a real DB (Postgres, Turso, etc.)

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'store.json');

let store = {
  users: {},        // { id: { id, username, password } }
  players: {},      // { usedId: { ...stats } }
  achievements: {}, // { usedId: [ 'ach_id', ... ] }
  nextUserId: 1,
};

// Try to load persisted data (for local dev)
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      store = JSON.parse(raw);
    }
  } catch (e) {
    console.log('Starting with fresh database');
  }
}

function saveStore() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    // Vercel serverless: filesystem is read-only, that's fine
  }
}

loadStore();

const db = {
  createUser(username, hashedPassword) {
    const id = store.nextUserId++;
    store.users[id] = { id, username, password: hashedPassword };
    saveStore();
    return { lastInsertRowid: id };
  },

  getUserByName(username) {
    return Object.values(store.users).find(u => u.username === username) || null;
  },

  getUserById(id) {
    return store.users[id] || null;
  },

  createPlayer(userId) {
    store.players[userId] = {
      user_id: userId,
      hp: 100, max_hp: 100, atk: 10, def: 5,
      level: 1, exp: 0, exp_to_next: 100,
      gold: 0, current_zone: 'forest', potions: 3,
      pos_x: 5, pos_y: 5,
      zones_unlocked: ['forest'],
      total_kills: 0, total_correct: 0, total_questions: 0,
      bosses_defeated: [],
    };
    store.achievements[userId] = [];
    saveStore();
  },

  getPlayer(userId) {
    const p = store.players[userId];
    if (!p) return null;
    return {
      ...p,
      zones_unlocked: Array.isArray(p.zones_unlocked) ? p.zones_unlocked : JSON.parse(p.zones_unlocked || '["forest"]'),
      bosses_defeated: Array.isArray(p.bosses_defeated) ? p.bosses_defeated : JSON.parse(p.bosses_defeated || '[]'),
    };
  },

  updatePlayer(data) {
    const userId = data.user_id;
    if (!store.players[userId]) return;
    store.players[userId] = {
      ...store.players[userId],
      ...data,
      zones_unlocked: Array.isArray(data.zones_unlocked) ? data.zones_unlocked : JSON.parse(data.zones_unlocked || '["forest"]'),
      bosses_defeated: Array.isArray(data.bosses_defeated) ? data.bosses_defeated : JSON.parse(data.bosses_defeated || '[]'),
    };
    saveStore();
  },

  addAchievement(userId, achievementId) {
    if (!store.achievements[userId]) store.achievements[userId] = [];
    if (!store.achievements[userId].includes(achievementId)) {
      store.achievements[userId].push(achievementId);
      saveStore();
    }
  },

  getAchievements(userId) {
    return (store.achievements[userId] || []).map(id => ({ achievement_id: id }));
  },

  getLeaderboard() {
    return Object.values(store.players)
      .map(p => {
        const user = store.users[p.user_id];
        const bosses = Array.isArray(p.bosses_defeated) ? p.bosses_defeated : JSON.parse(p.bosses_defeated || '[]');
        return {
          username: user ? user.username : 'Unknown',
          level: p.level || 1,
          total_kills: p.total_kills || 0,
          total_correct: p.total_correct || 0,
          bosses_defeated: bosses.length,
        };
      })
      .sort((a, b) => b.level - a.level || b.total_kills - a.total_kills)
      .slice(0, 20);
  },
};

module.exports = { db };
