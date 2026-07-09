/* Turkish Vocab Trainer — 500 words */

let allWords = [];
let quizWords = [];
let currentIndex = 0;
let score = 0;
let currentMode = '';
let mistakes = [];
let flashIndex = 0;
let flashDeck = [];

const STORAGE_KEY = 'turkish_vocab_progress';
const SETTINGS_KEY = 'turkish_vocab_settings';

let turkishVoice = null;
let speakingBtn = null;

// ── Speech (Turkish TTS) ─────────────────────────────
function initSpeech() {
  const loadVoices = () => {
    const voices = speechSynthesis.getVoices();
    turkishVoice =
      voices.find(v => v.lang.startsWith('tr')) ||
      voices.find(v => v.lang.includes('TR')) ||
      null;
  };

  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { autoSpeak: true, speechRate: 0.85 };
  } catch {
    return { autoSpeak: true, speechRate: 0.85 };
  }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  flashSavedStatus();
}

function stopSpeech() {
  speechSynthesis.cancel();
  if (speakingBtn) {
    speakingBtn.classList.remove('speaking');
    speakingBtn = null;
  }
}

function speakTurkish(text, btn = null) {
  if (!text || !window.speechSynthesis) return;

  stopSpeech();
  if (btn) {
    speakingBtn = btn;
    btn.classList.add('speaking');
  }

  const settings = getSettings();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'tr-TR';
  utter.rate = settings.speechRate;
  utter.pitch = 1;

  if (turkishVoice) utter.voice = turkishVoice;

  utter.onend = () => {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    speakingBtn = null;
  };
  utter.onerror = () => {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    speakingBtn = null;
  };

  speechSynthesis.speak(utter);
}

function createSpeakButton(text, label = '🔊 Послушать', className = 'btn-speak') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    speakTurkish(text, btn);
  });
  return btn;
}

function maybeAutoSpeak(text) {
  if (getSettings().autoSpeak) {
    setTimeout(() => speakTurkish(text), 350);
  }
}

function appendWordAudio(parent, word, { showWord = true } = {}) {
  const row = document.createElement('div');
  row.className = 'quiz-audio-row';
  if (showWord) {
    const label = document.createElement('span');
    label.className = 'quiz-word';
    label.style.fontSize = '1.4rem';
    label.style.margin = '0';
    label.textContent = word.turkish;
    row.appendChild(label);
  }
  row.appendChild(createSpeakButton(word.turkish));
  parent.appendChild(row);
}

// ── Images ───────────────────────────────────────────
function createWordImage(word, size = 'large') {
  const wrap = document.createElement('div');
  wrap.className = 'word-image-wrap';

  const img = document.createElement('img');
  img.className = `word-image word-image-${size}`;
  img.alt = word.russian;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = word.image || '';
  img.dataset.wordId = word.id;

  img.onerror = () => {
    img.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.className = 'quiz-emoji';
    fallback.textContent = word.emoji || '🖼️';
    wrap.appendChild(fallback);
  };

  wrap.appendChild(img);
  return wrap;
}

function renderWordImage(container, word, size = 'large') {
  container.innerHTML = '';
  container.appendChild(createWordImage(word, size));
}

// ── PWA ──────────────────────────────────────────────
let deferredInstallPrompt = null;

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!localStorage.getItem('install-dismissed')) {
      document.getElementById('install-banner').classList.remove('hidden');
    }
  });

  document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.getElementById('install-banner').classList.add('hidden');
      return;
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const msg = isIOS
      ? 'iPhone/iPad:\n1. Нажми «Поделиться» ⬆️ внизу Safari\n2. «На экран Домой»\n3. Готово — иконка на главном экране!\n\nРаботает без компьютера и без интернета (после первого открытия).'
      : 'Android:\n1. Меню браузера (⋮)\n2. «Установить приложение» или «Добавить на главный экран»\n\nРаботает без компьютера!';
    alert(msg);
  });

  document.getElementById('btn-dismiss-install').addEventListener('click', () => {
    document.getElementById('install-banner').classList.add('hidden');
    localStorage.setItem('install-dismissed', '1');
  });
}

