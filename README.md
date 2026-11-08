# 🎬 Live Stream Overlay Suite: Like Counter & Chess Tracker

A sleek, animated streaming overlay suite for **OBS Studio**, **Streamlabs**, **Twitch Studio**, and **vMix**:
1. **👍 Live Like Counter & Goal Overlay**: Real-time auto-tracking for YouTube Live streams with floating heart/thumb bursts, celebration confetti, and dynamic goal rewards.
2. **♟️ Chess.com Session Score Tracker**: Automatically tracks your Wins, Losses, and Draws in real-time from Chess.com.

---

## ⚡ Quick Start (Local Server Mode)

1. Double-click **`start_overlay.bat`** in this folder.
2. The **Stream Overlay Dashboard** opens in your browser at `http://localhost:5050/likes-control.html` (or `http://localhost:5050/index.html`).
3. Set your YouTube stream URL or handle (e.g. `https://youtube.com/watch?v=...` or `@MyChannel/live`), or adjust likes manually!

---

## 🎥 Adding to OBS Studio / Streamlabs

### 1. Like Counter Overlay
1. In OBS Studio, go to the **Sources** dock and click **`+`** → **Browser**.
2. Name it `Like Counter` and click **OK**.
3. In properties:
   - **URL**: `http://localhost:5050/likes-overlay.html`
   - **Width**: `500` (or `360` for vertical tower, `320` for pill)
   - **Height**: `130` (or `360` for vertical tower, `70` for pill)
   - Check **"Shutdown source when not visible"**
4. The background is **100% transparent** and blends directly onto your webcam or game capture!

### 2. Chess Overlay
- **URL**: `http://localhost:5050/overlay.html`
- **Width**: `500`, **Height**: `110`

---

## 👍 Like Counter Features

### 🔄 Automatic YouTube Live Tracking
- **Zero API Key Needed**: Automatically extracts real-time likes directly from your public live stream URL or channel live page (`@Channel/live`).
- **Official YouTube Data API v3 (Optional)**: Free API key support for 100% official quota tracking.
- **Configurable Auto-Polling**: Checks every 3s, 5s, 10s, or 30s.

### 🎯 Dynamic Goals & Milestone Fanfare
- **Target Goals**: Set goals like 50, 100, 250, 500 likes.
- **Auto-Bump Goal**: When the goal is reached, the goal can automatically increase by your chosen step (e.g., 50 → 100 → 150) to keep the stream hype going!
- **Custom Reward Title**: Display rewards like `100 LIKES = FACE REVEAL` or `50 LIKES = PLAY VIEWERS`.
- **Celebration Confetti & Chime**: Fireworks confetti shower + Web Audio victory fanfare when goal is achieved!

### ✨ Visual Effects & Themes
- **Floating Particles Burst**: Like on mobile live streams, a flurry of thumbs 👍 or hearts ❤️ float upward whenever likes increase!
- **Pop / Bounce Animation**: Counter dynamically animates and rolls to new numbers.
- **5 Stream Layouts**:
  - `Horizontal Bar` (Classic stream bar with progress track & percentage)
  - `Compact Pill` (Minimalist one-line pill)
  - `Badge / Counter Only` (Bold glowing counter)
  - `Vertical Tower` (Thermometer layout for sidebars, YouTube Shorts & TikTok 9:16)
  - `Floating Card` (Detailed streamer card)
- **6 Color Themes**: YouTube Live Red, Cyberpunk Neon, Emerald Gaming, Twitch Purple, Sunset Flame, Minimal Glass.
- **Audio Synthesis**: Built-in royalty-free sound effects via Web Audio API (gentle chime on like, fanfare on goal, volume slider included).

### 🎛️ Streamer Manual & Test Controls
- **Quick Steppers**: `+1`, `+5`, `+10`, `-1`, `-5` buttons.
- **Direct Input & Reset to 0**.
- **Streamer Test Buttons**: `✨ Test Like (+1)` and `🎉 Test Goal Reached` to preview OBS animations before going live.
- **⚡ Demo Mode**: Auto-increments every few seconds for testing stream scenes.

---

## 🚀 Deploying to Netlify (Free 24/7 Hosting)

Drag and drop this folder directly into [**app.netlify.com/drop**](https://app.netlify.com/drop).
- OBS Browser URL: `https://your-site.netlify.app/likes-overlay.html`
- Control Dashboard: `https://your-site.netlify.app/likes-control.html`
- Works 100% serverless using `BroadcastChannel` and `localStorage`!

---

## 📁 Files Included

- `likes-overlay.html`, `likes-overlay.css`, `likes-overlay.js`: The OBS Browser Source Like Counter.
- `likes-control.html`, `likes-control.css`, `likes-control.js`: Streamer Control Panel for Like Counter.
- `likes_state.json`: Saved state for like counter.
- `server.py`: Local Python server powering both Like Counter & Chess Tracker.
- `control.html`, `overlay.html`, `common.js`: Chess.com Score Tracker.
- `index.html`: Stream Overlay Suite Hub.
- `start_overlay.bat`: Quick Windows launcher.

### 3. 🚨 Reset to Zero
- Click **`🔄 Reset to Zero (0-0-0)`** at the start of every stream session or when starting a new speedrun/marathon.
- Resets your record to `0W - 0L - 0D`, resets your streak, and recalibrates your session rating change baseline.

### 4. 🧪 Stream Animation Test Buttons
- Streamers love being able to test their OBS setup before going live!
- Click **`🧪 Test Win (+1)`**, **`Test Loss (+1)`**, or **`Test Draw (+1)`** in the control panel to trigger the bounce animations and victory toasts in OBS.

### 5. 🎨 Customization & Themes
Change styles instantly from the Control Panel without having to reload OBS:
- **Layouts**:
  - `Horizontal Bar` (Standard streamer bar under camera)
  - `Compact Pill` (One-line minimal pill: `5W · 2L · 1D`)
  - `Vertical Box` (Vertical stack next to the board)
  - `Detailed Card` (Card with username, rating, streak, and recent match)
- **Themes**:
  - `Chess.com Classic` (Emerald green & slate)
  - `Cyberpunk Neon` (Neon green, hot pink, and cyan)
  - `Twitch Purple` (Streamer purple and violet accents)
  - `Sleek Dark` (Minimal charcoal & green/red)
  - `Minimal Glass` (Frosted glassmorphism)
- **Toggles**:
  - Show/Hide Draws
  - Show/Hide Rating & Session Net Diff (`+18`)
  - Show/Hide Win Rate %
  - Show/Hide Win/Loss Streak (`🔥 4W`)
  - Show/Hide Username
  - Custom Title (e.g. `SESSION RECORD`, `ROAD TO 2000`, `BLITZ GRIND`)
  - Scale Slider (`60%` - `160%`)

---

## 📁 Files Included

- `server.py`: Zero-dependency Python server & Chess.com auto-tracker (uses Python standard library).
- `control.html` & `control.js` & `control.css`: Streamer control dashboard.
- `overlay.html` & `overlay.js` & `overlay.css`: OBS browser source overlay.
- `common.js`: Chess.com game parser and utility functions.
- `start_overlay.bat`: Quick Windows launcher.
- `session_state.json`: Auto-saved session data (persists your score if you restart OBS or browser).

---

## 💡 Standalone Browser Mode (Without Python)

If you ever need to run the overlay without running the local Python server:
- Simply open `control.html` in your browser.
- In OBS, check **Local File** in the Browser Source properties and select `overlay.html`.
- The dashboard and overlay will synchronize directly through browser `localStorage` and `BroadcastChannel`.
