"use strict";

// Keyboard input handling

class KeyBindings {
    constructor(tui) {
        this.tui = tui;
        this.mode = 'normal';  // 'normal', 'command', or 'search'
        this._stdinHandler = null;
        this._wasRaw = false;
        this._pendingKey = null;  // For multi-key sequences like gg, ge
        this._pendingTimeout = null;
    }

    start() {
        if (!process.stdin.isTTY)
            return;

        this._wasRaw = process.stdin.isRaw;
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        this._stdinHandler = (key) => this._handleKey(key);
        process.stdin.on('data', this._stdinHandler);
    }

    stop() {
        if (this._stdinHandler) {
            process.stdin.removeListener('data', this._stdinHandler);
            this._stdinHandler = null;
        }
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(this._wasRaw);
            process.stdin.pause();
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.tui.statusLine.setMode(mode);
    }

    _handleKey(key) {
        // Parse escape sequences
        const parsed = this._parseKey(key);

        if (this.mode === 'command') {
            this._handleCommandMode(parsed);
        } else if (this.mode === 'search') {
            this._handleSearchMode(parsed);
        } else {
            this._handleNormalMode(parsed);
        }

        this.tui.render();
    }

    _parseKey(key) {
        // Handle special keys
        if (key === '\x1b' || key === '\x1b\x1b')
            return { name: 'escape' };
        if (key === '\r' || key === '\n')
            return { name: 'enter' };
        if (key === '\x7f' || key === '\b')
            return { name: 'backspace' };
        if (key === '\t')
            return { name: 'tab' };
        if (key === '\x03')
            return { name: 'ctrl-c' };
        if (key === '\x04')
            return { name: 'ctrl-d' };
        if (key === '\x15')
            return { name: 'ctrl-u' };
        if (key === '\x17')
            return { name: 'ctrl-w' };
        if (key === '\x01')
            return { name: 'ctrl-a' };
        if (key === '\x05')
            return { name: 'ctrl-e' };
        if (key === '\x0c')
            return { name: 'ctrl-l' };

        // Arrow keys and other escape sequences
        if (key.startsWith('\x1b[') || key.startsWith('\x1bO')) {
            const seq = key.slice(2);
            switch (seq) {
            case 'A': return { name: 'up' };
            case 'B': return { name: 'down' };
            case 'C': return { name: 'right' };
            case 'D': return { name: 'left' };
            case 'H': return { name: 'home' };
            case 'F': return { name: 'end' };
            case '3~': return { name: 'delete' };
            case '5~': return { name: 'pageup' };
            case '6~': return { name: 'pagedown' };
            }
        }

        // Regular character
        if (key.length === 1 && key >= ' ')
            return { name: 'char', char: key };

        return { name: 'unknown', raw: key };
    }

    _handleNormalMode(key) {
        // If help is visible, ESC dismisses it
        if (this.tui.isHelpVisible()) {
            if (key.name === 'escape') {
                this.tui._hideHelp();
                this._clearPending();
                return;
            }
            // Ignore other keys when help is shown
            return;
        }

        // Get the effective key (either the char or the key name)
        const ch = key.name === 'char' ? key.char : null;

        // Handle pending key sequences (like gg, ge)
        if (this._pendingKey === 'g') {
            this._clearPending();
            if (ch === 'g') {
                this.tui.screen.scrollToTop();
                return;
            } else if (ch === 'e') {
                this.tui.screen.scrollToBottom();
                return;
            }
            // If not a valid sequence, fall through to handle as normal key
        }

        // Handle special keys first
        switch (key.name) {
        case 'escape':
            this._clearPending();
            this.tui.screen.clearSearch();  // Clear search highlighting
            this.tui.screen.clearBlockSelection();  // Clear block selection
            break;

        case 'ctrl-c':
            this.tui.quit();
            break;

        case 'down':
            this.tui.screen.scrollDown(1);
            break;

        case 'up':
            this.tui.screen.scrollUp(1);
            break;

        case 'ctrl-d':
        case 'pagedown':
            this.tui.screen.pageDown();
            break;

        case 'ctrl-u':
        case 'pageup':
            this.tui.screen.pageUp();
            break;

        case 'home':
            this.tui.screen.scrollToTop();
            break;

        case 'end':
            this.tui.screen.scrollToBottom();
            break;

        case 'ctrl-l':
            this.tui.fullRender();
            break;

        case 'char':
            this._handleNormalChar(ch);
            break;
        }
    }

