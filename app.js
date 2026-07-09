/* Türkçe Öğren — Duolingo style */

let allWords = [];
let lessonWords = [];
let cardDeck = [];
let lessonIndex = 0;
let cardIndex = 0;
let hearts = 3;
let lessonScore = 0;
let selectedOption = null;
let currentExercise = null;
let selectedCategory = 'all';
let turkishVoice = null;

const STORAGE = 'turkce_progress';

const UNITS = {
  'Selamlaşma': { icon: '👋', key: 'Приветствия' },
  'Yemek': { icon: '🍽️', key: 'Еда' },
  'Aile': { icon: '👨‍👩‍👧', key: 'Семья' },
  'Şehir': { icon: '🏙️', key: 'Город' },
  'Ulaşım': { icon: '🚌', key: 'Транспорт' },
  'Seyahat': { icon: '✈️', key: 'Путешествия' },
  'Doğa': { icon: '🌳', key: 'Природа' },
  'Fiiller': { icon: '🏃', key: 'Глаголы' },
  'Duygular': { icon: '😊', key: 'Эмоции' },
  'Ev': { icon: '🏠', key: 'Дом' },
};

// ── Speech ──────────────────────────────────────────
function initSpeech() {
  const load = () => {
    turkishVoice = speechSynthesis.getVoices().find(v => v.lang.startsWith('tr')) || null;
  };
  load();
  speechSynthesis.onvoiceschanged = load;
}

function speak(text) {
  if (!text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'tr-TR';
  u.rate = 0.85;
  if (turkishVoice) u.voice = turkishVoice;
  speechSynthesis.speak(u);
}

// ── Progress ────────────────────────────────────────
function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) || { learned: [], xp: 0, streak: 0, bestStreak: 0 };
  } catch {
    return { learned: [], xp: 0, streak: 0, bestStreak: 0 };
  }
}

function saveProgress(p) {
  localStorage.setItem(STORAGE, JSON.stringify(p));
  updateHomeStats();
}

function updateHomeStats() {
  const p = getProgress();
  document.getElementById('stat-streak').textContent = p.streak;
  document.getElementById('stat-xp').textContent = p.xp;
  document.getElementById('stat-learned').textContent = p.learned.length;
  document.getElementById('xp-fill').style.width = Math.round(p.learned.length / 500 * 100) + '%';
}

// ── Init ──────────────────────────────────────────
async function init() {
  initSpeech();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  allWords = await (await fetch('words.json')).json();
  buildUnits();
  updateHomeStats();
  bindEvents();
}

function buildUnits() {
  const grid = document.getElementById('unit-grid');
  grid.innerHTML = '';
  Object.entries(UNITS).forEach(([name, { icon, key }]) => {
    const count = allWords.filter(w => w.category === key).length;
    const btn = document.createElement('button');
    btn.className = 'unit-chip';
    btn.innerHTML = `<span class="unit-chip-icon">${icon}</span><span class="unit-chip-info">${name}<small>${count} kelime</small></span>`;
    btn.addEventListener('click', () => startLesson(key));
    grid.appendChild(btn);
  });
}

function bindEvents() {
  document.getElementById('btn-start-lesson').addEventListener('click', () => startLesson('all'));
  document.getElementById('btn-start-cards').addEventListener('click', () => startCards('all'));
  document.getElementById('btn-close-lesson').addEventListener('click', () => { speak(''); showScreen('screen-home'); });
  document.getElementById('btn-close-cards').addEventListener('click', () => { speak(''); showScreen('screen-home'); });
  document.getElementById('btn-check').addEventListener('click', checkAnswer);
  document.getElementById('btn-continue').addEventListener('click', nextExercise);
  document.getElementById('btn-home').addEventListener('click', () => showScreen('screen-home'));
  document.getElementById('duo-card').addEventListener('click', flipCard);
  document.getElementById('card-sound').addEventListener('click', (e) => { e.stopPropagation(); speak(cardDeck[cardIndex]?.turkish); });
  document.getElementById('btn-again').addEventListener('click', () => { speak(cardDeck[cardIndex]?.turkish); });
  document.getElementById('btn-know').addEventListener('click', markKnow);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function imgSrc(word) {
  return word.image || '';
}

function uniqueDistractors(correct, pool, count, field) {
  const used = new Set([correct.id, correct.image, correct.emoji, correct[field]]);
  const result = [];
  for (const w of shuffle(pool)) {
    if (w.id === correct.id) continue;
    if (used.has(w.id) || used.has(w.image) || used.has(w.emoji) || used.has(w[field])) continue;
    used.add(w.id);
    used.add(w.image);
    used.add(w.emoji);
    used.add(w[field]);
    result.push(w);
    if (result.length >= count) break;
  }
  return result;
}

// ── Lesson ──────────────────────────────────────────
function startLesson(category) {
  selectedCategory = category;
  let pool = category === 'all' ? [...allWords] : allWords.filter(w => w.category === category);
  lessonWords = shuffle(pool).slice(0, 10);
  lessonIndex = 0;
  hearts = 3;
  lessonScore = 0;
  document.getElementById('hearts').textContent = hearts;
  showScreen('screen-lesson');
  showExercise();
}

function showExercise() {
  selectedOption = null;
  currentExercise = lessonIndex % 2 === 0 ? 'image-word' : 'listen-image';
  const word = lessonWords[lessonIndex];
  const total = lessonWords.length;

  document.getElementById('lesson-fill').style.width = (lessonIndex / total * 100) + '%';
  document.getElementById('lesson-footer').classList.remove('hidden');
  document.getElementById('feedback-banner').className = 'feedback-banner';
  document.getElementById('btn-check').classList.remove('active', 'hidden');
  document.getElementById('btn-check').disabled = true;
  document.getElementById('btn-continue').classList.add('hidden');

  const body = document.getElementById('lesson-body');
  body.innerHTML = '';

  if (currentExercise === 'image-word') {
    body.innerHTML = `<p class="exercise-label">Bu nedir?</p>
      <img class="exercise-img" src="${imgSrc(word)}" alt="">`;
    body.appendChild(buildWordOptions(word));
  } else {
    body.innerHTML = `<p class="exercise-label">Dinle ve resmi seç</p>
      <div class="listen-zone" id="listen-btn">🔊</div>`;
    body.appendChild(buildImageOptions(word));
    document.getElementById('listen-btn').addEventListener('click', () => speak(word.turkish));
    setTimeout(() => speak(word.turkish), 400);
  }
}

function buildWordOptions(correct) {
  const list = document.createElement('div');
  list.className = 'options-list';
  const opts = shuffle([correct, ...uniqueDistractors(correct, allWords, 3, 'turkish')]);
  opts.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = w.turkish;
    btn.dataset.id = w.id;
    btn.addEventListener('click', () => selectOption(btn));
    list.appendChild(btn);
  });
  return list;
}

