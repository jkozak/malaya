"use strict";

// Help overlay component

const ansi  = require('./ansi.js');
const chalk = require('chalk');

class HelpOverlay {
    constructor(options = {}) {
        this.visible = false;
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    toggle() {
        this.visible = !this.visible;
    }

    updateSize() {
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;
    }

    _getHelpLines() {
        return [
            '',
            chalk.bold('  TUI Commands (entered with :)'),
            '',
            '    :q, :quit      Quit TUI',
            '    :clear         Clear output buffer',
            '    :scroll N      Jump to line N',
            '    :help          Show this help',
            '    :query EXPR    Execute query against store',
            '    :facts [PAT]   Show facts (optionally filtered)',
            '    :mode MODE     Change engine mode (master/slave/idle)',
            '    :save          Trigger world save',
            '    :debug         Toggle debug tracing',
            '',
            chalk.bold('  Keyboard (Normal Mode)'),
            '',
            '    j / Down       Scroll down one line',
            '    k / Up         Scroll up one line',
            '    Ctrl-d / PgDn  Scroll down half page',
            '    Ctrl-u / PgUp  Scroll up half page',
            '    gg / Home      Go to top',
            '    ge / End       Go to bottom',
            '    /              Search forward',
            '    ?              Search backward',
            '    n              Next match',
            '    N              Previous match',
            '    >              Next interaction block',
            '    <              Previous interaction block',
            '    :              Enter command mode',
            '    q              Quit TUI',
            '    Ctrl-l         Redraw screen',
            '',
            chalk.bold('  Keyboard (Command Mode)'),
            '',
            '    Escape         Cancel command',
            '    Enter          Execute command',
            '    Up/Down        Browse history',
            '    Ctrl-u         Clear line',
            '    Ctrl-w         Delete word',
            '',
            chalk.dim('  Press ESC to close'),
            ''
        ];
    }

    render(stream) {
        if (!this.visible)
            return;

        this.updateSize();

        const lines = this._getHelpLines();
        const boxWidth = Math.min(60, this.width - 4);
        const boxHeight = Math.min(lines.length + 2, this.height - 4);
        const startRow = Math.floor((this.height - boxHeight) / 2);
        const startCol = Math.floor((this.width - boxWidth) / 2);

        // Draw box with content
        const topBorder = '┌' + '─'.repeat(boxWidth - 2) + '┐';
        const bottomBorder = '└' + '─'.repeat(boxWidth - 2) + '┘';

        // Top border
        stream.write(
            ansi.moveCursor(startRow, startCol) +
            chalk.cyan(topBorder)
        );

        // Content lines
        for (let i = 0; i < boxHeight - 2; i++) {
            const row = startRow + 1 + i;
            const lineIndex = i;
            const line = lineIndex < lines.length ? lines[lineIndex] : '';

            // Pad or truncate line to fit box
            const visibleLen = this._visibleLength(line);
            const contentWidth = boxWidth - 4;  // Account for borders and padding
            let content;
            if (visibleLen > contentWidth) {
                content = this._truncateToWidth(line, contentWidth);
            } else {
                content = line + ' '.repeat(contentWidth - visibleLen);
            }

            stream.write(
                ansi.moveCursor(row, startCol) +
                chalk.cyan('│') + ' ' + content + ' ' + chalk.cyan('│')
            );
        }

        // Bottom border
        stream.write(
            ansi.moveCursor(startRow + boxHeight - 1, startCol) +
            chalk.cyan(bottomBorder)
        );
    }

    _visibleLength(text) {
        /* eslint-disable-next-line no-control-regex */
        return text.replace(/\x1b\[[0-9;]*m/g, '').length;
    }

    _truncateToWidth(text, width) {
        let visibleLen = 0;
        let i = 0;
        while (i < text.length && visibleLen < width) {
            if (text[i] === '\x1b' && text[i + 1] === '[') {
                /* eslint-disable-next-line no-control-regex */
                const match = text.slice(i).match(/^\x1b\[[0-9;]*m/);
                if (match) {
                    i += match[0].length;
                    continue;
                }
            }
            visibleLen++;
            i++;
        }
        return text.slice(0, i);
    }
}

module.exports = HelpOverlay;
