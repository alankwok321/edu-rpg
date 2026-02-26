# EduQuest RPG ⚔️

A web-based 2D RPG educational game where learning meets adventure! Answer questions to defeat monsters, earn EXP, and level up your hero.

## 🎮 Features

- **Top-down 2D exploration** with tile-based movement (WASD / Arrow keys)
- **4 zones** of increasing difficulty: Forest → Cave → Volcano → Space
- **Turn-based combat** where you answer questions to attack monsters
- **50+ questions** across Math, Science, English, and Logic categories
- **Progression system** with levels, stats, and zone unlocks
- **Boss battles** at the end of each zone
- **Achievement system** with 18 unique achievements to earn
- **Leaderboard** to compete with other players
- **Pixel art style** — all graphics are code-generated (no external assets!)
- **Responsive** — works on desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend:** HTML5 Canvas + Vanilla JavaScript
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session

## 🚀 Quick Start

```bash
cd edu-rpg
npm install
node server.js
```

Then open `http://localhost:3000` in your browser.

## 🎯 How to Play

1. **Register** a new account or login
2. **Explore** the map using WASD or arrow keys
3. **Encounter** monsters as you walk through the zone
4. **Answer questions** correctly to deal damage — wrong answers let the monster attack you
5. **Defeat monsters** to earn EXP and gold
6. **Level up** to unlock new zones and get stronger
7. **Find the boss portal** (💀) in each zone to challenge the boss
8. **Visit the healer** (green NPC with ✚) to restore HP

## 🗺️ Zones

| Zone | Difficulty | Required Level | Boss |
|------|-----------|---------------|------|
| 🌲 Enchanted Forest | Easy | 1 | Elder Treant |
| 🕳️ Crystal Cave | Medium | 5 | Vampire Lord |
| 🌋 Scorched Volcano | Hard | 12 | Inferno Dragon |
| 🚀 Cosmic Void | Hard | 20 | Cosmic Overlord |

## 📝 License

MIT
