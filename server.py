#!/usr/bin/env python3
"""
Chess Stream Overlay - Local Server & Auto-Tracker
Zero external dependencies (uses Python standard library only).
"""

import os
import sys
import json
import time
import socket
import urllib.request
import urllib.error
from datetime import datetime, timezone
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import webbrowser

PORT = 5050
STATE_FILE = Path(__file__).parent / "session_state.json"
USER_AGENT = "ChessStreamOverlay/2.0 (StreamerSessionOverlay; contact@chess-overlay.local)"

DEFAULT_STATE = {
    "username": "",
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "sessionStartTime": int(time.time()),
    "baselineRatings": {},
    "currentRatings": {},
    "processedGames": [],
    "history": [],
    "streak": {"type": None, "count": 0},
    "settings": {
        "timeClass": "all",       # all, blitz, bullet, rapid, daily
        "ratedOnly": False,
        "theme": "chesscom",       # chesscom, neon, dark, purple, minimal
        "layout": "horizontal",   # horizontal, vertical, pill, card
        "showDraws": True,
        "showRating": True,
        "showWinRate": True,
        "showStreak": True,
        "showUsername": True,
        "customTitle": "SESSION RECORD",
        "scale": 100
    },
    "lastGame": None,
    "lastPolled": None,
    "status": "ready",
    "statusMessage": "Ready. Set your Chess.com username in the control panel."
}

state_lock = threading.Lock()
state = {}

def load_state():
    global state
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                state = {**DEFAULT_STATE, **loaded}
                state["settings"] = {**DEFAULT_STATE["settings"], **loaded.get("settings", {})}
                return
        except Exception as e:
            print(f"[Warning] Failed to load session_state.json: {e}")
    state = dict(DEFAULT_STATE)
    save_state()

def save_state():
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save session_state.json: {e}")

LOSS_RESULTS = {'checkmated', 'timeout', 'resigned', 'abandoned', 'lose', 'bughousepartnerlose'}
DRAW_RESULTS = {'agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'}

def parse_game(game, username):
    if not game or not username:
        return None
    user_lower = username.strip().lower()

    white = game.get("white", {})
    black = game.get("black", {})
    white_user = (white.get("username") or "").lower()
    black_user = (black.get("username") or "").lower()

    if white_user != user_lower and black_user != user_lower:
        return None

    is_white = (white_user == user_lower)
    user_data = white if is_white else black
    opp_data = black if is_white else white

    user_res = (user_data.get("result") or "").lower()
    opp_res = (opp_data.get("result") or "").lower()

    if user_res == "win":
        outcome = "win"
    elif user_res in LOSS_RESULTS:
        outcome = "loss"
    elif user_res in DRAW_RESULTS or opp_res in DRAW_RESULTS:
        outcome = "draw"
    elif opp_res == "win":
        outcome = "loss"
    else:
        outcome = "draw"

    return {
        "outcome": outcome,
        "userResult": user_res,
        "oppResult": opp_res,
        "userRating": user_data.get("rating"),
        "oppRating": opp_data.get("rating"),
        "oppUsername": opp_data.get("username") or "Opponent",
        "userColor": "white" if is_white else "black",
        "timeClass": game.get("time_class", "unknown"),
        "timeControl": game.get("time_control", ""),
        "rated": bool(game.get("rated", True)),
        "url": game.get("url", ""),
        "endTime": game.get("end_time") or int(time.time())
    }