function buildImageOptions(correct) {
  const list = document.createElement('div');
  list.className = 'options-list';
  const opts = shuffle([correct, ...uniqueDistractors(correct, allWords, 3, 'turkish')]);
  opts.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'option option-img-only';
    btn.dataset.id = w.id;
    btn.innerHTML = `<img class="option-img" src="${imgSrc(w)}" alt="">`;
    btn.addEventListener('click', () => selectOption(btn));
    list.appendChild(btn);
  });
  return list;
}

function selectOption(btn) {
  document.querySelectorAll('.option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedOption = parseInt(btn.dataset.id, 10);
  const check = document.getElementById('btn-check');
  check.disabled = false;
  check.classList.add('active');
}

function checkAnswer() {
  if (selectedOption === null) return;
  const word = lessonWords[lessonIndex];
  const correct = selectedOption === word.id;
  const p = getProgress();

  document.querySelectorAll('.option').forEach(btn => {
    btn.disabled = true;
    const id = parseInt(btn.dataset.id, 10);
    if (id === word.id) btn.classList.add('correct');
    else if (id === selectedOption) btn.classList.add('wrong');
  });

  const banner = document.getElementById('feedback-banner');
  banner.classList.add('show');

  if (correct) {
    banner.classList.add('ok');
    banner.textContent = `✓ Doğru! ${word.turkish}`;
    lessonScore++;
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    if (!p.learned.includes(word.id)) { p.learned.push(word.id); p.xp += 10; }
    speak(word.turkish);
  } else {
    banner.classList.add('bad');
    banner.textContent = `✗ Doğrusu: ${word.turkish}`;
    hearts--;
    p.streak = 0;
    document.getElementById('hearts').textContent = hearts;
    speak(word.turkish);
  }

  saveProgress(p);
  document.getElementById('btn-check').classList.add('hidden');
  document.getElementById('btn-continue').classList.remove('hidden');
}

function nextExercise() {
  lessonIndex++;
  if (lessonIndex >= lessonWords.length || hearts <= 0) {
    finishLesson();
  } else {
    showExercise();
  }
}

function finishLesson() {
  document.getElementById('complete-xp').textContent = lessonScore * 10;
  document.getElementById('complete-score').textContent = `${lessonScore} / ${lessonWords.length} doğru`;
  showScreen('screen-complete');
  updateHomeStats();
}

// ── Cards ───────────────────────────────────────────
function startCards(category) {
  let pool = category === 'all' ? [...allWords] : allWords.filter(w => w.category === category);
  cardDeck = shuffle(pool).slice(0, 20);
  cardIndex = 0;
  showScreen('screen-cards');
  renderCard();
}

function renderCard() {
  const w = cardDeck[cardIndex];
  document.getElementById('cards-counter').textContent = `${cardIndex + 1} / ${cardDeck.length}`;
  document.getElementById('card-img').innerHTML = `<img src="${imgSrc(w)}" alt="">`;
  document.getElementById('card-word').textContent = w.turkish;
  document.getElementById('duo-card').classList.remove('flipped');
}

function flipCard() {
  const flipped = document.getElementById('duo-card').classList.toggle('flipped');
  if (flipped) speak(cardDeck[cardIndex].turkish);
}

function markKnow() {
  const w = cardDeck[cardIndex];
  const p = getProgress();
  if (!p.learned.includes(w.id)) { p.learned.push(w.id); p.xp += 5; }
  saveProgress(p);
  if (cardIndex < cardDeck.length - 1) {
    cardIndex++;
    renderCard();
  } else {
    showScreen('screen-home');
  }
}

init();