    _handleNormalChar(ch) {
        // Check for custom keybinding first
        const customKey = this.tui.getCustomKey(ch);
        if (customKey) {
            this._clearPending();
            try {
                customKey();
            } catch (e) {
                this.tui.appendOutput(`Key error: ${e.message}`);
            }
            return;
        }

        switch (ch) {
        case 'q':
            this.tui.quit();
            break;

        case 'j':
            this.tui.screen.scrollDown(1);
            break;

        case 'k':
            this.tui.screen.scrollUp(1);
            break;

        case 'g':
            // Start pending sequence for gg/ge
            this._setPending('g');
            break;

        case 'h':
            this.tui._showHelp();
            break;

        case ':':
            this._clearPending();
            this.setMode('command');
            this.tui.command.show();
            break;

        case '/':
            this._clearPending();
            this.setMode('search');
            this.tui.showSearch(true);  // forward
            break;

        case '?':
            this._clearPending();
            this.setMode('search');
            this.tui.showSearch(false);  // backward
            break;

        case 'n':
            this._clearPending();
            this.tui.searchNext();
            break;

        case 'N':
            this._clearPending();
            this.tui.searchPrev();
            break;

        case '<':
            this._clearPending();
            if (this.tui.screen.prevBlock() !== 'ok')
                this.tui.beep();
            break;

        case '>':
            this._clearPending();
            if (this.tui.screen.nextBlock() !== 'ok')
                this.tui.beep();
            break;
        }
    }

    _setPending(key) {
        this._pendingKey = key;
        // Clear pending after a timeout (500ms)
        if (this._pendingTimeout)
            clearTimeout(this._pendingTimeout);
        this._pendingTimeout = setTimeout(() => {
            this._pendingKey = null;
            this._pendingTimeout = null;
        }, 500);
    }

    _clearPending() {
        this._pendingKey = null;
        if (this._pendingTimeout) {
            clearTimeout(this._pendingTimeout);
            this._pendingTimeout = null;
        }
    }

    _handleCommandMode(key) {
        switch (key.name) {
        case 'escape':
            this.setMode('normal');
            this.tui.command.hide();
            break;

        case 'enter':
            this._executeCommand();
            break;

        case 'backspace':
            this.tui.command.deleteChar();
            break;

        case 'delete':
            this.tui.command.deleteCharForward();
            break;

        case 'left':
            this.tui.command.moveCursorLeft();
            break;

        case 'right':
            this.tui.command.moveCursorRight();
            break;

        case 'up':
            this.tui.command.historyPrev();
            break;

        case 'down':
            this.tui.command.historyNext();
            break;

        case 'ctrl-a':
        case 'home':
            this.tui.command.moveCursorHome();
            break;

        case 'ctrl-e':
        case 'end':
            this.tui.command.moveCursorEnd();
            break;

        case 'ctrl-w':
            this.tui.command.deleteWord();
            break;

        case 'ctrl-u':
            this.tui.command.clearLine();
            break;

        case 'ctrl-c':
            this.setMode('normal');
            this.tui.command.hide();
            break;

        case 'char':
            this.tui.command.insertChar(key.char);
            break;
        }
    }

    _executeCommand() {
        const cmd = this.tui.command.getCommand().trim();
        this.tui.command.addToHistory(cmd);
        this.setMode('normal');
        this.tui.command.hide();

        if (cmd.length === 0)
            return;

        this.tui.executeCommand(cmd);
    }

    _handleSearchMode(key) {
        switch (key.name) {
        case 'escape':
            this.setMode('normal');
            this.tui.hideSearch();
            break;

        case 'enter':
            this._executeSearch();
            break;

        case 'backspace':
            this.tui.search.deleteChar();
            this.tui.incrementalSearch();
            break;

        case 'delete':
            this.tui.search.deleteCharForward();
            this.tui.incrementalSearch();
            break;

        case 'left':
            this.tui.search.moveCursorLeft();
            break;

        case 'right':
            this.tui.search.moveCursorRight();
            break;

        case 'up':
            this.tui.search.historyPrev();
            this.tui.incrementalSearch();
            break;

        case 'down':
            this.tui.search.historyNext();
            this.tui.incrementalSearch();
            break;

        case 'ctrl-a':
        case 'home':
            this.tui.search.moveCursorHome();
            break;

        case 'ctrl-e':
        case 'end':
            this.tui.search.moveCursorEnd();
            break;

        case 'ctrl-w':
            this.tui.search.deleteWord();
            this.tui.incrementalSearch();
            break;

        case 'ctrl-u':
            this.tui.search.clearLine();
            this.tui.incrementalSearch();
            break;

        case 'ctrl-c':
            this.setMode('normal');
            this.tui.hideSearch();
            break;

        case 'char':
            this.tui.search.insertChar(key.char);
            this.tui.incrementalSearch();
            break;
        }
    }

    _executeSearch() {
        const term = this.tui.search.getCommand().trim();
        if (term.length > 0) {
            this.tui.search.addToHistory(term);
            this.tui.confirmSearch(term);
        }
        this.setMode('normal');
        this.tui.hideSearch(false);  // Keep highlighting after confirmed search
    }
}

module.exports = KeyBindings;
