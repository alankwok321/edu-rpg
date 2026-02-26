const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'edu-rpg-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Load questions
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions', 'questions.json'), 'utf-8'));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ============ AUTH ROUTES ============

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username: letters, numbers, underscores only' });

    const existing = db.getUserByName(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const result = db.createUser(username, hashed);
    db.createPlayer(result.lastInsertRowid);

    req.session.userId = result.lastInsertRowid;
    req.session.username = username;

    res.json({ success: true, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = db.getUserByName(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ userId: req.session.userId, username: req.session.username });
});

// ============ GAME DATA ROUTES ============

app.get('/api/player', requireAuth, (req, res) => {
  const player = db.getPlayer(req.session.userId);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  player.username = req.session.username;
  const achievements = db.getAchievements(req.session.userId);
  player.achievements = achievements.map(a => a.achievement_id);

  res.json(player);
});

app.post('/api/player/save', requireAuth, (req, res) => {
  try {
    const data = req.body;
    data.user_id = req.session.userId;

    const validZones = ['forest', 'cave', 'volcano', 'space'];
    if (!validZones.includes(data.current_zone)) data.current_zone = 'forest';

    data.hp = Math.max(0, Math.min(data.hp, data.max_hp));
    data.level = Math.max(1, Math.min(data.level, 99));
    data.potions = Math.max(0, Math.min(data.potions, 99));

    db.updatePlayer(data);
    res.json({ success: true });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Save failed' });
  }
});

app.post('/api/player/achievement', requireAuth, (req, res) => {
  const { achievementId } = req.body;
  if (!achievementId) return res.status(400).json({ error: 'Achievement ID required' });
  db.addAchievement(req.session.userId, achievementId);
  res.json({ success: true });
});

// ============ QUESTIONS ROUTE ============

app.get('/api/questions', requireAuth, (req, res) => {
  const { category, difficulty } = req.query;

  let pool = [];
  const cats = category ? [category] : Object.keys(questions);
  const diffs = difficulty ? [difficulty] : ['easy', 'medium', 'hard'];

  for (const cat of cats) {
    if (!questions[cat]) continue;
    for (const diff of diffs) {
      if (!questions[cat][diff]) continue;
      pool.push(...questions[cat][diff].map(q => ({ ...q, category: cat, difficulty: diff })));
    }
  }

  pool.sort(() => Math.random() - 0.5);
  res.json(pool.slice(0, 10));
});

// ============ LEADERBOARD ============

app.get('/api/leaderboard', (req, res) => {
  const rows = db.getLeaderboard();
  res.json(rows);
});

// ============ SPA FALLBACK ============

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎮 Edu-RPG server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