def fetch_url_json(url):
    """Fetch URL with anti-caching headers."""
    headers = {
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                return json.loads(res.read().decode("utf-8"))
    except Exception:
        pass
    return None

def fetch_latest_chess_games(username):
    """
    Fetches games from the latest archive available for the user.
    Uses the /archives endpoint to get the exact current active archive URL.
    """
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    data = fetch_url_json(archives_url)
    if data and "archives" in data and len(data["archives"]) > 0:
        latest_archive_url = data["archives"][-1]
        archive_data = fetch_url_json(latest_archive_url)
        if archive_data and "games" in archive_data:
            return archive_data.get("games", [])

    # Fallback: try current UTC year/month
    now_utc = datetime.now(timezone.utc)
    fallback_url = f"https://api.chess.com/pub/player/{username}/games/{now_utc.year}/{now_utc.month:02d}"
    fb_data = fetch_url_json(fallback_url)
    if fb_data and "games" in fb_data:
        return fb_data.get("games", [])

    return None

def fetch_chess_stats(username):
    url = f"https://api.chess.com/pub/player/{username}/stats"
    return fetch_url_json(url)

def record_game_in_state(game_info):
    """Helper to register a completed match in session state."""
    outcome = game_info["outcome"]
    if outcome == "win":
        state["wins"] += 1
    elif outcome == "loss":
        state["losses"] += 1
    elif outcome == "draw":
        state["draws"] += 1

    # Update streak
    curr_streak = state.get("streak", {"type": None, "count": 0})
    if curr_streak.get("type") == outcome:
        curr_streak["count"] = curr_streak.get("count", 0) + 1
    else:
        curr_streak = {"type": outcome, "count": 1}
    state["streak"] = curr_streak

    # Update ratings
    tc = game_info.get("timeClass", "blitz")
    user_rt = game_info.get("userRating")
    if user_rt:
        state["currentRatings"][tc] = user_rt
        if tc not in state["baselineRatings"]:
            state["baselineRatings"][tc] = user_rt

    base_rt = state["baselineRatings"].get(tc, user_rt or 0)
    rating_diff = (user_rt - base_rt) if user_rt else 0
    game_info["ratingDiff"] = rating_diff

    state["lastGame"] = game_info
    state["history"].append(game_info)

    if game_info.get("url") and game_info["url"] not in state.get("processedGames", []):
        state["processedGames"].append(game_info["url"])
        state["processedGames"] = state["processedGames"][-500:]

    print(f"[Match Completed] {outcome.upper()} vs {game_info['oppUsername']} ({game_info['timeClass']}) -> Score: {state['wins']}W / {state['losses']}L / {state['draws']}D")

def poller_thread():
    """Background polling worker for Chess.com game updates."""
    last_stats_poll = 0
    while True:
        try:
            with state_lock:
                username = state.get("username", "").strip()
                start_time = state.get("sessionStartTime", 0)
                processed_set = set(state.get("processedGames", []))
                time_class_filter = state.get("settings", {}).get("timeClass", "all")
                rated_only = state.get("settings", {}).get("ratedOnly", False)

            if username:
                games = fetch_latest_chess_games(username)

                if games is not None:
                    new_games_found = []
                    # Allow 5-minute grace buffer for clock skew between local PC and Chess.com server
                    grace_start_time = start_time - 300

                    for g in games:
                        g_url = g.get("url")
                        g_end = g.get("end_time", 0)
                        if not g_url or g_url in processed_set:
                            continue

                        # If game ended well before the session started, mark as processed
                        if g_end < grace_start_time:
                            processed_set.add(g_url)
                            continue

                        parsed = parse_game(g, username)
                        if not parsed:
                            continue

                        # Apply filters
                        if rated_only and not parsed["rated"]:
                            processed_set.add(g_url)
                            continue
                        if time_class_filter != "all" and parsed["timeClass"] != time_class_filter:
                            processed_set.add(g_url)
                            continue

                        new_games_found.append(parsed)
                        processed_set.add(g_url)

                    # Periodically fetch latest ratings
                    ratings_update = {}
                    if time.time() - last_stats_poll > 15:
                        stats = fetch_chess_stats(username)
                        last_stats_poll = time.time()
                        if stats:
                            for tc in ["chess_blitz", "chess_bullet", "chess_rapid", "chess_daily"]:
                                if tc in stats and "last" in stats[tc] and "rating" in stats[tc]["last"]:
                                    short_tc = tc.replace("chess_", "")
                                    ratings_update[short_tc] = stats[tc]["last"]["rating"]

                    with state_lock:
                        state["lastPolled"] = int(time.time())
                        state["status"] = "active"
                        state["statusMessage"] = f"Tracking live: {username}"
                        state["processedGames"] = list(processed_set)[-500:]

                        if ratings_update:
                            state["currentRatings"].update(ratings_update)
                            for k, v in ratings_update.items():
                                if k not in state["baselineRatings"]:
                                    state["baselineRatings"][k] = v

                        for game_info in new_games_found:
                            record_game_in_state(game_info)

                        if new_games_found:
                            save_state()

                else:
                    with state_lock:
                        state["lastPolled"] = int(time.time())

        except Exception as e:
            pass

        time.sleep(5)

class OverlayRequestHandler(SimpleHTTPRequestHandler):
    """Handles static files and overlay API requests."""

    def __init__(self, *args, **kwargs):
        directory = str(Path(__file__).parent)
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format, *args):
        if "/api/" in self.path:
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if self.path.startswith("/api/") or self.path.endswith(".html"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.path = "/control.html"

        if self.path == "/api/state":
            with state_lock:
                tc = state.get("settings", {}).get("timeClass", "blitz")
                if tc == "all":
                    tc = "blitz"
                cur_r = state.get("currentRatings", {}).get(tc)
                base_r = state.get("baselineRatings", {}).get(tc)
                r_diff = (cur_r - base_r) if (cur_r is not None and base_r is not None) else 0

                resp = {
                    **state,
                    "activeRating": cur_r,
                    "ratingDiff": r_diff,
                    "activeTimeClass": tc
                }
            self._send_json(resp)
            return

        if self.path == "/api/latest-games":
            # Returns the last 10 games from Chess.com so the user can import any missed game
            with state_lock:
                username = state.get("username", "").strip()
            if not username:
                self._send_json({"games": []})
                return

            games = fetch_latest_chess_games(username) or []
            parsed_list = []
            with state_lock:
                history_urls = {h.get("url") for h in state.get("history", [])}

            for g in reversed(games[-15:]):
                p = parse_game(g, username)
                if p:
                    p["inSession"] = p["url"] in history_urls
                    parsed_list.append(p)

            self._send_json({"games": parsed_list})
            return

        return super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_len) if content_len > 0 else b"{}"
        try:
            payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except Exception:
            payload = {}

        if self.path == "/api/reset":
            with state_lock:
                state["wins"] = 0
                state["losses"] = 0
                state["draws"] = 0
                state["streak"] = {"type": None, "count": 0}
                state["sessionStartTime"] = int(time.time())
                state["baselineRatings"] = dict(state.get("currentRatings", {}))
                if payload.get("clearHistory", False):
                    state["history"] = []
                    state["lastGame"] = None
                save_state()
            self._send_json({"success": True, "message": "Session reset to 0"})
            return

        if self.path == "/api/manual":
            with state_lock:
                if "type" in payload and "delta" in payload:
                    t = payload["type"]
                    d = int(payload["delta"])
                    if t == "win":
                        state["wins"] = max(0, state["wins"] + d)
                    elif t == "loss":
                        state["losses"] = max(0, state["losses"] + d)
                    elif t == "draw":
                        state["draws"] = max(0, state["draws"] + d)

                if "wins" in payload:
                    state["wins"] = max(0, int(payload["wins"]))
                if "losses" in payload:
                    state["losses"] = max(0, int(payload["losses"]))
                if "draws" in payload:
                    state["draws"] = max(0, int(payload["draws"]))

                save_state()
            self._send_json({"success": True, "state": state})
            return

        if self.path == "/api/settings":
            with state_lock:
                if "username" in payload:
                    new_user = payload["username"].strip()
                    if new_user.lower() != state.get("username", "").lower():
                        state["username"] = new_user
                        state["baselineRatings"] = {}
                        state["currentRatings"] = {}
                        # Don't purge history if just re-saving
                if "settings" in payload and isinstance(payload["settings"], dict):
                    state["settings"].update(payload["settings"])
                save_state()
            self._send_json({"success": True, "settings": state["settings"]})
            return

        if self.path == "/api/import-game":
            # Force import a specific game URL or the latest game
            target_url = payload.get("url")
            with state_lock:
                username = state.get("username", "").strip()

            if not username:
                self._send_json({"success": False, "message": "No username configured"})
                return

            games = fetch_latest_chess_games(username) or []
            target_game = None

            if target_url:
                for g in games:
                    if g.get("url") == target_url:
                        target_game = g
                        break
            else:
                # Latest game
                if games:
                    target_game = games[-1]

            if not target_game:
                self._send_json({"success": False, "message": "Game not found on Chess.com"})
                return

            parsed = parse_game(target_game, username)
            if not parsed:
                self._send_json({"success": False, "message": "Could not parse game"})
                return

            with state_lock:
                # Check if already in history
                if any(h.get("url") == parsed["url"] for h in state.get("history", [])):
                    self._send_json({"success": False, "message": "Game already imported in this session"})
                    return

                record_game_in_state(parsed)
                save_state()

            self._send_json({"success": True, "game": parsed})
            return

        if self.path == "/api/undo":
            with state_lock:
                if state.get("history"):
                    last = state["history"].pop()
                    outcome = last.get("outcome")
                    if outcome == "win":
                        state["wins"] = max(0, state["wins"] - 1)
                    elif outcome == "loss":
                        state["losses"] = max(0, state["losses"] - 1)
                    elif outcome == "draw":
                        state["draws"] = max(0, state["draws"] - 1)
                    state["lastGame"] = state["history"][-1] if state["history"] else None
                    save_state()
                    self._send_json({"success": True, "undone": last})
                    return
            self._send_json({"success": False, "message": "No games in history to undo"})
            return

        if self.path == "/api/test-event":
            outcome = payload.get("outcome", "win")
            with state_lock:
                test_game = {
                    "outcome": outcome,
                    "oppUsername": "TestOpponent",
                    "timeClass": state.get("settings", {}).get("timeClass", "blitz"),
                    "userRating": 1500,
                    "oppRating": 1495,
                    "ratingDiff": 8 if outcome == "win" else (-8 if outcome == "loss" else 0),
                    "url": "https://www.chess.com",
                    "endTime": int(time.time()),
                    "isTest": True
                }
                record_game_in_state(test_game)
                save_state()
            self._send_json({"success": True, "testGame": test_game})
            return

        self.send_error(404, "Endpoint not found")

def find_available_port(start_port=5050):
    for port in range(start_port, start_port + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port

def run_server():
    load_state()
    port = find_available_port(PORT)
    server_address = ("127.0.0.1", port)

    httpd = HTTPServer(server_address, OverlayRequestHandler)

    t = threading.Thread(target=poller_thread, daemon=True)
    t.start()

    print("\n" + "=" * 65)
    print(" ♚ CHESS.COM STREAM OVERLAY SERVER RUNNING")
    print("=" * 65)
    print(f" Control Dashboard : http://localhost:{port}/control.html")
    print(f" OBS Overlay URL   : http://localhost:{port}/overlay.html")
    print("=" * 65)
    print(" [!] IMPORTANT: Keep this window OPEN or MINIMIZED while streaming.")
    print(" Press Ctrl+C to stop.\n")

    try:
        webbrowser.open(f"http://localhost:{port}/control.html")
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run_server()
