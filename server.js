const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'edu-rpg-jwt-secret-change-in-prod';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Load questions
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions', 'questions.json'), 'utf-8'));

// Helper: generate JWT
function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

// Helper: extract user from JWT
function extractUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Auth middleware
function requireAuth(req, res, next) {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = user; // { userId, username }
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

    const token = generateToken(result.lastInsertRowid, username);
    res.json({ success: true, username, token });
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

    const token = generateToken(user.id, user.username);
    res.json({ success: true, username: user.username, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  // JWT is stateless — client just discards the token
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ userId: user.userId, username: user.username });
});

// ============ GAME DATA ROUTES ============

app.get('/api/player', requireAuth, (req, res) => {
  const player = db.getPlayer(req.user.userId);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  player.username = req.user.username;
  const achievements = db.getAchievements(req.user.userId);
  player.achievements = achievements.map(a => a.achievement_id);

  res.json(player);
});

app.post('/api/player/save', requireAuth, (req, res) => {
  try {
    const data = req.body;
    data.user_id = req.user.userId;

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
  db.addAchievement(req.user.userId, achievementId);
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
