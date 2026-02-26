const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'game.db');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    atk INTEGER DEFAULT 10,
    def INTEGER DEFAULT 5,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    exp_to_next INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    current_zone TEXT DEFAULT 'forest',
    potions INTEGER DEFAULT 3,
    pos_x INTEGER DEFAULT 5,
    pos_y INTEGER DEFAULT 5,
    zones_unlocked TEXT DEFAULT '["forest"]',
    total_kills INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    bosses_defeated TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leaderboard_cache (
    user_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    total_kills INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    bosses_defeated INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Prepared statements
const stmts = {
  createUser: db.prepare('INSERT INTO users (username, password) VALUES (?, ?)'),
  getUserByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),

  createPlayer: db.prepare(`INSERT INTO players (user_id) VALUES (?)`),
  getPlayer: db.prepare('SELECT * FROM players WHERE user_id = ?'),
  updatePlayer: db.prepare(`
    UPDATE players SET
      hp = @hp, max_hp = @max_hp, atk = @atk, def = @def,
      level = @level, exp = @exp, exp_to_next = @exp_to_next,
      gold = @gold, current_zone = @current_zone, potions = @potions,
      pos_x = @pos_x, pos_y = @pos_y, zones_unlocked = @zones_unlocked,
      total_kills = @total_kills, total_correct = @total_correct,
      total_questions = @total_questions, bosses_defeated = @bosses_defeated
    WHERE user_id = @user_id
  `),

  addAchievement: db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)'),
  getAchievements: db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?'),

  upsertLeaderboard: db.prepare(`
    INSERT INTO leaderboard_cache (user_id, username, level, total_kills, total_correct, bosses_defeated)
    VALUES (@user_id, @username, @level, @total_kills, @total_correct, @bosses_defeated)
    ON CONFLICT(user_id) DO UPDATE SET
      username = @username, level = @level, total_kills = @total_kills,
      total_correct = @total_correct, bosses_defeated = @bosses_defeated,
      updated_at = CURRENT_TIMESTAMP
  `),
  getLeaderboard: db.prepare('SELECT * FROM leaderboard_cache ORDER BY level DESC, total_kills DESC LIMIT 20'),
};

module.exports = { db, stmts };