// ── Init ──────────────────────────────────────────────
async function init() {
  initSpeech();
  initPWA();
  const res = await fetch('words.json');
  allWords = await res.json();
  populateCategories();
  loadStats();
  loadAudioSettings();
  loadSavedFilters();
  bindEvents();
}

function populateCategories() {
  const cats = [...new Set(allWords.map(w => w.category))].sort();
  const sel = document.getElementById('category-filter');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function bindEvents() {
  document.querySelectorAll('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => startMode(btn.dataset.mode));
  });
  document.getElementById('btn-back').addEventListener('click', () => { stopSpeech(); showMenu(); });
  document.getElementById('btn-back-flash').addEventListener('click', () => { stopSpeech(); showMenu(); });
  document.getElementById('btn-next').addEventListener('click', nextQuestion);
  document.getElementById('btn-retry').addEventListener('click', () => startMode(currentMode));
  document.getElementById('btn-menu').addEventListener('click', showMenu);

  document.getElementById('auto-speak').addEventListener('change', (e) => {
    const s = getSettings();
    s.autoSpeak = e.target.checked;
    saveSettings(s);
  });

  document.getElementById('speech-rate').addEventListener('input', (e) => {
    const s = getSettings();
    s.speechRate = parseFloat(e.target.value);
    saveSettings(s);
    document.getElementById('speech-rate-value').textContent = s.speechRate.toFixed(2) + '×';
  });

  document.getElementById('btn-test-voice').addEventListener('click', (e) => {
    speakTurkish('Merhaba, Türkçe öğreniyorum.', e.currentTarget);
  });

  // Flashcards
  document.getElementById('flashcard').addEventListener('click', flipCard);
  document.getElementById('fc-speak').addEventListener('click', (e) => {
    e.stopPropagation();
    speakTurkish(flashDeck[flashIndex].turkish, e.currentTarget);
  });
  document.getElementById('fc-prev').addEventListener('click', () => navigateFlash(-1));
  document.getElementById('fc-next').addEventListener('click', () => navigateFlash(1));
  document.getElementById('fc-know').addEventListener('click', () => markFlash(true));
  document.getElementById('fc-dont-know').addEventListener('click', () => markFlash(false));

  document.getElementById('category-filter').addEventListener('change', saveFilters);
  document.getElementById('count-filter').addEventListener('change', saveFilters);

  document.getElementById('btn-export').addEventListener('click', exportProgress);
  document.getElementById('btn-import').addEventListener('change', importProgress);
}

function saveFilters() {
  const data = {
    category: document.getElementById('category-filter').value,
    count: document.getElementById('count-filter').value,
  };
  localStorage.setItem('turkish_vocab_filters', JSON.stringify(data));
}

function loadSavedFilters() {
  try {
    const data = JSON.parse(localStorage.getItem('turkish_vocab_filters'));
    if (!data) return;
    if (data.category) document.getElementById('category-filter').value = data.category;
    if (data.count) document.getElementById('count-filter').value = data.count;
  } catch { /* ignore */ }
}

function flashSavedStatus() {
  const el = document.getElementById('save-status');
  el.textContent = '💾 Прогресс сохранён';
  el.style.color = 'var(--green)';
}

