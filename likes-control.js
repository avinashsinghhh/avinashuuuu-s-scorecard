/**
 * Stream Like Counter Dashboard - Controller Script
 * Full dual-sync: Server API + LocalStorage + BroadcastChannel
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------------------
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const obsUrlInput = document.getElementById('obs-url-input');
  const btnCopyObs = document.getElementById('btn-copy-obs');

  // Auto-Update & YouTube Stream Controls
  const toggleAutoupdate = document.getElementById('toggle-autoupdate');
  const labelAutoupdate = document.getElementById('label-autoupdate');
  const inputYtUrl = document.getElementById('input-yt-url');
  const btnSaveStream = document.getElementById('btn-save-stream');
  const btnPollNow = document.getElementById('btn-poll-now');
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveKey = document.getElementById('btn-save-key');

  const streamInfoCard = document.getElementById('stream-info-card');
  const streamBadgeStatus = document.getElementById('stream-badge-status');
  const streamTitleText = document.getElementById('stream-title-text');
  const streamInfoMeta = document.getElementById('stream-info-meta');

  // Score & Steppers
  const displayLikesNumber = document.getElementById('display-likes-number');
  const btnResetLikes = document.getElementById('btn-reset-likes');
  const btnAdd1 = document.getElementById('btn-add-1');
  const btnAdd5 = document.getElementById('btn-add-5');
  const btnAdd10 = document.getElementById('btn-add-10');
  const btnSub1 = document.getElementById('btn-sub-1');
  const btnSub5 = document.getElementById('btn-sub-5');
  const inputDirectLikes = document.getElementById('input-direct-likes');
  const btnSetDirect = document.getElementById('btn-set-direct');

  // Goal & Milestone
  const inputGoalTarget = document.getElementById('input-goal-target');
  const inputGoalStep = document.getElementById('input-goal-step');
  const inputRewardText = document.getElementById('input-reward-text');
  const toggleAutobump = document.getElementById('toggle-autobump');

  // Live Preview & Test Controls
  const previewIframe = document.getElementById('preview-iframe');
  const btnTestLike = document.getElementById('btn-test-like');
  const btnTestGoal = document.getElementById('btn-test-goal');
  const btnToggleDemo = document.getElementById('btn-toggle-demo');

  // Appearance & Settings
  const selectLayout = document.getElementById('select-layout');
  const selectTheme = document.getElementById('select-theme');
  const selectIcon = document.getElementById('select-icon');
  const selectPoll = document.getElementById('select-poll');

  const togglePercentage = document.getElementById('toggle-percentage');
  const toggleGoal = document.getElementById('toggle-goal');
  const toggleRemaining = document.getElementById('toggle-remaining');
  const toggleSound = document.getElementById('toggle-sound');

  const sliderScale = document.getElementById('slider-scale');
  const valScale = document.getElementById('val-scale');
  const sliderVolume = document.getElementById('slider-volume');
  const valVolume = document.getElementById('val-volume');

  // -------------------------------------------------------------------------
  // Default State
  // -------------------------------------------------------------------------
  let state = {
    likes: 0,
    goal: 50,
    goalStep: 50,
    autoBumpGoal: true,
    rewardText: 'LIKE GOAL',
    youtubeUrl: '',
    videoId: '',
    apiKey: '',
    autoUpdate: false,
    pollInterval: 5,
    lastPolled: null,
    lastUpdated: null,
    status: 'ready',
    statusMessage: 'Ready',
    streamTitle: '',
    settings: {
      layout: 'bar',
      theme: 'youtube',
      icon: 'thumb',
      soundEnabled: true,
      soundVolume: 0.5,
      scale: 100,
      showPercentage: true,
      showGoal: true,
      showRemaining: true,
      accentColor: '#ff0033'
    }
  };

  let demoInterval = null;
  let pollIntervalTimer = null;
  let isServerRunning = false;

  // BroadcastChannel for instant zero-latency cross-tab sync
  const channel = window.BroadcastChannel ? new BroadcastChannel('stream_likes_channel') : null;

  // -------------------------------------------------------------------------
  // Extract Video ID / Handle
  // -------------------------------------------------------------------------
  function extractYouTubeIdentifier(urlOrId) {
    if (!urlOrId) return { type: null, value: '' };
    const str = urlOrId.trim();

    // Raw 11-char video ID (e.g. jfKfPfyJRdk)
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
      return { type: 'video_id', value: str };
    }

    // Handle @channel or @channel/live
    if (str.startsWith('@') || str.includes('youtube.com/@')) {
      const match = str.match(/@([a-zA-Z0-9_.-]+)/);
      if (match) {
        return { type: 'channel', value: `@${match[1]}` };
      }
    }

    // Standard YouTube URL formats
    try {
      const parsed = new URL(str.startsWith('http') ? str : `https://${str}`);
      if (parsed.hostname.includes('youtu.be')) {
        return { type: 'video_id', value: parsed.pathname.slice(1).split('/')[0] };
      }
      if (parsed.pathname.includes('/live/')) {
        return { type: 'video_id', value: parsed.pathname.split('/live/')[1].split('/')[0] };
      }
      if (parsed.searchParams.has('v')) {
        return { type: 'video_id', value: parsed.searchParams.get('v') };
      }
      if (parsed.pathname.startsWith('/@')) {
        const handle = parsed.pathname.split('/')[1];
        return { type: 'channel', value: handle };
      }
    } catch (e) {}

    return { type: 'raw', value: str };
  }

  // -------------------------------------------------------------------------
  // State Sync
  // -------------------------------------------------------------------------
  function broadcastState() {
    // 1. BroadcastChannel (0ms latency to overlay in OBS or preview iframe)
    if (channel) {
      channel.postMessage({ type: 'state_update', state });
    }

    // 2. LocalStorage persistence
    try {
      localStorage.setItem('stream_likes_state', JSON.stringify(state));
    } catch (e) {}

    // 3. Post to Python server if available
    saveStateToServer();
  }

  async function saveStateToServer() {
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (e) {
      // Offline / standalone browser mode handled silently
    }
  }

  // -------------------------------------------------------------------------
  // UI Update
  // -------------------------------------------------------------------------
  function updateUI() {
    // Status Indicator
    statusBadge.className = 'status-indicator';
    if (state.autoUpdate) {
      statusBadge.classList.add('polling');
      statusText.textContent = state.statusMessage || 'Auto-Tracking Active';
    } else {
      statusBadge.classList.add('idle');
      statusText.textContent = state.statusMessage || 'Ready';
    }

    // Likes number display
    displayLikesNumber.textContent = (state.likes || 0).toLocaleString();

    // Auto-update toggle
    toggleAutoupdate.checked = !!state.autoUpdate;
    labelAutoupdate.textContent = state.autoUpdate ? 'Auto-Fetch: ON' : 'Auto-Fetch: OFF';

    // Inputs
    inputYtUrl.value = state.youtubeUrl || '';
    inputApiKey.value = state.apiKey || '';
    inputGoalTarget.value = state.goal || 50;
    inputGoalStep.value = state.goalStep || 50;
    inputRewardText.value = state.rewardText || 'LIKE GOAL';
    toggleAutobump.checked = state.autoBumpGoal !== false;

    // Appearance
    selectLayout.value = state.settings.layout || 'bar';
    selectTheme.value = state.settings.theme || 'youtube';
    selectIcon.value = state.settings.icon || 'thumb';
    selectPoll.value = state.pollInterval || 5;

    togglePercentage.checked = state.settings.showPercentage !== false;
    toggleGoal.checked = state.settings.showGoal !== false;
    toggleRemaining.checked = state.settings.showRemaining !== false;
    toggleSound.checked = state.settings.soundEnabled !== false;

    sliderScale.value = state.settings.scale || 100;
    valScale.textContent = `${sliderScale.value}%`;

    sliderVolume.value = Math.round((state.settings.soundVolume ?? 0.5) * 100);
    valVolume.textContent = `${sliderVolume.value}%`;

    // Stream info card
    if (state.streamTitle || state.videoId) {
      streamInfoCard.style.display = 'flex';
      streamTitleText.textContent = state.streamTitle || `Video ID: ${state.videoId}`;
      streamBadgeStatus.textContent = state.autoUpdate ? 'TRACKING' : 'READY';
      streamInfoMeta.textContent = state.lastPolled
        ? `Last checked: ${new Date(state.lastPolled * 1000).toLocaleTimeString()}`
        : 'Not yet polled';
    } else {
      streamInfoCard.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // Fetch Live Likes Engine (Server API / Scraper / Official YouTube API)
  // -------------------------------------------------------------------------
  async function fetchLiveLikes() {
    const ident = extractYouTubeIdentifier(state.youtubeUrl);
    if (!ident.value) {
      state.statusMessage = 'Enter a valid YouTube URL or Video ID';
      updateUI();
      return;
    }

    state.statusMessage = 'Fetching live like count...';
    updateUI();

    // Method A: Server backend endpoint (/api/likes/youtube)
    try {
      const res = await fetch('/api/likes/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.youtubeUrl,
          identifier: ident.value,
          identifierType: ident.type,
          apiKey: state.apiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.likes === 'number') {
          handleNewLikeCount(data.likes, data.title, data.videoId);
          return;
        }
      }
    } catch (e) {
      // Backend not running, proceed to client fallback
    }

    // Method B: Client-side YouTube Data API v3 (if apiKey is available)
    if (state.apiKey && ident.type === 'video_id') {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ident.value}&key=${state.apiKey}`;
        const resp = await fetch(apiUrl);
        if (resp.ok) {
          const ytData = await resp.json();
          if (ytData.items && ytData.items.length > 0) {
            const item = ytData.items[0];
            const likeCount = parseInt(item.statistics.likeCount, 10) || 0;
            const title = item.snippet.title;
            handleNewLikeCount(likeCount, title, ident.value);
            return;
          }
        }
      } catch (err) {
        console.warn('Client-side YouTube API error:', err);
      }
    }

    state.statusMessage = 'Could not fetch likes. Check stream URL or API key.';
    updateUI();
  }

  function handleNewLikeCount(newLikes, title, videoId) {
    const oldLikes = state.likes;
    state.likes = newLikes;
    if (title) state.streamTitle = title;
    if (videoId) state.videoId = videoId;
    state.lastPolled = Math.floor(Date.now() / 1000);
    state.lastUpdated = Math.floor(Date.now() / 1000);

    // Auto-bump goal if reached
    if (state.autoBumpGoal && state.likes >= state.goal) {
      const step = state.goalStep || 50;
      let newGoal = state.goal;
      while (newGoal <= state.likes) {
        newGoal += step;
      }
      state.goal = newGoal;
    }

    state.statusMessage = `Live: ${newLikes.toLocaleString()} likes (${state.streamTitle || 'Stream'})`;
    updateUI();
    broadcastState();
  }

  // -------------------------------------------------------------------------
  // Auto-Update Polling Loop
  // -------------------------------------------------------------------------
  function setupPollingTimer() {
    if (pollIntervalTimer) clearInterval(pollIntervalTimer);
    if (!state.autoUpdate) return;

    const intervalMs = (state.pollInterval || 5) * 1000;
    pollIntervalTimer = setInterval(() => {
      if (state.autoUpdate) {
        fetchLiveLikes();
      }
    }, intervalMs);
  }

  // -------------------------------------------------------------------------
  // Event Listeners: Steppers & Manual Adjustments
  // -------------------------------------------------------------------------
  function modifyLikes(delta) {
    state.likes = Math.max(0, (state.likes || 0) + delta);

    if (state.autoBumpGoal && state.likes >= state.goal) {
      const step = state.goalStep || 50;
      let newGoal = state.goal;
      while (newGoal <= state.likes) {
        newGoal += step;
      }
      state.goal = newGoal;
    }

    updateUI();
    broadcastState();
  }

  btnAdd1.addEventListener('click', () => modifyLikes(1));
  btnAdd5.addEventListener('click', () => modifyLikes(5));
  btnAdd10.addEventListener('click', () => modifyLikes(10));
  btnSub1.addEventListener('click', () => modifyLikes(-1));
  btnSub5.addEventListener('click', () => modifyLikes(-5));

  btnSetDirect.addEventListener('click', () => {
    const val = parseInt(inputDirectLikes.value, 10);
    if (!isNaN(val) && val >= 0) {
      state.likes = val;
      inputDirectLikes.value = '';
      if (state.autoBumpGoal && state.likes >= state.goal) {
        const step = state.goalStep || 50;
        let newGoal = state.goal;
        while (newGoal <= state.likes) {
          newGoal += step;
        }
        state.goal = newGoal;
      }
      updateUI();
      broadcastState();
    }
  });

  inputDirectLikes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSetDirect.click();
  });

  btnResetLikes.addEventListener('click', () => {
    if (confirm('Reset stream like counter to 0?')) {
      state.likes = 0;
      updateUI();
      broadcastState();
    }
  });

  // -------------------------------------------------------------------------
  // Stream & API Key Controls
  // -------------------------------------------------------------------------
  btnSaveStream.addEventListener('click', () => {
    state.youtubeUrl = inputYtUrl.value.trim();
    const ident = extractYouTubeIdentifier(state.youtubeUrl);
    if (ident.value) {
      state.autoUpdate = true;
      toggleAutoupdate.checked = true;
      state.statusMessage = 'Connecting to stream...';
      updateUI();
      broadcastState();
      setupPollingTimer();
      fetchLiveLikes();
    } else {
      alert('Please enter a YouTube Live URL, Video ID, or Channel Handle.');
    }
  });

  inputYtUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSaveStream.click();
  });

  btnPollNow.addEventListener('click', () => {
    fetchLiveLikes();
  });

  toggleAutoupdate.addEventListener('change', () => {
    state.autoUpdate = toggleAutoupdate.checked;
    state.statusMessage = state.autoUpdate ? 'Auto-tracking enabled' : 'Auto-tracking paused';
    updateUI();
    broadcastState();
    setupPollingTimer();
    if (state.autoUpdate) fetchLiveLikes();
  });

  btnSaveKey.addEventListener('click', () => {
    state.apiKey = inputApiKey.value.trim();
    updateUI();
    broadcastState();
    alert('YouTube Data API key saved!');
  });

  // -------------------------------------------------------------------------
  // Goal Settings
  // -------------------------------------------------------------------------
  inputGoalTarget.addEventListener('change', () => {
    state.goal = Math.max(1, parseInt(inputGoalTarget.value, 10) || 50);
    broadcastState();
  });

  inputGoalStep.addEventListener('change', () => {
    state.goalStep = Math.max(1, parseInt(inputGoalStep.value, 10) || 50);
    broadcastState();
  });

  inputRewardText.addEventListener('input', () => {
    state.rewardText = inputRewardText.value;
    broadcastState();
  });

  toggleAutobump.addEventListener('change', () => {
    state.autoBumpGoal = toggleAutobump.checked;
    broadcastState();
  });

  // -------------------------------------------------------------------------
  // Appearance & Settings
  // -------------------------------------------------------------------------
  selectLayout.addEventListener('change', () => {
    state.settings.layout = selectLayout.value;
    broadcastState();
  });

  selectTheme.addEventListener('change', () => {
    state.settings.theme = selectTheme.value;
    broadcastState();
  });

  selectIcon.addEventListener('change', () => {
    state.settings.icon = selectIcon.value;
    broadcastState();
  });

  selectPoll.addEventListener('change', () => {
    state.pollInterval = parseInt(selectPoll.value, 10) || 5;
    broadcastState();
    setupPollingTimer();
  });

  togglePercentage.addEventListener('change', () => {
    state.settings.showPercentage = togglePercentage.checked;
    broadcastState();
  });

  toggleGoal.addEventListener('change', () => {
    state.settings.showGoal = toggleGoal.checked;
    broadcastState();
  });

  toggleRemaining.addEventListener('change', () => {
    state.settings.showRemaining = toggleRemaining.checked;
    broadcastState();
  });

  toggleSound.addEventListener('change', () => {
    state.settings.soundEnabled = toggleSound.checked;
    broadcastState();
  });

  sliderScale.addEventListener('input', () => {
    const val = parseInt(sliderScale.value, 10);
    state.settings.scale = val;
    valScale.textContent = `${val}%`;
    broadcastState();
  });

  sliderVolume.addEventListener('input', () => {
    const val = parseInt(sliderVolume.value, 10);
    state.settings.soundVolume = val / 100;
    valVolume.textContent = `${val}%`;
    broadcastState();
  });

  // -------------------------------------------------------------------------
  // Test Controls & Demo Simulation
  // -------------------------------------------------------------------------
  btnTestLike.addEventListener('click', () => {
    if (channel) {
      channel.postMessage({ type: 'test_like' });
    }
    modifyLikes(1);
  });

  btnTestGoal.addEventListener('click', () => {
    if (channel) {
      channel.postMessage({ type: 'test_goal' });
    }
  });

  btnToggleDemo.addEventListener('click', () => {
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
      btnToggleDemo.classList.remove('active-demo');
      btnToggleDemo.textContent = '⚡ Demo Mode: OFF';
    } else {
      btnToggleDemo.classList.add('active-demo');
      btnToggleDemo.textContent = '⚡ Demo Mode: ON (Simulating)';
      demoInterval = setInterval(() => {
        modifyLikes(1);
      }, 5000);
    }
  });

  // -------------------------------------------------------------------------
  // Copy OBS URL Button
  // -------------------------------------------------------------------------
  btnCopyObs.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(obsUrlInput.value);
      const originalText = btnCopyObs.textContent;
      btnCopyObs.textContent = '✅ Copied to Clipboard!';
      setTimeout(() => {
        btnCopyObs.textContent = originalText;
      }, 2000);
    } catch (e) {
      obsUrlInput.select();
      document.execCommand('copy');
      alert('OBS URL copied!');
    }
  });

  // Set OBS URL input dynamically to match current host
  function updateObsUrlDisplay() {
    const loc = window.location;
    if (loc.protocol.startsWith('http')) {
      obsUrlInput.value = `${loc.protocol}//${loc.host}/likes-overlay.html`;
    } else {
      obsUrlInput.value = 'likes-overlay.html';
    }
  }

  // -------------------------------------------------------------------------
  // Load State from LocalStorage / Server
  // -------------------------------------------------------------------------
  function loadLocalState() {
    try {
      const saved = localStorage.getItem('stream_likes_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        state = {
          ...state,
          ...parsed,
          settings: { ...state.settings, ...parsed.settings }
        };
      }
    } catch (e) {}
  }

  async function loadServerState() {
    try {
      const res = await fetch('/api/likes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.likes === 'number') {
          isServerRunning = true;
          state = {
            ...state,
            ...data,
            settings: { ...state.settings, ...data.settings }
          };
          updateUI();
          setupPollingTimer();
        }
      }
    } catch (e) {
      // Server not running, offline mode works fine
    }
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  loadLocalState();
  updateObsUrlDisplay();
  updateUI();
  setupPollingTimer();
  loadServerState();

  // Periodically re-sync server state if running
  setInterval(loadServerState, 6000);
})();
