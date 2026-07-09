/* Разговорный турецкий — практика для улицы */

let allWords = [];
let scenarios = [];
let practicalIds = new Set();
let wordById = new Map();
let lessonWords = [];
let cardDeck = [];
let lessonIndex = 0;
let cardIndex = 0;
let hearts = 3;
let lessonScore = 0;
let selectedOption = null;
let currentExercise = null;
let selectedScenario = null;
let turkishVoice = null;

const STORAGE = 'turkce_progress';

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

function getPracticalTotal() {
  return practicalIds.size || allWords.length;
}

function getOrderedPracticalIds() {
  const seen = new Set();
  const ordered = [];
  for (const sc of scenarios) {
    for (const id of sc.wordIds) {
      if (!seen.has(id) && wordById.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  for (const id of practicalIds) {
    if (!seen.has(id) && wordById.has(id)) ordered.push(id);
  }
  return ordered;
}

function getScenarioProgress(sc) {
  const p = getProgress();
  const total = sc.wordIds.length;
  const done = sc.wordIds.filter(id => p.learned.includes(id)).length;
  return { done, total };
}

function getNextScenario() {
  for (const sc of scenarios) {
    const { done, total } = getScenarioProgress(sc);
    if (done < total) return sc;
  }
  return scenarios[0];
}

function updateHomeStats() {
  const p = getProgress();
  const total = getPracticalTotal();
  const learnedPractical = p.learned.filter(id => practicalIds.has(id)).length;
  document.getElementById('stat-streak').textContent = p.streak;
  document.getElementById('stat-xp').textContent = p.xp;
  document.getElementById('stat-learned').textContent = learnedPractical;
  document.getElementById('xp-fill').style.width = Math.round(learnedPractical / total * 100) + '%';

  const next = getNextScenario();
  const sub = document.getElementById('btn-start-lesson-sub');
  if (sub && next) sub.textContent = `Следующее: ${next.title}`;
}

async function init() {
  initSpeech();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  [allWords, scenarios] = await Promise.all([
    (await fetch('words.json')).json(),
    (await fetch('scenarios.json')).json(),
  ]);
  wordById = new Map(allWords.map(w => [w.id, w]));
  practicalIds = new Set(scenarios.flatMap(s => s.wordIds));
  scenarios.sort((a, b) => a.order - b.order);
  document.getElementById('stat-total').textContent = getPracticalTotal();
  buildScenarios();
  updateHomeStats();
  bindEvents();
}

function buildScenarios() {
  const grid = document.getElementById('unit-grid');
  grid.innerHTML = '';
  scenarios.forEach(sc => {
    const { done, total } = getScenarioProgress(sc);
    const btn = document.createElement('button');
    btn.className = 'unit-chip';
    btn.innerHTML = `
      <span class="unit-chip-info">
        ${sc.title}
        <small>${sc.subtitle}</small>
        <span class="unit-progress">${done} / ${total} выучено</span>
      </span>`;
    btn.addEventListener('click', () => startLesson(sc.id));
    grid.appendChild(btn);
  });
}

function bindEvents() {
  document.getElementById('btn-start-lesson').addEventListener('click', () => {
    const next = getNextScenario();
    startLesson(next?.id || 'smart');
  });
  document.getElementById('btn-start-cards').addEventListener('click', () => startCards('practical'));
  document.getElementById('btn-close-lesson').addEventListener('click', () => { speak(''); showScreen('screen-home'); buildScenarios(); });
  document.getElementById('btn-close-cards').addEventListener('click', () => { speak(''); showScreen('screen-home'); });
  document.getElementById('btn-check').addEventListener('click', checkAnswer);
  document.getElementById('btn-continue').addEventListener('click', nextExercise);
  document.getElementById('btn-home').addEventListener('click', () => { showScreen('screen-home'); buildScenarios(); });
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

function getScenarioById(id) {
  return scenarios.find(s => s.id === id) || null;
}

function getWordsForScenario(sc) {
  return sc.wordIds.map(id => wordById.get(id)).filter(Boolean);
}

function pickLessonWords(sc) {
  const p = getProgress();
  let pool = sc ? getWordsForScenario(sc) : getOrderedPracticalIds().map(id => wordById.get(id)).filter(Boolean);
  const unseen = pool.filter(w => !p.learned.includes(w.id));
  const seen = pool.filter(w => p.learned.includes(w.id));
  const ordered = [...shuffle(unseen), ...shuffle(seen)];
  return ordered.slice(0, 10);
}

function getDistractorPool(correct) {
  if (selectedScenario) {
    const pool = getWordsForScenario(selectedScenario);
    if (pool.length >= 4) return pool;
  }
  return [...practicalIds].map(id => wordById.get(id)).filter(Boolean);
}

function uniqueDistractors(correct, pool, count, field) {
  const used = new Set([correct.id, correct[field]]);
  const result = [];
  for (const w of shuffle(pool)) {
    if (w.id === correct.id) continue;
    if (used.has(w.id) || used.has(w[field])) continue;
    used.add(w.id);
    used.add(w[field]);
    result.push(w);
    if (result.length >= count) break;
  }
  return result;
}

function startLesson(scenarioId) {
  selectedScenario = getScenarioById(scenarioId) || getNextScenario();
  lessonWords = pickLessonWords(selectedScenario);
  if (!lessonWords.length) {
    lessonWords = pickLessonWords(scenarios[0]);
  }
  lessonIndex = 0;
  hearts = 3;
  lessonScore = 0;
  document.getElementById('hearts').textContent = hearts;
  document.getElementById('lesson-scenario-title').textContent = selectedScenario.title;
  document.getElementById('lesson-scenario-sub').textContent = selectedScenario.subtitle;
  showScreen('screen-lesson');
  showExercise();
}

function showExercise() {
  selectedOption = null;
  currentExercise = lessonIndex % 2 === 0 ? 'ru-to-tr' : 'listen-to-ru';
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
  const contextHtml = word.context ? `<p class="exercise-context">${word.context}</p>` : '';

  if (currentExercise === 'ru-to-tr') {
    body.innerHTML = `
      ${contextHtml}
      <p class="exercise-label">Как сказать по-турецки?</p>
      <div class="word-prompt">${word.russian}</div>`;
    body.appendChild(buildOptions(word, 'turkish'));
  } else {
    body.innerHTML = `
      ${contextHtml}
      <p class="exercise-label">Послушай — что это значит?</p>
      <button type="button" class="listen-btn" id="listen-btn">Слушать</button>
      <p class="listen-hint">Турецкая речь на улице — пойми смысл</p>`;
    body.appendChild(buildOptions(word, 'russian'));
    document.getElementById('listen-btn').addEventListener('click', () => speak(word.turkish));
    setTimeout(() => speak(word.turkish), 400);
  }
}

function buildOptions(correct, field) {
  const list = document.createElement('div');
  list.className = 'options-list';
  const pool = getDistractorPool(correct);
  const opts = shuffle([correct, ...uniqueDistractors(correct, pool, 3, field)]);
  opts.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = w[field];
    btn.dataset.id = w.id;
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
    banner.innerHTML = `Верно!<br><strong>${word.turkish}</strong> — ${word.russian}`;
    lessonScore++;
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    if (!p.learned.includes(word.id)) { p.learned.push(word.id); p.xp += 10; }
    speak(word.turkish);
  } else {
    banner.classList.add('bad');
    banner.innerHTML = `Правильно:<br><strong>${word.turkish}</strong> — ${word.russian}`;
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
  document.getElementById('complete-score').textContent = `${lessonScore} / ${lessonWords.length} верно`;
  if (selectedScenario) {
    document.getElementById('complete-scenario').textContent = selectedScenario.title;
  }
  showScreen('screen-complete');
  updateHomeStats();
}

function startCards(mode) {
  const ids = getOrderedPracticalIds();
  const pool = ids.map(id => wordById.get(id)).filter(Boolean);
  cardDeck = shuffle(pool).slice(0, 20);
  cardIndex = 0;
  showScreen('screen-cards');
  renderCard();
}

function renderCard() {
  const w = cardDeck[cardIndex];
  document.getElementById('cards-counter').textContent = `${cardIndex + 1} / ${cardDeck.length}`;
  document.getElementById('card-ru-front').textContent = w.russian;
  document.getElementById('card-word').textContent = w.turkish;
  document.getElementById('card-ru').textContent = w.russian;
  document.getElementById('card-context').textContent = w.context || '';
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
    buildScenarios();
  }
}

init();
