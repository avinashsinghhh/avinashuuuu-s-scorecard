# ♟️ Chess.com Stream Overlay & Session Tracker

A sleek, animated streaming overlay for OBS Studio and Streamlabs that automatically tracks your **Wins**, **Losses**, and **Draws** in real-time from Chess.com, with a full-featured streamer control dashboard allowing **manual edits** and **one-click resets to zero**.

---

## 🚀 Deploying to Netlify (Free Hosting & 24/7 Cloud Access)

You can host this overlay completely free on Netlify so you don't even need to run a local server:

### Option A: Instant 10-Second Drag & Drop (Easiest)
1. Go to [**app.netlify.com/drop**](https://app.netlify.com/drop) (log in or sign up for free).
2. Drag and drop your **`chess overlay`** folder directly into the browser upload box.
3. Netlify will deploy your site in seconds and give you a live URL (e.g., `https://your-site.netlify.app`).
4. In OBS, set your Browser Source URL to:
   ```
   https://your-site.netlify.app/overlay.html?user=your_username
   ```
5. Open `https://your-site.netlify.app` on your phone, tablet, or secondary monitor to control your stream session from anywhere!

---

## ⚡ Quick Start (Local Server Mode)

1. Double-click **`start_overlay.bat`** in this folder.
2. It automatically starts the tracker and opens the **Streamer Control Dashboard** in your browser at `http://localhost:5050/control.html`.
3. In the control dashboard:
   - Type your **Chess.com username** and click **Set Player**.
   - Your session starts immediately at **0W - 0L - 0D**.

---

## 🎥 Adding to OBS Studio / Streamlabs

1. In OBS Studio, go to the **Sources** dock and click **`+`** → **Browser**.
2. Name it (e.g., `Chess Overlay`) and click **OK**.
3. In the properties window:
   - **URL**: `http://localhost:5050/overlay.html`
   - **Width**: `500` (or `600` for detailed layouts)
   - **Height**: `110` (or `220` for vertical layout)
   - *(Optional)* Check **"Shutdown source when not visible"**.
4. Click **OK** and position it anywhere on your stream (under your webcam, beside the chessboard, etc.)!

> **Transparent Background**: The overlay is completely transparent by default, blending into your stream scene.

---

## 🛠️ Features

### 1. 🔄 Automatic Chess.com Live Tracking
- Polls Chess.com's official API in the background every 5 seconds.
- Automatically detects when your games finish and increments **Wins**, **Losses**, or **Draws**.
- Tracks rated/unrated games and filters by mode (**All**, **Blitz**, **Bullet**, **Rapid**, **Daily**).
- Tracks your **rating change** (+/- net gain/loss) during your stream session.

### 2. 🎛️ Manual Editing & Control
- **Quick Steppers**: Click **`+1`** or **`-1`** on Wins, Losses, or Draws to adjust score on the fly.
- **Direct Input**: Click and type any number directly into the W/L/D boxes.
- **Undo**: Click **`↩ Undo Last Game`** if a casual game or misclick was tracked.

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
