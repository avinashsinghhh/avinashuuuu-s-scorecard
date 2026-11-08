/**
 * Stream Like Counter Overlay - Client Script
 * Zero-dependency, OBS Studio / Streamlabs ready.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------------------
  const overlayContainer = document.getElementById('overlay-container');
  const likesCard = document.getElementById('likes-card');
  const iconBubble = document.getElementById('icon-bubble');
  const iconSymbol = document.getElementById('icon-symbol');
  const rewardTitle = document.getElementById('reward-title');
  const percentBadge = document.getElementById('percent-badge');
  const likeNumber = document.getElementById('like-number');
  const goalSeparator = document.getElementById('goal-separator');
  const goalNumber = document.getElementById('goal-number');
  const likesTextLabel = document.getElementById('likes-text-label');
  const remainingBadge = document.getElementById('remaining-badge');
  const progressFill = document.getElementById('progress-fill');
  const progressTrack = document.getElementById('progress-track');
  const particlesLayer = document.getElementById('particles-layer');
  const goalToast = document.getElementById('goal-toast');
  const goalToastSub = document.getElementById('goal-toast-sub');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let state = {
    likes: 0,
    goal: 50,
    goalStep: 50,
    autoBumpGoal: true,
    rewardText: 'LIKE GOAL',
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

  let previousLikes = 0;
  let previousGoal = 50;
  let isInitialized = false;
  let toastTimeout = null;

  // Icon symbol map
  const ICON_MAP = {
    thumb: '👍',
    heart: '❤️',
    fire: '🔥',
    star: '⭐',
    diamond: '💎',
    gamepad: '🎮',
    rocket: '🚀'
  };

  // -------------------------------------------------------------------------
  // Audio Synthesizer (Web Audio API - 0 external files)
  // -------------------------------------------------------------------------
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playLikeChime(vol = 0.5) {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1 (E5 - 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25 * vol, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.38);

      // Note 2 (B5 - 987.77Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.35 * vol, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.60);
    } catch (e) {
      // Audio playback restrictions handled safely
    }
  }

  function playGoalFanfare(vol = 0.5) {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const chord = [523.25, 659.25, 783.99, 1046.50];
      chord.forEach((freq, idx) => {
        const time = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3 * vol, time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (idx === 3 ? 0.9 : 0.45));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 1.0);
      });
    } catch (e) {
      // Safely catch
    }
  }

  // -------------------------------------------------------------------------
  // Floating Particles Engine (Floating Thumbs / Hearts)
  // -------------------------------------------------------------------------
  function spawnFloatingParticles(count = 3) {
    if (!particlesLayer) return;
    const symbol = ICON_MAP[state.settings.icon] || '👍';
    const limit = Math.min(count, 12);

    for (let i = 0; i < limit; i++) {
      setTimeout(() => {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.textContent = symbol;

        // Position near the icon bubble
        const rect = iconBubble.getBoundingClientRect();
        const startX = rect.left + rect.width / 2 + (Math.random() * 30 - 15);
        const startY = rect.top + rect.height / 2;

        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;

        // Slight random size and sway
        const size = 18 + Math.random() * 16;
        particle.style.fontSize = `${size}px`;

        particlesLayer.appendChild(particle);

        // Remove element after animation completes
        setTimeout(() => {
          if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
          }
        }, 1900);
      }, i * 90);
    }
  }

  // -------------------------------------------------------------------------
  // Confetti Cannon (Goal Achieved Celebration)
  // -------------------------------------------------------------------------
  let confettiAnimationId = null;
  const confettiParticles = [];

  function triggerConfetti() {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext('2d');
    const width = (confettiCanvas.width = window.innerWidth);
    const height = (confettiCanvas.height = window.innerHeight);

    // Spawn 80 confetti pieces
    confettiParticles.length = 0;
    const colors = ['#ff0033', '#00f2fe', '#ffd700', '#10b981', '#a855f7', '#ff4d6d', '#ffffff'];

    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: width * 0.5 + (Math.random() * 80 - 40),
        y: height * 0.4,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        opacity: 1
      });
    }

    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);

    let frames = 0;
    function render() {
      ctx.clearRect(0, 0, width, height);
      let aliveCount = 0;

      for (let p of confettiParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.98; // drag
        p.rotation += p.rotationSpeed;
        if (frames > 40) p.opacity -= 0.015;

        if (p.opacity > 0 && p.y < height + 50) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      }

      frames++;
      if (aliveCount > 0 && frames < 180) {
        confettiAnimationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    render();
  }

  // -------------------------------------------------------------------------
  // Milestone Toast Banner
  // -------------------------------------------------------------------------
  function showGoalReachedBanner(likes, goal) {
    if (!goalToast) return;
    if (toastTimeout) clearTimeout(toastTimeout);

    goalToastSub.textContent = `${likes} / ${goal} LIKES REACHED!`;
    goalToast.style.display = 'flex';
    requestAnimationFrame(() => {
      goalToast.classList.add('active');
    });

    toastTimeout = setTimeout(() => {
      goalToast.classList.remove('active');
      setTimeout(() => {
        goalToast.style.display = 'none';
      }, 500);
    }, 4500);
  }

  // -------------------------------------------------------------------------
  // Animated Counter Tweening
  // -------------------------------------------------------------------------
  let currentDisplayLikes = 0;
  let counterAnimationId = null;

  function animateNumberChange(targetNumber) {
    if (counterAnimationId) cancelAnimationFrame(counterAnimationId);

    const startNumber = currentDisplayLikes;
    const diff = targetNumber - startNumber;
    if (diff === 0) {
      likeNumber.textContent = formatCompactNumber(targetNumber);
      return;
    }

    const duration = Math.min(800, Math.max(250, Math.abs(diff) * 60));
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startNumber + diff * ease);

      likeNumber.textContent = formatCompactNumber(val);
      currentDisplayLikes = val;

      if (progress < 1) {
        counterAnimationId = requestAnimationFrame(step);
      } else {
        currentDisplayLikes = targetNumber;
        likeNumber.textContent = formatCompactNumber(targetNumber);
      }
    }

    counterAnimationId = requestAnimationFrame(step);
  }

  function formatCompactNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 10000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toLocaleString();
  }

  // -------------------------------------------------------------------------
  // Apply Rendered State to UI
  // -------------------------------------------------------------------------
  function render(incomingState, triggerEffects = true) {
    const s = incomingState || state;
    const likes = Math.max(0, parseInt(s.likes, 10) || 0);
    const goal = Math.max(1, parseInt(s.goal, 10) || 50);
    const settings = s.settings || state.settings || {};

    // Apply layout & theme to body
    const layout = settings.layout || 'bar';
    const theme = settings.theme || 'youtube';

    document.body.className = `theme-${theme} layout-${layout}`;

    // Apply scaling
    const scale = (settings.scale || 100) / 100;
    overlayContainer.style.transform = `scale(${scale})`;

    // Apply icon
    const iconKey = settings.icon || 'thumb';
    iconSymbol.textContent = ICON_MAP[iconKey] || '👍';

    // Reward Title
    rewardTitle.textContent = s.rewardText || 'LIKE GOAL';

    // Goal Number
    goalNumber.textContent = formatCompactNumber(goal);

    // Visibility toggles
    percentBadge.style.display = settings.showPercentage !== false ? 'block' : 'none';
    goalSeparator.style.display = settings.showGoal !== false ? 'inline' : 'none';
    goalNumber.style.display = settings.showGoal !== false ? 'inline' : 'none';
    remainingBadge.style.display = settings.showRemaining !== false ? 'inline' : 'none';

    // Progress percentage
    const percent = Math.min(100, Math.round((likes / goal) * 100));
    percentBadge.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;

    // Remaining count
    const remaining = Math.max(0, goal - likes);
    remainingBadge.textContent = remaining === 0 ? '(Completed!)' : `(${formatCompactNumber(remaining)} to go)`;

    // Did likes increase?
    if (isInitialized && triggerEffects && likes > previousLikes) {
      const delta = likes - previousLikes;

      // Animate number pop
      likeNumber.classList.remove('bump');
      iconBubble.classList.remove('bump');
      void likeNumber.offsetWidth; // Force reflow
      void iconBubble.offsetWidth;
      likeNumber.classList.add('bump');
      iconBubble.classList.add('bump');

      // Floating particles burst
      spawnFloatingParticles(Math.min(delta, 8));

      // Audio chime
      playLikeChime(settings.soundVolume ?? 0.5);

      // Check if goal just reached
      if (likes >= goal && previousLikes < goal) {
        triggerConfetti();
        showGoalReachedBanner(likes, goal);
        playGoalFanfare(settings.soundVolume ?? 0.5);
      }
    }

    animateNumberChange(likes);

    previousLikes = likes;
    previousGoal = goal;
    isInitialized = true;
  }

  // -------------------------------------------------------------------------
  // State Synchronization (BroadcastChannel, LocalStorage, Server API)
  // -------------------------------------------------------------------------
  const channel = window.BroadcastChannel ? new BroadcastChannel('stream_likes_channel') : null;

  if (channel) {
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'state_update') {
        state = { ...state, ...data.state };
        render(state, true);
      } else if (data.type === 'test_like') {
        const testLikes = (state.likes || 0) + 1;
        state.likes = testLikes;
        render(state, true);
      } else if (data.type === 'test_goal') {
        triggerConfetti();
        showGoalReachedBanner(state.goal, state.goal);
        playGoalFanfare(state.settings.soundVolume ?? 0.5);
      }
    };
  }

  // Check URL parameters for overrides (e.g. ?theme=neon&layout=pill&likes=25&goal=100)
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('theme')) state.settings.theme = params.get('theme');
    if (params.has('layout')) state.settings.layout = params.get('layout');
    if (params.has('icon')) state.settings.icon = params.get('icon');
    if (params.has('scale')) state.settings.scale = parseInt(params.get('scale'), 10) || 100;
    if (params.has('likes')) state.likes = parseInt(params.get('likes'), 10) || 0;
    if (params.has('goal')) state.goal = parseInt(params.get('goal'), 10) || 50;
    if (params.has('reward')) state.rewardText = params.get('reward');
  }

  // Load from localStorage
  function loadLocalState() {
    try {
      const saved = localStorage.getItem('stream_likes_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed, settings: { ...state.settings, ...parsed.settings } };
      }
    } catch (e) {}
  }

  // Fetch from server /api/likes if available
  async function pollServer() {
    try {
      const res = await fetch('/api/likes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.likes === 'number') {
          state = { ...state, ...data, settings: { ...state.settings, ...data.settings } };
          render(state, true);
        }
      }
    } catch (e) {
      // Server not running, fallback to localStorage & broadcast
    }
  }

  // Listen for storage events across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'stream_likes_state' && e.newValue) {
      try {
        const incoming = JSON.parse(e.newValue);
        state = { ...state, ...incoming };
        render(state, true);
      } catch (err) {}
    }
  });

  // Enable audio context on any click (OBS browser source click or test)
  window.addEventListener('click', () => {
    getAudioContext();
  });

  // Init
  loadLocalState();
  applyUrlParams();
  render(state, false);

  // Poll server or fallback check
  pollServer();
  setInterval(pollServer, 3000);
})();
