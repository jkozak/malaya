"use strict";

// Status line component

const ansi  = require('./ansi.js');
const chalk = require('chalk');

class StatusLine {
    constructor(options = {}) {
        this.row = options.row || process.stdout.rows || 24;
        this.width = process.stdout.columns || 80;
        this._engine = null;
        this._screen = null;
        this._mode = 'normal';
        this._searchInfo = null;
        this._blockInfo = null;
    }

    setEngine(engine) {
        this._engine = engine;
    }

    setScreen(screen) {
        this._screen = screen;
    }

    setMode(mode) {
        this._mode = mode;
    }

    setSearchInfo(info) {
        this._searchInfo = info;
    }

    setBlockInfo(info) {
        this._blockInfo = info;
    }

    updatePosition(row) {
        this.row = row;
        this.width = process.stdout.columns || 80;
    }

    _getEngineMode() {
        if (this._engine && this._engine.mode)
            return this._engine.mode;
        return 'n/a';
    }

    _getFactCount() {
        if (this._engine && this._engine.chrjs && typeof this._engine.chrjs.size === 'number')
            return this._engine.chrjs.size;
        return 0;
    }

    _getMemory() {
        const mem = process.memoryUsage();
        return Math.round(mem.heapUsed / 1024 / 1024);
    }

    _getScrollPosition() {
        if (!this._screen)
            return '0/0';
        const current = this._screen.scrollOffset + 1;
        const total = this._screen.totalLines;
        if (total === 0)
            return '0/0';
        return `${Math.min(current, total)}/${total}`;
    }

    _formatMode(mode) {
        const modeColors = {
            master:  chalk.green,
            slave:   chalk.yellow,
            idle:    chalk.gray,
            broken:  chalk.red,
            'n/a':   chalk.gray
        };
        const colorFn = modeColors[mode] || chalk.white;
        return colorFn(`[${mode.toUpperCase()}]`);
    }

    _formatInputMode(mode) {
        const modeIndicators = {
            normal:  chalk.cyan('NORMAL'),
            command: chalk.yellow('COMMAND'),
            search:  chalk.magenta('SEARCH')
        };
        return modeIndicators[mode] || chalk.white(mode.toUpperCase());
    }

    getContent() {
        const engineMode = this._getEngineMode();
        const facts = this._getFactCount();
        const mem = this._getMemory();
        const scroll = this._getScrollPosition();
        const inputMode = this._formatInputMode(this._mode);

        let left = `${this._formatMode(engineMode)} ${inputMode}`;

        // Add search info if available
        if (this._searchInfo) {
            const searchStr = chalk.cyan(`[${this._searchInfo.current}/${this._searchInfo.total}]`);
            left += ` ${searchStr}`;
        }

        // Add block navigation info if available
        if (this._blockInfo) {
            const blockStr = chalk.magenta(`<${this._blockInfo.current}/${this._blockInfo.total}>`);
            left += ` ${blockStr}`;
        }

        const right = `facts:${facts} mem:${mem}MB scroll:${scroll}`;

        // Calculate padding
        /* eslint-disable-next-line no-control-regex */
        const leftLen = chalk.reset(left).replace(/\x1b\[[0-9;]*m/g, '').length;
        const rightLen = right.length;
        const padding = Math.max(1, this.width - leftLen - rightLen - 2);

        return left + ' '.repeat(padding) + chalk.dim(right);
    }

    render(stream) {
        const content = this.getContent();
        stream.write(
            ansi.moveCursor(this.row, 1) +
            ansi.clearLine() +
            ansi.inverse() +
            content +
            ansi.reset()
        );
    }
}

module.exports = StatusLine;
