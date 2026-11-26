let games = [];
let sessions = [];
let favorites = JSON.parse(localStorage.getItem('bg_favorites') || '[]');
let currentUser = JSON.parse(localStorage.getItem('bg_user') || 'null');
let myRequests = JSON.parse(localStorage.getItem('bg_requests') || '[]');
let scores = JSON.parse(localStorage.getItem('bg_scores') || '[{"name":"Игрок 1","points":0},{"name":"Игрок 2","points":0}]');
let state = { search: "", players: null, age: null, time: null, onlyFav: false };

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, 4000);
}

async function fetchData() {
  try {
    const savedGames = localStorage.getItem('bg_games');
    if (savedGames) {
      games = JSON.parse(savedGames);
    } else {
      const res = await fetch('games.json');
      games = await res.json();
      localStorage.setItem('bg_games', JSON.stringify(games));
    }

    const savedSessions = localStorage.getItem('bg_sessions');
    if (savedSessions) {
      sessions = JSON.parse(savedSessions);
    } else {
      sessions = [{
        id: 1,
        game_id: 1,
        game_title: "Кодовые имена",
        host_name: "Алексей",
        session_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' '),
        max_players: 6,
        current_players: 3,
        contacts: "@alex_games"
      }];
      localStorage.setItem('bg_sessions', JSON.stringify(sessions));
    }

    injectExtraFeatures();
    updateAuthUI();
    renderGames(getFilteredGames());
    renderSessions();
    updateGameSelect();
  } catch (err) {
    showToast(`Ошибка загрузки: ${err.message}`, 'error');
  }
}

function injectExtraFeatures() {
  if (document.getElementById('randomGameBtn')) return;
  const seoHeader = document.querySelector('.seo-header');
  if (seoHeader) {
    const toolsBar = document.createElement('div');
    toolsBar.style.cssText = "display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;";
    toolsBar.innerHTML = `
      <button id="randomGameBtn" class="btn-primary" style="background: linear-gradient(135deg, #8b5cf6, #06b6d4);">🎲 Случайная игра</button>
      <button id="favFilterBtn" class="btn-outline">❤️ Моя полка (${favorites.length})</button>
      <button id="openScoreBtn" class="btn-outline">🧮 Счётчик очков</button>
    `;
    seoHeader.appendChild(toolsBar);

    document.getElementById('randomGameBtn').addEventListener('click', pickRandomGame);
    document.getElementById('favFilterBtn').addEventListener('click', () => {
      state.onlyFav = !state.onlyFav;
      const btn = document.getElementById('favFilterBtn');
      btn.style.borderColor = state.onlyFav ? 'var(--accent)' : 'var(--border)';
      btn.style.color = state.onlyFav ? 'var(--accent)' : 'var(--text)';
      renderGames(getFilteredGames());
    });
    document.getElementById('openScoreBtn').addEventListener('click', openScoreModal);
  }
}
function openScoreModal() {
  let modal = document.getElementById('scoreModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scoreModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <h2>🧮 Счётчик очков партии</h2>
        <div id="scoreList" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;"></div>
        <div style="display:flex; gap:8px; margin-bottom:20px;">
          <input id="newPlayerName" class="search-input" placeholder="Имя игрока..." style="padding:8px 12px;">
          <button id="addPlayerScoreBtn" class="btn-primary" style="padding:8px 16px;">+ Игрок</button>
        </div>
        <div class="modal-actions">
          <button id="resetScoresBtn" class="btn-outline" style="color:#ef4444; border-color:#ef4444;">Сбросить</button>
          <button id="closeScoreModalBtn" class="btn-primary">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeScoreModalBtn').addEventListener('click', () => modal.classList.remove('open'));
    document.getElementById('addPlayerScoreBtn').addEventListener('click', () => {
      const inp = document.getElementById('newPlayerName');
      if (!inp.value.trim()) return;
      scores.push({ name: inp.value.trim(), points: 0 });
      inp.value = '';
      saveAndRenderScores();
    });
    document.getElementById('resetScoresBtn').addEventListener('click', () => {
      scores = scores.map(s => ({ ...s, points: 0 }));
      saveAndRenderScores();
    });
  }
  saveAndRenderScores();
  modal.classList.add('open');
}

