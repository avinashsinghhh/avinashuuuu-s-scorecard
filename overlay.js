/**
 * Chess Stream Overlay - Live Display Logic
 * 100% Self-Contained & Resilient (Zero External Dependencies)
 */

(function () {
  const params = new URLSearchParams(window.location.search);

  // DOM elements
  const container = document.getElementById('overlay-container');
  const card = document.getElementById('overlay-card');
  const customTitle = document.getElementById('custom-title');
  const userTag = document.getElementById('user-tag');
  const valWins = document.getElementById('val-wins');
  const valLosses = document.getElementById('val-losses');
  const valDraws = document.getElementById('val-draws');
  const boxDraws = document.getElementById('box-draws');
  const metaRow = document.getElementById('meta-row');
  const ratingBadge = document.getElementById('rating-badge');
  const valRating = document.getElementById('val-rating');
  const valRatingDiff = document.getElementById('val-rating-diff');
  const streakBadge = document.getElementById('streak-badge');
  const streakIcon = document.getElementById('streak-icon');
  const valStreak = document.getElementById('val-streak');
  const winrateBadge = document.getElementById('winrate-badge');
  const valWinrate = document.getElementById('val-winrate');
  const lastGamePreview = document.getElementById('last-game-preview');
  const lastGameText = document.getElementById('last-game-text');
  const eventToast = document.getElementById('event-toast');

  // Built-in Helpers (Zero external dependency)
  function calcWinRate(w, l, d) {
    const total = w + l + d;
    if (total === 0) return '0%';
    return `${Math.round((w / total) * 100)}%`;
  }

  function fmtRatingDiff(diff) {
    if (diff === null || diff === undefined || isNaN(diff)) return '±0';
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '±0';
  }

  let state = {
    username: params.get('user') || params.get('username') || '',
    wins: 0,
    losses: 0,
    draws: 0,
    sessionStartTime: Math.floor(Date.now() / 1000),
    processedGames: [],
    history: [],
    streak: { type: null, count: 0 },
    activeRating: null,
    ratingDiff: 0,
    settings: {
      theme: 'chesscom',
      layout: 'horizontal',
      scale: 100,
      showDraws: true,
      showRating: true,
      showWinRate: true,
      showStreak: true,
      showUsername: true,
      customTitle: 'SESSION RECORD',
      timeClass: 'all',
      ratedOnly: false
    }
  };

  let prevState = { wins: 0, losses: 0, draws: 0 };
  let isFirstLoad = true;

  function applyUrlOverrides(s) {
    const res = { ...s };
    if (params.has('theme')) res.theme = params.get('theme');
    if (params.has('layout')) res.layout = params.get('layout');
    if (params.has('scale')) res.scale = parseFloat(params.get('scale'));
    if (params.has('showDraws')) res.showDraws = params.get('showDraws') === 'true';
    if (params.has('showRating')) res.showRating = params.get('showRating') === 'true';
    if (params.has('showWinRate')) res.showWinRate = params.get('showWinRate') === 'true';
    if (params.has('showStreak')) res.showStreak = params.get('showStreak') === 'true';
    if (params.has('showUsername')) res.showUsername = params.get('showUsername') === 'true';
    if (params.has('title')) res.customTitle = params.get('title');
    return res;
  }

  function showToast(outcome, text) {
    if (!eventToast) return;
    eventToast.className = `event-toast ${outcome} show`;
    eventToast.innerHTML = text;

    setTimeout(() => {
      eventToast.classList.remove('show');
    }, 3500);
  }

  function bumpElement(el) {
    if (!el) return;
    el.classList.remove('animate-bump');
    void el.offsetWidth;
    el.classList.add('animate-bump');
  }

  function renderState(newState) {
    if (!newState) return;
    state = { ...state, ...newState };
    if (newState.settings) {
      state.settings = { ...state.settings, ...newState.settings };
    }

    const settings = applyUrlOverrides(state.settings || {});

    // 1. Theme & Layout classes
    document.body.className = `theme-${settings.theme || 'chesscom'} layout-${settings.layout || 'horizontal'}`;

    // 2. Scale
    if (settings.scale) {
      let scaleVal = settings.scale;
      if (scaleVal > 10) scaleVal = scaleVal / 100;
      document.documentElement.style.setProperty('--scale', scaleVal);
    }

    // 3. Title & Username
    if (customTitle) customTitle.textContent = settings.customTitle || 'SESSION RECORD';
    if (userTag) {
      const displayUser = state.username || params.get('user') || params.get('username') || '';
      if (settings.showUsername && displayUser) {
        userTag.style.display = 'inline-block';
        userTag.textContent = displayUser;
      } else {
        userTag.style.display = 'none';
      }
    }

    const wins = state.wins || 0;
    const losses = state.losses || 0;
    const draws = state.draws || 0;

    // Detect score increments for animations
    if (!isFirstLoad) {
      if (wins > prevState.wins) {
        bumpElement(valWins);
        card.classList.remove('animate-glow-win');
        void card.offsetWidth;
        card.classList.add('animate-glow-win');

        if (state.lastGame) {
          const opp = state.lastGame.oppUsername || 'Opponent';
          const rDiff = state.lastGame.ratingDiff ? ` (+${state.lastGame.ratingDiff})` : '';
          showToast('win', `🏆 VICTORY vs ${opp}${rDiff}`);
        }
      } else if (losses > prevState.losses) {
        bumpElement(valLosses);
        card.classList.remove('animate-glow-loss');
        void card.offsetWidth;
        card.classList.add('animate-glow-loss');

        if (state.lastGame) {
          const opp = state.lastGame.oppUsername || 'Opponent';
          const rDiff = state.lastGame.ratingDiff ? ` (${state.lastGame.ratingDiff})` : '';
          showToast('loss', `💀 DEFEAT vs ${opp}${rDiff}`);
        }
      } else if (draws > prevState.draws) {
        bumpElement(valDraws);
        if (state.lastGame) {
          const opp = state.lastGame.oppUsername || 'Opponent';
          showToast('draw', `🤝 DRAW vs ${opp}`);
        }
      }
    }

    if (valWins) valWins.textContent = wins;
    if (valLosses) valLosses.textContent = losses;
    if (valDraws) valDraws.textContent = draws;

    if (boxDraws) {
      boxDraws.style.display = settings.showDraws !== false ? 'inline-flex' : 'none';
    }

    // Win Rate
    if (winrateBadge && valWinrate) {
      winrateBadge.style.display = settings.showWinRate !== false ? 'block' : 'none';
      valWinrate.textContent = calcWinRate(wins, losses, draws);
    }

    // Streak
    if (streakBadge) {
      const streak = state.streak || { type: null, count: 0 };
      if (settings.showStreak !== false && streak.count > 1) {
        streakBadge.style.display = 'inline-flex';
        if (streak.type === 'win') {
          streakIcon.textContent = '🔥';
          valStreak.textContent = `${streak.count}W`;
        } else if (streak.type === 'loss') {
          streakIcon.textContent = '❄️';
          valStreak.textContent = `${streak.count}L`;
        } else {
          streakIcon.textContent = '🤝';
          valStreak.textContent = `${streak.count}D`;
        }
      } else {
        streakBadge.style.display = 'none';
      }
    }

    // Rating
    if (ratingBadge && valRating && valRatingDiff) {
      if (settings.showRating !== false && state.activeRating) {
        ratingBadge.style.display = 'inline-flex';
        valRating.textContent = state.activeRating;
        const diff = state.ratingDiff || 0;
        valRatingDiff.textContent = fmtRatingDiff(diff);
        valRatingDiff.className = 'rating-diff ' + (diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral');
      } else {
        ratingBadge.style.display = 'none';
      }
    }

    // Last Game preview
    if (lastGamePreview && lastGameText) {
      if (settings.layout === 'card' && state.lastGame) {
        lastGamePreview.style.display = 'flex';
        const lg = state.lastGame;
        const icon = lg.outcome === 'win' ? '🟢' : lg.outcome === 'loss' ? '🔴' : '⚪';
        lastGameText.textContent = `${icon} vs ${lg.oppUsername} (${lg.timeClass})`;
      } else {
        lastGamePreview.style.display = 'none';
      }
    }

    prevState = { wins, losses, draws };
    isFirstLoad = false;
  }

  // Endpoints to try (supports relative, localhost:5050, 127.0.0.1:5050)
  const apiUrls = [
    '/api/state',
    'http://localhost:5050/api/state',
    'http://127.0.0.1:5050/api/state'
  ];

  async function fetchServerState() {
    for (const url of apiUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          renderState(data);
          return true;
        }
      } catch (e) {
        // try next endpoint
      }
    }
    return false;
  }

  // Standalone Direct Polling for Netlify or standalone file
  async function directChesscomPoll() {
    const user = state.username || params.get('user') || params.get('username');
    if (!user) return;

    try {
      const arcRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
      if (!arcRes.ok) return;
      const arcData = await arcRes.json();
      if (!arcData.archives || arcData.archives.length === 0) return;

      const latestUrl = arcData.archives[arcData.archives.length - 1];
      const gamesRes = await fetch(latestUrl);
      if (!gamesRes.ok) return;
      const gamesData = await gamesRes.json();
      const games = gamesData.games || [];
      if (games.length === 0) return;

      const processedSet = new Set(state.processedGames || []);
      const startTime = (state.sessionStartTime || 0) - 300;
      let updated = false;

      for (const g of games) {
        const url = g.url;
        const end = g.end_time || 0;
        if (!url || processedSet.has(url)) continue;
        if (end < startTime) {
          processedSet.add(url);
          continue;
        }

        const userLower = user.toLowerCase();
        const white = g.white || {};
        const black = g.black || {};
        const isWhite = (white.username || '').toLowerCase() === userLower;
        const isBlack = (black.username || '').toLowerCase() === userLower;
        if (!isWhite && !isBlack) continue;

        const myData = isWhite ? white : black;
        const oppData = isWhite ? black : white;
        const myRes = (myData.result || '').toLowerCase();

        let outcome = 'draw';
        if (myRes === 'win') outcome = 'win';
        else if (['checkmated', 'timeout', 'resigned', 'abandoned', 'lose'].includes(myRes)) outcome = 'loss';

        if (outcome === 'win') state.wins = (state.wins || 0) + 1;
        else if (outcome === 'loss') state.losses = (state.losses || 0) + 1;
        else if (outcome === 'draw') state.draws = (state.draws || 0) + 1;

        if (myData.rating) state.activeRating = myData.rating;
        state.lastGame = {
          outcome,
          oppUsername: oppData.username || 'Opponent',
          timeClass: g.time_class || 'chess'
        };
        processedSet.add(url);
        updated = true;
      }

      state.processedGames = Array.from(processedSet).slice(-500);
      if (updated || isFirstLoad) {
        renderState(state);
      }
    } catch (err) {}
  }

  async function updateCycle() {
    const hasServer = await fetchServerState();
    if (!hasServer) {
      try {
        const raw = localStorage.getItem('chess_overlay_state');
        if (raw) {
          renderState(JSON.parse(raw));
        }
      } catch (e) {}

      await directChesscomPoll();
    }
  }

  // Cross-window sync via BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel('chess_overlay_channel');
    bc.onmessage = (e) => {
      if (e.data && e.data.type === 'STATE_UPDATE') {
        renderState(e.data.state);
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'chess_overlay_state' && e.newValue) {
      try {
        renderState(JSON.parse(e.newValue));
      } catch (err) {}
    }
  });

  // Fast 800ms polling cycle
  updateCycle();
  setInterval(updateCycle, 800);
})();
