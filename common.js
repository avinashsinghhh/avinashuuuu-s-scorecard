/**
 * Chess Stream Overlay - Common Utilities & Chess.com API helpers
 */

const ChessResults = {
  WIN: 'win',
  LOSS: 'loss',
  DRAW: 'draw'
};

const LOSS_REASONS = new Set([
  'checkmated', 'timeout', 'resigned', 'abandoned', 'lose', 'bughousepartnerlose'
]);

const DRAW_REASONS = new Set([
  'agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'
]);

/**
 * Determine game outcome from the perspective of the given username.
 * Returns { outcome: 'win'|'loss'|'draw', userRating, oppRating, oppUsername, timeClass, url, endTime } or null
 */
function parseChessGame(game, username) {
  if (!game || !username) return null;
  const userLower = username.trim().toLowerCase();

  const white = game.white || {};
  const black = game.black || {};
  const whiteUser = (white.username || '').toLowerCase();
  const blackUser = (black.username || '').toLowerCase();

  const isWhite = whiteUser === userLower;
  const isBlack = blackUser === userLower;

  if (!isWhite && !isBlack) return null;

  const userData = isWhite ? white : black;
  const oppData = isWhite ? black : white;

  const userResult = (userData.result || '').toLowerCase();
  const oppResult = (oppData.result || '').toLowerCase();

  let outcome = ChessResults.DRAW;
  if (userResult === 'win') {
    outcome = ChessResults.WIN;
  } else if (LOSS_REASONS.has(userResult)) {
    outcome = ChessResults.LOSS;
  } else if (DRAW_REASONS.has(userResult) || DRAW_REASONS.has(oppResult)) {
    outcome = ChessResults.DRAW;
  } else if (oppResult === 'win') {
    outcome = ChessResults.LOSS;
  }

  return {
    outcome,
    userResult,
    oppResult,
    userRating: userData.rating ?? null,
    oppRating: oppData.rating ?? null,
    oppUsername: oppData.username || 'Opponent',
    userColor: isWhite ? 'white' : 'black',
    timeClass: game.time_class || 'unknown',
    timeControl: game.time_control || '',
    rated: !!game.rated,
    url: game.url || '',
    endTime: game.end_time || Math.floor(Date.now() / 1000)
  };
}

/**
 * Calculate win rate percentage string
 */
function calculateWinRate(wins, losses, draws) {
  const total = wins + losses + draws;
  if (total === 0) return '0%';
  const rate = ((wins / total) * 100).toFixed(0);
  return `${rate}%`;
}

/**
 * Format rating difference with explicit + or - sign
 */
function formatRatingDiff(diff) {
  if (diff === null || diff === undefined || isNaN(diff)) return '+0';
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return '±0';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ChessResults,
    parseChessGame,
    calculateWinRate,
    formatRatingDiff
  };
}