function saveAndRenderScores() {
  localStorage.setItem('bg_scores', JSON.stringify(scores));
  const list = document.getElementById('scoreList');
  if (!list) return;
  list.innerHTML = scores.map((s, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:10px 14px; border-radius:10px; border:1px solid var(--border);">
      <strong>${s.name}</strong>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn-outline" style="padding:4px 10px;" onclick="changeScore(${idx}, -1)">-1</button>
        <span style="min-width:30px; text-align:center; font-weight:800; color:var(--accent); font-size:1.1rem;">${s.points}</span>
        <button class="btn-outline" style="padding:4px 10px;" onclick="changeScore(${idx}, 1)">+1</button>
        <button class="btn-outline" style="padding:4px 10px;" onclick="changeScore(${idx}, 5)">+5</button>
        <button class="btn-text" style="color:#ef4444;" onclick="removeScorePlayer(${idx})">✕</button>
      </div>
    </div>
  `).join('');
}

function changeScore(idx, delta) {
  scores[idx].points += delta;
  saveAndRenderScores();
}

function removeScorePlayer(idx) {
  scores.splice(idx, 1);
  saveAndRenderScores();
}

function pickRandomGame() {
  const list = getFilteredGames();
  if (!list.length) {
    showToast("Нет игр по текущим фильтрам!", "error");
    return;
  }
  const random = list[Math.floor(Math.random() * list.length)];
  showToast(`🎲 Выпала игра: «${random.title}» (${random.min_players}-${random.max_players} чел.)`, "success");
  renderGames([random]);
}

function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(f => f !== id);
    showToast("Убрано из избранного", "success");
  } else {
    favorites.push(id);
    showToast("Добавлено на вашу полку ❤️", "success");
  }
  localStorage.setItem('bg_favorites', JSON.stringify(favorites));
  const favBtn = document.getElementById('favFilterBtn');
  if (favBtn) favBtn.textContent = `❤️ Моя полка (${favorites.length})`;
  renderGames(getFilteredGames());
}

function updateAuthUI() {
  const authBlock = document.getElementById('authBlock');
  const profileBlock = document.getElementById('profileBlock');
  const userName = document.getElementById('userName');
  const adminBtn = document.getElementById('openAdminPanelBtn');
  const addGameBtn = document.getElementById('openAddModalBtn');

  if (currentUser) {
    authBlock.style.display = 'none';
    profileBlock.style.display = 'flex';
    userName.textContent = `👋 ${currentUser.username}`;
    const isAdmin = currentUser.role === 'admin';
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (addGameBtn) addGameBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    authBlock.style.display = 'flex';
    profileBlock.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    if (addGameBtn) addGameBtn.style.display = 'none';
  }
}

function getFilteredGames() {
  return games.filter(g => {
    if (state.onlyFav && !favorites.includes(g.id)) return false;
    if (state.search && !g.title.toLowerCase().includes(state.search.toLowerCase())) return false;
    const min = parseInt(g.min_players), max = parseInt(g.max_players);
    if (state.players === "2" && !(min <= 2 && max >= 2)) return false;
    if (state.players === "3-4" && (max < 3 || min > 4)) return false;
    if (state.players === "5-7" && (max < 5 || min > 7)) return false;
    if (state.players === "8+" && max < 8) return false;
    if (state.age && g.age > parseInt(state.age)) return false;
    if (state.time === "fast" && g.time > 20) return false;
    if (state.time === "medium" && (g.time <= 20 || g.time > 60)) return false;
    if (state.time === "long" && g.time <= 60) return false;
    return true;
  });
}

function renderGames(list) {
  const grid = document.getElementById("gamesGrid");
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Ничего не найдено. Нажмите «Сбросить».</div>`;
    return;
  }

  grid.innerHTML = list.map(g => {
    const canDelete = currentUser && currentUser.role === 'admin';
    const isFav = favorites.includes(g.id);
    return `
    <article class="card">
      <div class="card-header-placeholder" style="position: relative;">
        <span>${g.title.charAt(0).toUpperCase()}</span>
        <button onclick="toggleFavorite(${g.id})" title="В избранное" style="position: absolute; top: 12px; right: 12px; background: rgba(15,23,42,0.6); padding: 6px 10px; border-radius: 50%; font-size: 1.1rem;">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="card-body">
        <h2 class="card-title">${g.title}</h2>
        <div class="specs">
          <span>👥 ${g.min_players}-${g.max_players}</span>
          <span>🎂 ${g.age}+</span>
          <span>⏱ ${g.time} мин</span>
        </div>
        <p class="card-desc">${g.description || ''}</p>
        <div class="card-tags">
          ${g.tags.split(',').map(t => `<span class="card-tag">#${t.trim()}</span>`).join('')}
        </div>
        ${canDelete ? `<button class="btn-outline" style="margin-top:10px; padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteGame(${g.id})">Удалить (Админ)</button>` : ''}
      </div>
    </article>
  `}).join('');
}
function copyInvite(sessionId) {
  const s = sessions.find(item => item.id === sessionId);
  if (!s) return;
  const text = `🎲 Собираемся играть в «${s.game_title}»!\n👤 Организатор: ${s.host_name}\n📅 Когда: ${s.session_date}\n👥 Мест: ${s.current_players}/${s.max_players}\n📞 Связь: ${s.contacts}`;
  navigator.clipboard.writeText(text);
  showToast("Приглашение скопировано! Отправьте его друзьям в чат.", "success");
}

function renderSessions() {
  const grid = document.getElementById("sessionsGrid");
  if (!sessions.length) {
    grid.innerHTML = `<p style="text-align: center; color: #94a3b8;">Пока нет активных партий. Создайте первую!</p>`;
    return;
  }

  grid.innerHTML = sessions.map(s => {
    const isFull = parseInt(s.current_players) >= parseInt(s.max_players);
    const isJoined = myRequests.includes(s.id);
    let btnHTML = '';

    if (isJoined) {
      btnHTML = `<button class="btn-primary" disabled style="width:100%; margin-top:12px;">✅ Вы записаны!</button>`;
    } else if (isFull) {
      btnHTML = `<button class="btn-outline" disabled style="width:100%; margin-top:12px; opacity:0.5;">Мест нет</button>`;
    } else {
      btnHTML = `<button class="btn-primary join-btn" onclick="applySession(${s.id})">Присоединиться к игре</button>`;
    }

    return `
      <div class="session-card">
        <h3>🎲 ${s.game_title}</h3>
        <div class="session-info">👤 Хост: <strong>${s.host_name}</strong></div>
        <div class="session-info">📅 Когда: <strong>${s.session_date}</strong></div>
        <div class="session-info">👥 Игроков: <strong>${s.current_players} / ${s.max_players}</strong></div>
        <div class="session-info">📞 Связь: ${s.contacts}</div>
        ${btnHTML}
        <button class="btn-outline" onclick="copyInvite(${s.id})" style="width:100%; margin-top:8px; font-size: 0.85rem;">📋 Скопировать приглашение в чат</button>
      </div>
    `;
  }).join('');
}

function applyFilters() {
  state.search = document.getElementById("searchInput").value;
  renderGames(getFilteredGames());
}

function resetFilters() {
  state = { search: "", players: null, age: null, time: null, onlyFav: false };
  document.getElementById("searchInput").value = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
  const favBtn = document.getElementById('favFilterBtn');
  if (favBtn) {
    favBtn.style.borderColor = 'var(--border)';
    favBtn.style.color = 'var(--text)';
  }
  renderGames(getFilteredGames());
}

function applySession(id) {
  const session = sessions.find(s => s.id === id);
  if (session && session.current_players < session.max_players) {
    session.current_players += 1;
    myRequests.push(id);
    localStorage.setItem('bg_sessions', JSON.stringify(sessions));
    localStorage.setItem('bg_requests', JSON.stringify(myRequests));
    showToast("Вы успешно записались на партию!", "success");
    renderSessions();
  }
}

function deleteGame(id) {
  if (!confirm("Удалить эту игру из каталога?")) return;
  games = games.filter(g => g.id !== id);
  localStorage.setItem('bg_games', JSON.stringify(games));
  showToast("Игра удалена", "success");
  renderGames(getFilteredGames());
  updateGameSelect();
}

function updateGameSelect() {
  const select = document.getElementById("sGameId");
  if (select) select.innerHTML = games.map(g => `<option value="${g.id}">${g.title}</option>`).join('');
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Section").classList.add("active");
  });
});

document.getElementById("logoResetBtn")?.addEventListener("click", resetFilters);
document.getElementById("searchInput")?.addEventListener("input", applyFilters);
document.getElementById("resetFiltersBtn")?.addEventListener("click", resetFilters);

["playersFilter", "ageFilter", "timeFilter"].forEach(groupId => {
  const key = groupId.replace("Filter", "");
  document.getElementById(groupId)?.addEventListener("click", e => {
    if (!e.target.classList.contains("chip")) return;
    const val = e.target.dataset.val;
    state[key] = state[key] === val ? null : val;
    document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.toggle("selected", c.dataset.val === state[key]));
    applyFilters();
  });
});

document.getElementById("openAddModalBtn")?.addEventListener("click", () => document.getElementById("addModal").classList.add("open"));
document.getElementById("closeAddModalBtn")?.addEventListener("click", () => document.getElementById("addModal").classList.remove("open"));
document.getElementById("openCreateSessionBtn")?.addEventListener("click", () => document.getElementById("createSessionModal").classList.add("open"));
document.getElementById("closeCreateSessionBtn")?.addEventListener("click", () => document.getElementById("createSessionModal").classList.remove("open"));
document.getElementById("openLoginBtn")?.addEventListener("click", () => document.getElementById("loginModal").classList.add("open"));
document.getElementById("closeLoginModalBtn")?.addEventListener("click", () => document.getElementById("loginModal").classList.remove("open"));
document.getElementById("openRegisterBtn")?.addEventListener("click", () => document.getElementById("registerModal").classList.add("open"));
document.getElementById("closeRegisterModalBtn")?.addEventListener("click", () => document.getElementById("registerModal").classList.remove("open"));

document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const isAdmin = email.toLowerCase().includes("admin");
  currentUser = {
    username: isAdmin ? "Администратор" : email.split('@')[0],
    email: email,
    role: isAdmin ? "admin" : "user"
  };
  localStorage.setItem('bg_user', JSON.stringify(currentUser));
  showToast(`Вход выполнен (${isAdmin ? 'Режим Админа' : 'Игрок'})`, "success");
  document.getElementById("loginModal").classList.remove("open");
  e.target.reset();
  updateAuthUI();
  renderGames(getFilteredGames());
});

document.getElementById("registerForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  currentUser = {
    username: document.getElementById("regUsername").value,
    email: document.getElementById("regEmail").value,
    role: "user"
  };
  localStorage.setItem('bg_user', JSON.stringify(currentUser));
  showToast(`Добро пожаловать, ${currentUser.username}!`, "success");
  document.getElementById("registerModal").classList.remove("open");
  e.target.reset();
  updateAuthUI();
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem('bg_user');
  showToast("Вы вышли из аккаунта", "success");
  updateAuthUI();
  renderGames(getFilteredGames());
});

document.getElementById("addGameForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const newGame = {
    id: Date.now(),
    title: document.getElementById("gTitle").value,
    min_players: parseInt(document.getElementById("gMinP").value),
    max_players: parseInt(document.getElementById("gMaxP").value),
    age: parseInt(document.getElementById("gAge").value),
    time: parseInt(document.getElementById("gTime").value),
    tags: document.getElementById("gTags").value || "настолка",
    description: document.getElementById("gDesc").value
  };
  games.unshift(newGame);
  localStorage.setItem('bg_games', JSON.stringify(games));
  showToast("Игра добавлена в каталог!", "success");
  document.getElementById("addModal").classList.remove("open");
  e.target.reset();
  renderGames(getFilteredGames());
  updateGameSelect();
});

document.getElementById("createSessionForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const gameId = parseInt(document.getElementById("sGameId").value);
  const game = games.find(g => g.id === gameId);
  const newSession = {
    id: Date.now(),
    game_id: gameId,
    game_title: game ? game.title : "Настольная игра",
    host_name: document.getElementById("sHostName").value,
    session_date: document.getElementById("sDate").value.replace('T', ' '),
    max_players: parseInt(document.getElementById("sMaxPlayers").value),
    current_players: 1,
    contacts: document.getElementById("sContacts").value
  };
  sessions.unshift(newSession);
  localStorage.setItem('bg_sessions', JSON.stringify(sessions));
  showToast("Партия создана! Можете скопировать приглашение.", "success");
  document.getElementById("createSessionModal").classList.remove("open");
  e.target.reset();
  renderSessions();
});

fetchData();
