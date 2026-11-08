/**
 * Chess Stream Overlay - Streamer Controller Logic
 */

(function () {
  // DOM Elements
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const obsUrlInput = document.getElementById('obs-url-input');
  const btnCopyObs = document.getElementById('btn-copy-obs');

  const inputWins = document.getElementById('input-wins');
  const inputLosses = document.getElementById('input-losses');
  const inputDraws = document.getElementById('input-draws');

  const btnWinPlus = document.getElementById('btn-win-plus');
  const btnWinMinus = document.getElementById('btn-win-minus');
  const btnLossPlus = document.getElementById('btn-loss-plus');
  const btnLossMinus = document.getElementById('btn-loss-minus');
  const btnDrawPlus = document.getElementById('btn-draw-plus');
  const btnDrawMinus = document.getElementById('btn-draw-minus');

  const btnReset = document.getElementById('btn-reset-session');
  const btnUndo = document.getElementById('btn-undo-game');
  const btnImportLatest = document.getElementById('btn-import-latest');

  const btnTestWin = document.getElementById('btn-test-win');
  const btnTestLoss = document.getElementById('btn-test-loss');
  const btnTestDraw = document.getElementById('btn-test-draw');

  const inputUsername = document.getElementById('input-username');
  const btnSaveUsername = document.getElementById('btn-save-username');
  const userStatusText = document.getElementById('user-status-text');

  const selectTimeClass = document.getElementById('select-time-class');
  const inputTitle = document.getElementById('input-title');
  const checkRatedOnly = document.getElementById('check-rated-only');
  const checkShowDraws = document.getElementById('check-show-draws');
  const checkShowRating = document.getElementById('check-show-rating');
  const checkShowWinrate = document.getElementById('check-show-winrate');
  const checkShowStreak = document.getElementById('check-show-streak');
  const checkShowUsername = document.getElementById('check-show-username');

  const selectTheme = document.getElementById('select-theme');
  const selectLayout = document.getElementById('select-layout');
  const rangeScale = document.getElementById('range-scale');
  const scaleValueLabel = document.getElementById('scale-value-label');

  const previewIframe = document.getElementById('preview-iframe');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const toastMsg = document.getElementById('toast-msg');

  const chesscomRecentList = document.getElementById('chesscom-recent-list');
  const btnRefreshRecent = document.getElementById('btn-refresh-recent');

  // State
  let isServerConnected = false;
  let broadcastChannel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('chess_overlay_channel');
  }

  let currentState = {
    username: '',
    wins: 0,
    losses: 0,
    draws: 0,
    sessionStartTime: Math.floor(Date.now() / 1000),
    history: [],
    processedGames: [],
    settings: {
      timeClass: 'all',
      ratedOnly: false,
      theme: 'chesscom',
      layout: 'horizontal',
      showDraws: true,
      showRating: true,
      showWinRate: true,
      showStreak: true,
      showUsername: true,
      customTitle: 'SESSION RECORD',
      scale: 100
    }
  };

  function showToast(text) {
    if (!toastMsg) return;
    toastMsg.textContent = text;
    toastMsg.classList.add('show');
    setTimeout(() => {
      toastMsg.classList.remove('show');
    }, 2800);
  }

  function updateObsUrl() {
    let base = 'http://localhost:5050/overlay.html';
    if (window.location.protocol.startsWith('http')) {
      base = `${window.location.origin}/overlay.html`;
    }
    const user = currentState.username || inputUsername.value.trim();
    if (user && !base.includes('localhost')) {
      base += `?user=${encodeURIComponent(user)}`;
    }
    obsUrlInput.value = base;
  }
  updateObsUrl();

  btnCopyObs.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(obsUrlInput.value);
      showToast('📋 OBS Browser Source URL copied to clipboard!');
    } catch (err) {
      obsUrlInput.select();
      document.execCommand('copy');
      showToast('📋 Copied to clipboard!');
    }
  });

  function updateUI(state) {
    currentState = state;

    if (document.activeElement !== inputWins) {
      inputWins.value = state.wins || 0;
    }
    if (document.activeElement !== inputLosses) {
      inputLosses.value = state.losses || 0;
    }
    if (document.activeElement !== inputDraws) {
      inputDraws.value = state.draws || 0;
    }

    if (document.activeElement !== inputUsername && state.username) {
      inputUsername.value = state.username;
    }

    const s = state.settings || {};
    if (document.activeElement !== selectTimeClass && s.timeClass) {
      selectTimeClass.value = s.timeClass;
    }
    if (document.activeElement !== inputTitle && s.customTitle !== undefined) {
      inputTitle.value = s.customTitle;
    }

    checkRatedOnly.checked = !!s.ratedOnly;
    checkShowDraws.checked = s.showDraws !== false;
    checkShowRating.checked = s.showRating !== false;
    checkShowWinrate.checked = s.showWinRate !== false;
    checkShowStreak.checked = s.showStreak !== false;
    checkShowUsername.checked = s.showUsername !== false;

    if (document.activeElement !== selectTheme && s.theme) {
      selectTheme.value = s.theme;
    }
    if (document.activeElement !== selectLayout && s.layout) {
      selectLayout.value = s.layout;
    }
    if (s.scale) {
      rangeScale.value = s.scale;
      scaleValueLabel.textContent = `${s.scale}%`;
    }

    if (state.username) {
      userStatusText.innerHTML = `<span>Tracking live: <strong>${state.username}</strong></span><span style="color:var(--win);">● Active</span>`;
    } else {
      userStatusText.innerHTML = `<span>Enter username and click Set Player.</span>`;
    }

    renderHistory(state.history || []);

    try {
      localStorage.setItem('chess_overlay_state', JSON.stringify(state));
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'STATE_UPDATE', state });
      }
      sendWebRTCUpdate(state);
    } catch (e) {}
  }

  // WebRTC remote sync for Netlify hosting
  let webrtcPeer = null;
  let webrtcConn = null;

  function sendWebRTCUpdate(state) {
    const user = (state.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!user || typeof Peer === 'undefined') return;

    if (!webrtcConn || !webrtcConn.open) {
      if (!webrtcPeer || webrtcPeer.destroyed) {
        webrtcPeer = new Peer();
        webrtcPeer.on('open', () => {
          webrtcConn = webrtcPeer.connect('chess-obs-' + user);
          webrtcConn.on('open', () => {
            webrtcConn.send({ type: 'STATE_UPDATE', state });
          });
        });
      } else if (webrtcPeer.open) {
        webrtcConn = webrtcPeer.connect('chess-obs-' + user);
        webrtcConn.on('open', () => {
          webrtcConn.send({ type: 'STATE_UPDATE', state });
        });
      }
    } else {
      webrtcConn.send({ type: 'STATE_UPDATE', state });
    }
  }

  function renderHistory(history) {
    historyCount.textContent = `${history.length} games`;
    if (!history || history.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 25px; font-size: 13px;">
          No games in this session yet.<br>Click "Sync / Import Latest Game" or play on Chess.com!
        </div>`;
      return;
    }

    const reversed = [...history].reverse();
    historyList.innerHTML = reversed.map(game => {
      const outcome = (game.outcome || 'draw').toLowerCase();
      const opp = game.oppUsername || 'Opponent';
      const tc = game.timeClass || 'chess';
      const rDiff = game.ratingDiff ? (game.ratingDiff > 0 ? `+${game.ratingDiff}` : `${game.ratingDiff}`) : '';
      const rDiffBadge = rDiff ? `<span style="font-weight:700; color:${game.ratingDiff > 0 ? 'var(--win)' : 'var(--loss)'};">${rDiff}</span>` : '';
      const gameLink = game.url ? `<a href="${game.url}" target="_blank" style="color:var(--accent); text-decoration:none; font-size:11px;">view ↗</a>` : '';

      return `
        <div class="history-item">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="history-badge ${outcome}">${outcome}</span>
            <span class="history-opp">vs ${opp}</span>
            <span class="history-meta">(${tc})</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${rDiffBadge}
            ${gameLink}
          </div>
        </div>
      `;
    }).join('');
  }

  async function callApi(endpoint, method = 'POST', body = null) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      };
      if (body) options.body = JSON.stringify(body);

      const res = await fetch(endpoint, options);
      if (res.ok) {
        setServerConnected(true);
        return await res.json();
      }
    } catch (err) {
      setServerConnected(false);
    }
    return null;
  }

  function setServerConnected(connected) {
    isServerConnected = connected;
    if (connected) {
      statusBadge.style.color = 'var(--win)';
      statusBadge.style.background = 'rgba(34, 197, 94, 0.1)';
      statusBadge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      statusText.textContent = 'Server Connected (Live Sync)';
    } else {
      statusBadge.style.color = '#38bdf8';
      statusBadge.style.background = 'rgba(56, 189, 248, 0.1)';
      statusBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      statusText.textContent = 'Browser Tracking (Active)';
    }
  }

  // Fetch recent games directly from Chess.com API in browser
  async function fetchChesscomGamesDirect(username) {
    if (!username) return [];
    try {
      // 1. Get archives list
      const arcRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`);
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        if (arcData.archives && arcData.archives.length > 0) {
          const latestArchiveUrl = arcData.archives[arcData.archives.length - 1];
          const gamesRes = await fetch(latestArchiveUrl);
          if (gamesRes.ok) {
            const gamesData = await gamesRes.json();
            return gamesData.games || [];
          }
        }
      }
    } catch (e) {
      console.warn('Direct Chess.com fetch error:', e);
    }
    return [];
  }

  // Update Recent Games panel
  async function refreshRecentChesscomGames() {
    const user = currentState.username || inputUsername.value.trim();
    if (!user) {
      chesscomRecentList.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 10px;">Enter your username above to view matches.</div>`;
      return;
    }

    chesscomRecentList.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 10px;">Fetching matches from Chess.com...</div>`;

    let games = [];
    if (isServerConnected) {
      const res = await fetch('/api/latest-games', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        games = data.games || [];
      }
    }

    if (games.length === 0) {
      const rawGames = await fetchChesscomGamesDirect(user);
      const sessionUrls = new Set((currentState.history || []).map(h => h.url));
      games = rawGames.slice(-10).reverse().map(g => {
        const p = parseChessGame(g, user);
        if (p) p.inSession = sessionUrls.has(p.url);
        return p;
      }).filter(Boolean);
    }

    if (games.length === 0) {
      chesscomRecentList.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 10px;">No recent matches found for "${user}".</div>`;
      return;
    }

    chesscomRecentList.innerHTML = games.map(g => {
      const outcome = (g.outcome || 'draw').toLowerCase();
      const inSession = g.inSession;
      const addBtn = inSession
        ? `<span style="font-size: 11px; color: var(--win); font-weight: 700;">✓ In Session</span>`
        : `<button class="btn-step btn-add-match" data-url="${g.url}" style="font-size: 11px; padding: 3px 8px; width: auto; background: #0284c7; color: white; border: none;">+ Add to Session</button>`;

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="history-badge ${outcome}">${outcome}</span>
            <span style="font-weight: 600;">vs ${g.oppUsername}</span>
            <span style="color: var(--text-muted); font-size: 10px;">(${g.timeClass})</span>
          </div>
          <div>
            ${addBtn}
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners to + Add buttons
    chesscomRecentList.querySelectorAll('.btn-add-match').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const url = e.target.getAttribute('data-url');
        await importGameByUrl(url);
      });
    });
  }

  btnRefreshRecent.addEventListener('click', refreshRecentChesscomGames);

  // In-Browser Direct Poller (Fallback when Python server is not running)
  async function inBrowserDirectPoll() {
    if (isServerConnected) return; // server is doing the work
    const username = currentState.username;
    if (!username) return;

    const games = await fetchChesscomGamesDirect(username);
    if (!games || games.length === 0) return;

    const processedSet = new Set(currentState.processedGames || []);
    const startTime = (currentState.sessionStartTime || 0) - 300; // 5m grace
    const timeClassFilter = currentState.settings?.timeClass || 'all';
    const ratedOnly = !!currentState.settings?.ratedOnly;

    let updated = false;
    for (const g of games) {
      const url = g.url;
      const end = g.end_time || 0;
      if (!url || processedSet.has(url)) continue;
      if (end < startTime) {
        processedSet.add(url);
        continue;
      }

      const parsed = parseChessGame(g, username);
      if (!parsed) continue;
      if (ratedOnly && !parsed.rated) {
        processedSet.add(url);
        continue;
      }
      if (timeClassFilter !== 'all' && parsed.timeClass !== timeClassFilter) {
        processedSet.add(url);
        continue;
      }

      // Add to score!
      if (parsed.outcome === 'win') currentState.wins = (currentState.wins || 0) + 1;
      else if (parsed.outcome === 'loss') currentState.losses = (currentState.losses || 0) + 1;
      else if (parsed.outcome === 'draw') currentState.draws = (currentState.draws || 0) + 1;

      currentState.lastGame = parsed;
      currentState.history = currentState.history || [];
      currentState.history.push(parsed);
      processedSet.add(url);
      updated = true;
    }

    currentState.processedGames = Array.from(processedSet).slice(-500);
    if (updated) {
      updateUI(currentState);
      showToast('⚡ New match detected & updated from Chess.com!');
      refreshRecentChesscomGames();
    }
  }

  async function importGameByUrl(url = null) {
    if (isServerConnected) {
      const res = await callApi('/api/import-game', 'POST', { url });
      if (res && res.success) {
        showToast(`📥 Imported game vs ${res.game.oppUsername}!`);
        await pollServer();
        refreshRecentChesscomGames();
        return;
      } else if (res && res.message) {
        showToast(res.message);
        return;
      }
    }

    // Direct Browser import
    const username = currentState.username;
    if (!username) {
      alert('Please set your Chess.com username first');
      return;
    }

    const games = await fetchChesscomGamesDirect(username);
    let target = null;
    if (url) {
      target = games.find(g => g.url === url);
    } else {
      target = games[games.length - 1];
    }

    if (!target) {
      showToast('No game found on Chess.com');
      return;
    }

    const parsed = parseChessGame(target, username);
    if (!parsed) {
      showToast('Could not parse game');
      return;
    }

    // Check if in history
    if ((currentState.history || []).some(h => h.url === parsed.url)) {
      showToast('This game is already counted in your session');
      return;
    }

    if (parsed.outcome === 'win') currentState.wins = (currentState.wins || 0) + 1;
    else if (parsed.outcome === 'loss') currentState.losses = (currentState.losses || 0) + 1;
    else if (parsed.outcome === 'draw') currentState.draws = (currentState.draws || 0) + 1;

    currentState.lastGame = parsed;
    currentState.history = currentState.history || [];
    currentState.history.push(parsed);

    const pSet = new Set(currentState.processedGames || []);
    pSet.add(parsed.url);
    currentState.processedGames = Array.from(pSet);

    updateUI(currentState);
    showToast(`📥 Imported ${parsed.outcome.toUpperCase()} vs ${parsed.oppUsername}!`);
    refreshRecentChesscomGames();
  }

  btnImportLatest.addEventListener('click', () => importGameByUrl(null));

  async function pollServer() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (res.ok) {
        setServerConnected(true);
        const data = await res.json();
        updateUI(data);
        return;
      }
    } catch (e) {
      setServerConnected(false);
    }

    // Fallback: check localStorage
    try {
      const raw = localStorage.getItem('chess_overlay_state');
      if (raw) {
        updateUI(JSON.parse(raw));
      }
    } catch (e) {}

    // Run direct browser polling
    inBrowserDirectPoll();
  }

  async function adjustScore(type, delta) {
    if (isServerConnected) {
      const res = await callApi('/api/manual', 'POST', { type, delta });
      if (res && res.state) {
        updateUI(res.state);
        return;
      }
    }

    if (type === 'win') currentState.wins = Math.max(0, (currentState.wins || 0) + delta);
    if (type === 'loss') currentState.losses = Math.max(0, (currentState.losses || 0) + delta);
    if (type === 'draw') currentState.draws = Math.max(0, (currentState.draws || 0) + delta);
    updateUI(currentState);
  }

  async function setManualScores() {
    const wins = parseInt(inputWins.value, 10) || 0;
    const losses = parseInt(inputLosses.value, 10) || 0;
    const draws = parseInt(inputDraws.value, 10) || 0;

    if (isServerConnected) {
      const res = await callApi('/api/manual', 'POST', { wins, losses, draws });
      if (res && res.state) {
        updateUI(res.state);
        showToast('Scores manually updated');
        return;
      }
    }

    currentState.wins = wins;
    currentState.losses = losses;
    currentState.draws = draws;
    updateUI(currentState);
    showToast('Scores manually updated');
  }

  btnWinPlus.addEventListener('click', () => adjustScore('win', 1));
  btnWinMinus.addEventListener('click', () => adjustScore('win', -1));
  btnLossPlus.addEventListener('click', () => adjustScore('loss', 1));
  btnLossMinus.addEventListener('click', () => adjustScore('loss', -1));
  btnDrawPlus.addEventListener('click', () => adjustScore('draw', 1));
  btnDrawMinus.addEventListener('click', () => adjustScore('draw', -1));

  inputWins.addEventListener('change', setManualScores);
  inputLosses.addEventListener('change', setManualScores);
  inputDraws.addEventListener('change', setManualScores);

  btnReset.addEventListener('click', async () => {
    const confirmReset = confirm('Are you sure you want to reset this session score to 0-0-0?');
    if (!confirmReset) return;

    if (isServerConnected) {
      await callApi('/api/reset', 'POST', { clearHistory: false });
      await pollServer();
    } else {
      currentState.wins = 0;
      currentState.losses = 0;
      currentState.draws = 0;
      currentState.sessionStartTime = Math.floor(Date.now() / 1000);
      updateUI(currentState);
    }
    showToast('🔄 Session reset to 0-0-0!');
    refreshRecentChesscomGames();
  });

  btnUndo.addEventListener('click', async () => {
    if (isServerConnected) {
      const res = await callApi('/api/undo', 'POST');
      if (res && res.success) {
        showToast(`Undid last game vs ${res.undone.oppUsername || 'Opponent'}`);
        await pollServer();
        refreshRecentChesscomGames();
      } else {
        showToast('No game to undo');
      }
    } else {
      if (currentState.history && currentState.history.length > 0) {
        const last = currentState.history.pop();
        if (last.outcome === 'win') currentState.wins = Math.max(0, currentState.wins - 1);
        if (last.outcome === 'loss') currentState.losses = Math.max(0, currentState.losses - 1);
        if (last.outcome === 'draw') currentState.draws = Math.max(0, currentState.draws - 1);
        updateUI(currentState);
        showToast('Undid last game');
        refreshRecentChesscomGames();
      } else {
        showToast('No game to undo');
      }
    }
  });

  btnTestWin.addEventListener('click', async () => {
    if (isServerConnected) {
      await callApi('/api/test-event', 'POST', { outcome: 'win' });
      await pollServer();
    } else {
      adjustScore('win', 1);
    }
    showToast('🧪 Test Win triggered!');
  });

  btnTestLoss.addEventListener('click', async () => {
    if (isServerConnected) {
      await callApi('/api/test-event', 'POST', { outcome: 'loss' });
      await pollServer();
    } else {
      adjustScore('loss', 1);
    }
    showToast('🧪 Test Loss triggered!');
  });

  btnTestDraw.addEventListener('click', async () => {
    if (isServerConnected) {
      await callApi('/api/test-event', 'POST', { outcome: 'draw' });
      await pollServer();
    } else {
      adjustScore('draw', 1);
    }
    showToast('🧪 Test Draw triggered!');
  });

  async function saveSettings(extra = {}) {
    const settings = {
      ...currentState.settings,
      timeClass: selectTimeClass.value,
      customTitle: inputTitle.value,
      ratedOnly: checkRatedOnly.checked,
      showDraws: checkShowDraws.checked,
      showRating: checkShowRating.checked,
      showWinRate: checkShowWinrate.checked,
      showStreak: checkShowStreak.checked,
      showUsername: checkShowUsername.checked,
      theme: selectTheme.value,
      layout: selectLayout.value,
      scale: parseInt(rangeScale.value, 10),
      ...extra
    };

    if (isServerConnected) {
      await callApi('/api/settings', 'POST', { settings });
      await pollServer();
    } else {
      currentState.settings = settings;
      updateUI(currentState);
    }

    if (previewIframe && previewIframe.contentWindow) {
      previewIframe.contentWindow.location.reload();
    }
  }

  btnSaveUsername.addEventListener('click', async () => {
    const user = inputUsername.value.trim();
    if (!user) {
      alert('Please enter a valid Chess.com username');
      return;
    }

    if (isServerConnected) {
      await callApi('/api/settings', 'POST', { username: user });
      showToast(`Chess.com player set to: ${user}`);
      await pollServer();
    } else {
      currentState.username = user;
      updateUI(currentState);
      showToast(`Tracking set for: ${user}`);
    }
    updateObsUrl();
    refreshRecentChesscomGames();
  });

  inputUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSaveUsername.click();
  });

  selectTimeClass.addEventListener('change', () => saveSettings());
  inputTitle.addEventListener('change', () => saveSettings());
  checkRatedOnly.addEventListener('change', () => saveSettings());
  checkShowDraws.addEventListener('change', () => saveSettings());
  checkShowRating.addEventListener('change', () => saveSettings());
  checkShowWinrate.addEventListener('change', () => saveSettings());
  checkShowStreak.addEventListener('change', () => saveSettings());
  checkShowUsername.addEventListener('change', () => saveSettings());
  selectTheme.addEventListener('change', () => saveSettings());
  selectLayout.addEventListener('change', () => saveSettings());

  rangeScale.addEventListener('input', () => {
    scaleValueLabel.textContent = `${rangeScale.value}%`;
  });
  rangeScale.addEventListener('change', () => saveSettings());

  // Initial poll & periodic poll
  pollServer().then(() => {
    refreshRecentChesscomGames();
  });
  setInterval(pollServer, 3000);
})();