function exportProgress() {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    progress: getProgress(),
    settings: getSettings(),
    filters: JSON.parse(localStorage.getItem('turkish_vocab_filters') || '{}'),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `turkish-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (backup.progress) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.progress));
        loadStats();
      }
      if (backup.settings) saveSettings(backup.settings);
      if (backup.filters) {
        localStorage.setItem('turkish_vocab_filters', JSON.stringify(backup.filters));
        loadSavedFilters();
      }
      loadAudioSettings();
      flashSavedStatus();
      alert('Прогресс успешно восстановлен!');
    } catch {
      alert('Не удалось прочитать файл бэкапа.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function loadAudioSettings() {
  const s = getSettings();
  document.getElementById('auto-speak').checked = s.autoSpeak;
  document.getElementById('speech-rate').value = s.speechRate;
  document.getElementById('speech-rate-value').textContent = s.speechRate.toFixed(2) + '×';
}

// ── Progress ────────────────────────────────────────
function getProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultProgress(); }
  catch { return defaultProgress(); }
}

function defaultProgress() {
  return {
    learned: [], mistakes: [], totalAnswered: 0, totalCorrect: 0,
    streak: 0, bestStreak: 0, lastUpdated: null, flashIndex: 0,
  };
}

function saveProgress(p) {
  p.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  loadStats();
  flashSavedStatus();
}

function loadStats() {
  const p = getProgress();
  document.getElementById('stat-learned').textContent = p.learned.length;
  document.getElementById('stat-streak').textContent = p.bestStreak;
  const acc = p.totalAnswered > 0 ? Math.round(p.totalCorrect / p.totalAnswered * 100) : 0;
  document.getElementById('stat-accuracy').textContent = acc + '%';

  const status = document.getElementById('save-status');
  if (p.lastUpdated) {
    const d = new Date(p.lastUpdated);
    status.textContent = `💾 Сохранено ${d.toLocaleDateString('ru')} ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  }
}

// ── Navigation ──────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMenu() {
  stopSpeech();
  showScreen('screen-menu');
}

function getFilteredWords() {
  const cat = document.getElementById('category-filter').value;
  const count = parseInt(document.getElementById('count-filter').value);
  let pool = cat === 'all' ? [...allWords] : allWords.filter(w => w.category === cat);
  return shuffle(pool).slice(0, count);
}

function startMode(mode) {
  currentMode = mode;
  mistakes = [];
  score = 0;
  currentIndex = 0;

  if (mode === 'flashcards') {
    flashDeck = getFilteredWords();
    const p = getProgress();
    flashIndex = Math.min(p.flashIndex || 0, Math.max(flashDeck.length - 1, 0));
    showScreen('screen-flashcards');
    renderFlashcard();
    return;
  }

  if (mode === 'review') {
    const p = getProgress();
    const mistakeIds = p.mistakes.map(m => m.id);
    quizWords = shuffle(allWords.filter(w => mistakeIds.includes(w.id)));
    if (quizWords.length === 0) {
      alert('Нет слов для повторения! Сначала пройди тест.');
      return;
    }
    quizWords = quizWords.slice(0, Math.min(quizWords.length, parseInt(document.getElementById('count-filter').value)));
  } else if (mode === 'marathon') {
    quizWords = shuffle([...allWords]);
  } else {
    quizWords = getFilteredWords();
  }

  document.getElementById('feedback').classList.add('hidden');
  document.getElementById('live-score').textContent = '0';
  showScreen('screen-quiz');
  renderQuestion();
}

