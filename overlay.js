/**
 * Chess Stream Overlay - Live Display Logic
 * Real-Time Netlify Cloud Sync + Localhost Auto-Fallback
 * Zero External Dependencies (Uses Native EventSource & Fetch)
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
  let activeEventSource = null;

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

    // Connect cloud sync if username was learned
    const user = state.username || params.get('user') || params.get('username');
    if (user && !activeEventSource) {
      initCloudSync(user);
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
    const displayUser = state.username || params.get('user') || params.get('username') || '';
    if (customTitle) {
      if (!displayUser && !params.has('title')) {
        customTitle.textContent = 'SET ?user=YOUR_NAME IN OBS';
      } else {
        customTitle.textContent = settings.customTitle || 'SESSION RECORD';
      }
    }
    if (userTag) {
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

  // 1. Cloud Real-Time Push Listener (Syncs Netlify Control Panel -> OBS in Real-Time)
  function initCloudSync(username) {
    if (!username) return;
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const topic = 'chess-overlay-' + cleanUser;

    // A. Fetch latest state from cloud
    fetch(`https://ntfy.sh/${topic}/json?poll=1`)
      .then(res => res.text())
      .then(text => {
        if (!text) return;
        const lines = text.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const item = JSON.parse(lines[i]);
            if (item.event === 'message' && item.message) {
              const cloudState = JSON.parse(item.message);
              renderState(cloudState);
              break;
            }
          } catch (e) {}
        }
      }).catch(() => {});

    // B. Real-Time Push Events via SSE (EventSource)
    try {
      if (activeEventSource) {
        activeEventSource.close();
      }
      activeEventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
      activeEventSource.onmessage = (e) => {
        try {
          const item = JSON.parse(e.data);
          if (item.event === 'message' && item.message) {
            const cloudState = JSON.parse(item.message);
            renderState(cloudState);
          }
        } catch (err) {}
      };
      activeEventSource.onerror = () => {
        // Automatically reconnects
      };
    } catch (e) {}
  }

  // 2. Local Server Poller (when running localhost)
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
      } catch (e) {}
    }
    return false;
  }

  // 3. Direct Chess.com Game Polling (Runs in OBS directly)
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

  // 4. Same-machine / OBS Custom Dock sync via BroadcastChannel
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

  // Start cloud sync immediately if user param is present in OBS URL
  const initialUser = params.get('user') || params.get('username');
  if (initialUser) {
    initCloudSync(initialUser);
  }

  updateCycle();
  setInterval(updateCycle, 1200);
})();
