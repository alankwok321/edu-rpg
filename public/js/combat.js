// ========== COMBAT SYSTEM ==========
const Combat = {
  active: false,
  monster: null,
  monsterHp: 0,
  monsterMaxHp: 0,
  questions: [],
  questionIndex: 0,
  isBoss: false,

  async start(monster) {
    this.active = true;
    this.monster = { ...monster };
    // Scale monster stats with player level slightly
    const scale = 1 + (Player.level - 1) * 0.05;
    this.monsterMaxHp = Math.floor(monster.hp * scale);
    this.monsterHp = this.monsterMaxHp;
    this.monster.atk = Math.floor(monster.atk * scale);
    this.isBoss = !!monster.isBoss;

    // Fetch questions for this zone's difficulty
    const zone = Zones[Player.current_zone];
    const diff = zone.difficulty === 'easy' ? 'easy' : zone.difficulty === 'medium' ? 'medium' : 'hard';
    try {
      const res = await fetch(`/api/questions?difficulty=${diff}`);
      this.questions = await res.json();
    } catch (e) {
      // Fallback: generate simple math
      this.questions = this._fallbackQuestions();
    }
    this.questionIndex = 0;

    UI.showCombat(this.monster, this.monsterHp, this.monsterMaxHp);
    this._nextQuestion();
    this._bindActions();
  },

  _bindActions() {
    const potionBtn = document.getElementById('btnUsePotion');
    const fleeBtn = document.getElementById('btnFlee');

    // Remove old listeners by cloning
    const newPotionBtn = potionBtn.cloneNode(true);
    const newFleeBtn = fleeBtn.cloneNode(true);
    potionBtn.parentNode.replaceChild(newPotionBtn, potionBtn);
    fleeBtn.parentNode.replaceChild(newFleeBtn, fleeBtn);

    newPotionBtn.addEventListener('click', () => this._usePotion());
    newFleeBtn.addEventListener('click', () => this._flee());

    // Boss can't flee
    if (this.isBoss) {
      newFleeBtn.disabled = true;
      newFleeBtn.title = "Can't flee from a boss!";
    }
  },

  _nextQuestion() {
    if (!this.active) return;
    if (this.questionIndex >= this.questions.length) {
      // Fetch more questions
      this.questionIndex = 0;
      this.questions.sort(() => Math.random() - 0.5);
    }
    const q = this.questions[this.questionIndex++];
    UI.showQuestion(q, (selectedIdx, btn) => this._onAnswer(q, selectedIdx, btn));

    // Update potion count
    document.getElementById('combatPotions').textContent = Player.potions;
  },

  _onAnswer(question, selectedIdx, clickedBtn) {
    const correct = selectedIdx === question.answer;
    Player.total_questions++;

    UI.showAnswerResult(correct, question.answer, clickedBtn);

    if (correct) {
      Player.total_correct++;
      // Deal damage to monster
      const damage = Player.atk + Math.floor(Math.random() * 5);
      this.monsterHp -= damage;
      UI.showDamagePopup(damage, false);
      UI.updateMonsterHp(this.monsterHp, this.monsterMaxHp);

      // Check if monster is dead
      if (this.monsterHp <= 0) {
        setTimeout(() => this._monsterDefeated(), 1200);
        return;
      }
    } else {
      // Monster attacks player
      const monsterDmg = Player.takeDamage(this.monster.atk);
      UI.showDamagePopup(monsterDmg, true);
      UI.updateHUD();

      if (Player.hp <= 0) {
        setTimeout(() => this._playerDeath(), 1200);
        return;
      }
    }

    // Next question after delay
    setTimeout(() => this._nextQuestion(), 1500);
  },

  _monsterDefeated() {
    this.active = false;
    Player.total_kills++;

    // Gain EXP and gold
    Player.gainExp(this.monster.exp);
    Player.gold += this.monster.gold;

    // Chance to drop a potion (30%)
    if (Math.random() < 0.3) {
      Player.potions++;
      UI.toast('🧪 The monster dropped a health potion!', 'success');
    }

    // Boss defeat
    if (this.isBoss && !Player.bosses_defeated.includes(Player.current_zone)) {
      Player.bosses_defeated.push(Player.current_zone);
      UI.toast(`🏆 Boss defeated! ${this.monster.name} has fallen!`, 'success');
    }

    UI.toast(`⚔️ Defeated ${this.monster.name}! +${this.monster.exp} EXP, +${this.monster.gold} gold`, 'success');
    UI.hideCombat();
    UI.updateHUD();

    // Check zone unlocks
    const newZone = Player.checkZoneUnlocks();
    if (newZone) {
      const z = Zones[newZone];
      UI.toast(`🗺️ New zone unlocked: ${z.name}!`, 'warning');
    }

    // Check achievements
    const newAchs = Player.checkAchievements();
    for (const ach of newAchs) {
      UI.toast(`🏆 Achievement: ${ach.name}!`, 'warning');
    }

    Player.save();

    // Re-enable game movement
    if (typeof Game !== 'undefined') Game.inCombat = false;
  },

  _playerDeath() {
    this.active = false;
    UI.hideCombat();
    UI.showDeath();
    if (typeof Game !== 'undefined') Game.inCombat = false;
  },

  _usePotion() {
    const heal = Player.usePotion();
    if (heal) {
      UI.toast(`🧪 Healed ${heal} HP!`, 'success');
      UI.updateHUD();
      document.getElementById('combatPotions').textContent = Player.potions;
    } else {
      UI.toast(Player.potions <= 0 ? 'No potions left!' : 'HP is already full!', 'error');
    }
  },

  _flee() {
    if (this.isBoss) return;
    // 60% chance to flee, take some damage if fail
    if (Math.random() < 0.6) {
      this.active = false;
      UI.hideCombat();
      UI.toast('🏃 You escaped!', 'info');
      if (typeof Game !== 'undefined') Game.inCombat = false;
    } else {
      const dmg = Player.takeDamage(Math.floor(this.monster.atk * 0.5));
      UI.showDamagePopup(dmg, true);
      UI.updateHUD();
      UI.toast(`Failed to flee! Took ${dmg} damage!`, 'error');
      if (Player.hp <= 0) {
        setTimeout(() => this._playerDeath(), 800);
      }
    }
  },

  _fallbackQuestions() {
    const qs = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const answer = a + b;
      const opts = [answer, answer + 2, answer - 1, answer + 5].sort(() => Math.random() - 0.5);
      qs.push({
        question: `What is ${a} + ${b}?`,
        options: opts.map(String),
        answer: opts.indexOf(answer),
        category: 'math',
        difficulty: 'easy'
      });
    }
    return qs;
  }
};