// ── Quiz ────────────────────────────────────────────
function renderQuestion() {
  stopSpeech();
  const word = quizWords[currentIndex];
  const total = quizWords.length;
  const pct = ((currentIndex) / total) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${currentIndex + 1} / ${total}`;
  document.getElementById('feedback').classList.add('hidden');

  const body = document.getElementById('quiz-body');
  body.innerHTML = '';

  if (currentMode === 'listen-to-turkish') {
    body.innerHTML = `
      <p class="question-prompt">Послушай и выбери правильную картинку</p>
      <div class="quiz-category">${word.category}</div>
      <div class="listen-prompt">
        <div class="listen-icon">🔊</div>
        <p class="listen-hint">Нажми кнопку, если не слышишь</p>
      </div>
    `;
    appendWordAudio(body, word, { showWord: false });
    body.appendChild(buildImageOptions(word));
    maybeAutoSpeak(word.turkish);
  } else if (currentMode === 'picture-to-turkish') {
    body.innerHTML = `
      <p class="question-prompt">Как по-турецки?</p>
      <div class="quiz-category">${word.category}</div>
      <div id="quiz-image-slot"></div>
    `;
    renderWordImage(document.getElementById('quiz-image-slot'), word, 'large');
    body.appendChild(buildOptions(word, 'turkish'));
  } else if (currentMode === 'picture-to-russian') {
    body.innerHTML = `
      <p class="question-prompt">Что это на русском?</p>
      <div class="quiz-category">${word.category}</div>
      <div id="quiz-image-slot"></div>
    `;
    renderWordImage(document.getElementById('quiz-image-slot'), word, 'large');
    body.appendChild(buildOptions(word, 'russian'));
  } else if (currentMode === 'turkish-to-picture') {
    body.innerHTML = `
      <p class="question-prompt">Выбери правильную картинку</p>
      <div class="quiz-category">${word.category}</div>
      <div class="quiz-word">${word.turkish}</div>
      <p class="question-prompt">${word.russian}</p>
    `;
    appendWordAudio(body, word, { showWord: false });
    body.appendChild(buildImageOptions(word));
    maybeAutoSpeak(word.turkish);
  } else if (currentMode === 'marathon' || currentMode === 'review') {
    const modes = ['picture-to-turkish', 'picture-to-russian', 'turkish-to-picture'];
    const sub = modes[currentIndex % 3];
    if (sub === 'picture-to-turkish') {
      body.innerHTML = `<p class="question-prompt">Как по-турецки?</p><div class="quiz-category">${word.category}</div><div id="quiz-image-slot"></div>`;
      renderWordImage(document.getElementById('quiz-image-slot'), word, 'large');
      body.appendChild(buildOptions(word, 'turkish'));
    } else if (sub === 'picture-to-russian') {
      body.innerHTML = `<p class="question-prompt">Что это на русском?</p><div class="quiz-category">${word.category}</div><div id="quiz-image-slot"></div>`;
      renderWordImage(document.getElementById('quiz-image-slot'), word, 'large');
      body.appendChild(buildOptions(word, 'russian'));
    } else {
      body.innerHTML = `<p class="question-prompt">Выбери картинку</p><div class="quiz-word">${word.turkish}</div>`;
      body.appendChild(buildImageOptions(word));
    }
  }
}

function buildOptions(correct, field) {
  const grid = document.createElement('div');
  grid.className = 'options-grid';

  const distractors = shuffle(allWords.filter(w => w.id !== correct.id)).slice(0, 3);
  const options = shuffle([correct, ...distractors]);

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    const label = document.createElement('span');
    label.textContent = opt[field];
    btn.appendChild(label);
    if (field === 'turkish') {
      const speakHint = document.createElement('span');
      speakHint.className = 'option-speak';
      speakHint.textContent = '🔊 послушать';
      speakHint.addEventListener('click', (e) => {
        e.stopPropagation();
        speakTurkish(opt.turkish);
      });
      btn.appendChild(speakHint);
    }
    btn.addEventListener('click', () => handleAnswer(btn, opt.id === correct.id, correct));
    grid.appendChild(btn);
  });
  return grid;
}

function buildImageOptions(correct) {
  const grid = document.createElement('div');
  grid.className = 'options-grid';

  const distractors = shuffle(
    allWords.filter(w => w.id !== correct.id && w.image !== correct.image)
  ).slice(0, 3);
  const options = shuffle([correct, ...distractors]);

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.wordId = opt.id;
    btn.appendChild(createWordImage(opt, 'small'));
    btn.addEventListener('click', () => handleAnswer(btn, opt.id === correct.id, correct));
    grid.appendChild(btn);
  });
  return grid;
}

function handleAnswer(btn, isCorrect, word) {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  const progress = getProgress();
  progress.totalAnswered++;

  if (isCorrect) {
    btn.classList.add('correct');
    score++;
    progress.totalCorrect++;
    progress.streak++;
    if (progress.streak > progress.bestStreak) progress.bestStreak = progress.streak;
    if (!progress.learned.includes(word.id)) progress.learned.push(word.id);
    showFeedback(true, word);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option-btn').forEach(b => {
      if (b === btn) return;
      const wordId = parseInt(b.dataset.wordId, 10);
      const label = b.querySelector('span:not(.option-speak)');
      const txt = label?.textContent || b.textContent;
      if (wordId === word.id || txt === word.turkish || txt === word.russian) {
        b.classList.add('correct');
      }
    });
    progress.streak = 0;
    if (!progress.mistakes.find(m => m.id === word.id)) {
      progress.mistakes.push({ id: word.id, turkish: word.turkish });
    }
    mistakes.push(word);
    showFeedback(false, word);
  }

  document.getElementById('live-score').textContent = score;
  saveProgress(progress);
}

function showFeedback(correct, word) {
  const fb = document.getElementById('feedback');
  fb.classList.remove('hidden', 'correct-fb', 'wrong-fb');
  fb.classList.add(correct ? 'correct-fb' : 'wrong-fb');

  const content = document.getElementById('feedback-content');
  content.innerHTML = correct
    ? `✅ Верно! <strong>${word.turkish}</strong> — ${word.russian}`
    : `❌ Неверно! Правильно: <strong>${word.turkish}</strong> — ${word.russian}`;

  const imgWrap = document.createElement('div');
  imgWrap.style.marginTop = '12px';
  imgWrap.appendChild(createWordImage(word, 'small'));
  content.appendChild(imgWrap);

  const speakRow = document.createElement('div');
  speakRow.className = 'quiz-audio-row';
  speakRow.style.marginTop = '12px';
  speakRow.appendChild(createSpeakButton(word.turkish, '🔊 Произношение'));
  content.appendChild(speakRow);

  speakTurkish(word.turkish);
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= quizWords.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

function showResults() {
  const total = quizWords.length;
  const pct = Math.round(score / total * 100);
  let emoji = '🎉', title = 'Отлично!';
  if (pct < 50) { emoji = '💪'; title = 'Нужно ещё потренироваться'; }
  else if (pct < 80) { emoji = '👍'; title = 'Неплохо!'; }

  document.getElementById('results-emoji').textContent = emoji;
  document.getElementById('results-title').textContent = title;
  document.getElementById('results-score').textContent = `${score} / ${total}`;
  document.getElementById('results-percent').textContent = pct + '%';

  let details = '';
  if (mistakes.length > 0) {
    details = '<strong>Ошибки:</strong><br>' +
      mistakes.map(m => `${m.turkish} — ${m.russian}`).join('<br>');
  } else {
    details = 'Без ошибок! Ты молодец! 🌟';
  }
  document.getElementById('results-details').innerHTML = details;
  showScreen('screen-results');
}

// ── Flashcards ──────────────────────────────────────
function renderFlashcard() {
  stopSpeech();
  const card = flashDeck[flashIndex];
  renderWordImage(document.getElementById('fc-image-wrap'), card, 'small');
  document.getElementById('fc-category').textContent = card.category;
  document.getElementById('fc-turkish').textContent = card.turkish;
  document.getElementById('fc-russian').textContent = card.russian;
  document.getElementById('flash-progress').textContent = `${flashIndex + 1} / ${flashDeck.length}`;
  document.getElementById('flashcard').classList.remove('flipped');

  const p = getProgress();
  p.flashIndex = flashIndex;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function flipCard() {
  const flipped = document.getElementById('flashcard').classList.toggle('flipped');
  if (flipped) {
    maybeAutoSpeak(flashDeck[flashIndex].turkish);
  }
}

function navigateFlash(dir) {
  flashIndex = Math.max(0, Math.min(flashDeck.length - 1, flashIndex + dir));
  renderFlashcard();
}

function markFlash(know) {
  const word = flashDeck[flashIndex];
  const p = getProgress();
  if (know) {
    if (!p.learned.includes(word.id)) p.learned.push(word.id);
    p.mistakes = p.mistakes.filter(m => m.id !== word.id);
  } else {
    if (!p.mistakes.find(m => m.id === word.id)) {
      p.mistakes.push({ id: word.id, turkish: word.turkish });
    }
  }
  saveProgress(p);
  if (flashIndex < flashDeck.length - 1) {
    flashIndex++;
    renderFlashcard();
  }
}

// ── Utils ───────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

init();
