"use strict";

// ANSI escape sequences for terminal control

const ESC = '\x1b';
const CSI = ESC + '[';

// Screen management
exports.enterAltScreen = () => CSI + '?1049h';
exports.exitAltScreen  = () => CSI + '?1049l';

// Scrolling region
exports.setScrollRegion = (top, bottom) => `${CSI}${top};${bottom}r`;
exports.resetScrollRegion = () => CSI + 'r';

// Cursor positioning
exports.moveCursor = (row, col) => `${CSI}${row};${col}H`;
exports.moveCursorUp = (n = 1) => `${CSI}${n}A`;
exports.moveCursorDown = (n = 1) => `${CSI}${n}B`;
exports.saveCursor = () => CSI + 's';
exports.restoreCursor = () => CSI + 'u';

// Cursor visibility
exports.hideCursor = () => CSI + '?25l';
exports.showCursor = () => CSI + '?25h';

// Line clearing
exports.clearLine = () => CSI + '2K';
exports.clearToEndOfLine = () => CSI + 'K';
exports.clearToStartOfLine = () => CSI + '1K';

// Screen clearing
exports.clearScreen = () => CSI + '2J';
exports.clearScrollback = () => CSI + '3J';

// Text attributes
exports.reset = () => CSI + '0m';
exports.bold = () => CSI + '1m';
exports.dim = () => CSI + '2m';
exports.italic = () => CSI + '3m';
exports.underline = () => CSI + '4m';
exports.inverse = () => CSI + '7m';

// Colors (foreground)
exports.fg = {
    black:   () => CSI + '30m',
    red:     () => CSI + '31m',
    green:   () => CSI + '32m',
    yellow:  () => CSI + '33m',
    blue:    () => CSI + '34m',
    magenta: () => CSI + '35m',
    cyan:    () => CSI + '36m',
    white:   () => CSI + '37m',
    default: () => CSI + '39m'
};

// Colors (background)
exports.bg = {
    black:   () => CSI + '40m',
    red:     () => CSI + '41m',
    green:   () => CSI + '42m',
    yellow:  () => CSI + '43m',
    blue:    () => CSI + '44m',
    magenta: () => CSI + '45m',
    cyan:    () => CSI + '46m',
    white:   () => CSI + '47m',
    default: () => CSI + '49m'
};

// Mouse tracking (optional, for future use)
exports.enableMouse = () => CSI + '?1000h';
exports.disableMouse = () => CSI + '?1000l';

// Bracketed paste mode
exports.enableBracketedPaste = () => CSI + '?2004h';
exports.disableBracketedPaste = () => CSI + '?2004l';
