"use strict";

// Command popup component (vi/helix-style)

const ansi  = require('./ansi.js');
const chalk = require('chalk');

class CommandPopup {
    constructor(options = {}) {
        this.row = options.row || (process.stdout.rows - 1) || 23;
        this.width = process.stdout.columns || 80;
        this.visible = false;
        this.input = '';
        this.cursorPos = 0;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = options.maxHistory || 100;
        this._tempInput = '';  // Store input when browsing history
        this.promptChar = options.promptChar || ':';
    }

    updatePosition(row) {
        this.row = row;
        this.width = process.stdout.columns || 80;
    }

    show() {
        this.visible = true;
        this.input = '';
        this.cursorPos = 0;
        this.historyIndex = -1;
        this._tempInput = '';
    }

    hide() {
        this.visible = false;
        this.input = '';
        this.cursorPos = 0;
        this.historyIndex = -1;
    }

    addToHistory(cmd) {
        if (cmd.trim().length === 0)
            return;
        // Don't add duplicates of the last command
        if (this.history.length > 0 && this.history[this.history.length - 1] === cmd)
            return;
        this.history.push(cmd);
        if (this.history.length > this.maxHistory)
            this.history.shift();
    }

    getCommand() {
        return this.input;
    }

    insertChar(char) {
        this.input = this.input.slice(0, this.cursorPos) + char + this.input.slice(this.cursorPos);
        this.cursorPos++;
    }

    deleteChar() {
        if (this.cursorPos > 0) {
            this.input = this.input.slice(0, this.cursorPos - 1) + this.input.slice(this.cursorPos);
            this.cursorPos--;
        }
    }

    deleteCharForward() {
        if (this.cursorPos < this.input.length) {
            this.input = this.input.slice(0, this.cursorPos) + this.input.slice(this.cursorPos + 1);
        }
    }

    moveCursorLeft() {
        if (this.cursorPos > 0)
            this.cursorPos--;
    }

    moveCursorRight() {
        if (this.cursorPos < this.input.length)
            this.cursorPos++;
    }

    moveCursorHome() {
        this.cursorPos = 0;
    }

    moveCursorEnd() {
        this.cursorPos = this.input.length;
    }

    historyPrev() {
        if (this.history.length === 0)
            return;
        if (this.historyIndex === -1) {
            this._tempInput = this.input;
            this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
            this.historyIndex--;
        }
        this.input = this.history[this.historyIndex];
        this.cursorPos = this.input.length;
    }

    historyNext() {
        if (this.historyIndex === -1)
            return;
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.input = this.history[this.historyIndex];
        } else {
            this.historyIndex = -1;
            this.input = this._tempInput;
        }
        this.cursorPos = this.input.length;
    }

    deleteWord() {
        // Delete word backwards (like Ctrl-W in bash)
        let pos = this.cursorPos;
        // Skip trailing spaces
        while (pos > 0 && this.input[pos - 1] === ' ')
            pos--;
        // Delete until space or start
        while (pos > 0 && this.input[pos - 1] !== ' ')
            pos--;
        this.input = this.input.slice(0, pos) + this.input.slice(this.cursorPos);
        this.cursorPos = pos;
    }

    clearLine() {
        this.input = '';
        this.cursorPos = 0;
    }

    setPromptChar(ch) {
        this.promptChar = ch;
    }

    render(stream) {
        if (!this.visible) {
            // Clear the command line when not visible
            stream.write(
                ansi.moveCursor(this.row, 1) +
                ansi.clearLine()
            );
            return;
        }

        const prompt = this.promptChar;
        const maxInputWidth = this.width - 2;  // Leave room for prompt and cursor
        let displayInput = this.input;
        let displayCursorPos = this.cursorPos;

        // Handle input longer than screen width
        if (displayInput.length > maxInputWidth) {
            const start = Math.max(0, this.cursorPos - maxInputWidth + 10);
            displayInput = displayInput.slice(start, start + maxInputWidth);
            displayCursorPos = this.cursorPos - start;
        }

        // Pad to fill the line with background color
        const contentLen = 1 + displayInput.length;  // prompt + input
        const padding = ' '.repeat(Math.max(0, this.width - contentLen));

        stream.write(
            ansi.moveCursor(this.row, 1) +
            ansi.clearLine() +
            chalk.bgBlue.white(prompt + displayInput + padding) +
            ansi.moveCursor(this.row, 2 + displayCursorPos) +
            ansi.showCursor()
        );
    }
}

module.exports = CommandPopup;
