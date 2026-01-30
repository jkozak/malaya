"use strict";

// Output buffer and scrolling management

const ansi = require('./ansi.js');
const chalk = require('chalk');

class Screen {
    constructor(options = {}) {
        this.lines = [];
        this.scrollOffset = 0;
        this.maxLines = options.maxLines || 10000;
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;
        this.scrollRegionTop = 1;
        this.scrollRegionBottom = this.height - 2;  // Leave room for command + status
        this._resizeHandler = null;

        // Search state
        this.searchTerm = '';
        this.searchMatches = [];  // Array of line indices that match
        this.currentMatchIndex = -1;
        this._searchCaseSensitive = false;

        // Interaction block navigation state
        this.currentBlockIndex = -1;  // Index into _blockStarts
        this._blockStarts = [];       // Line indices where blocks start ("> ")
    }

    get viewportHeight() {
        return this.scrollRegionBottom - this.scrollRegionTop + 1;
    }

    get totalLines() {
        return this.lines.length;
    }

    get atBottom() {
        return this.scrollOffset >= this.lines.length - this.viewportHeight;
    }

    get visibleRange() {
        const start = Math.max(0, this.scrollOffset);
        const end = Math.min(this.lines.length, start + this.viewportHeight);
        return { start, end };
    }

    init() {
        this._resizeHandler = () => this.handleResize();
        process.stdout.on('resize', this._resizeHandler);
        this.handleResize();
    }

    destroy() {
        if (this._resizeHandler) {
            process.stdout.removeListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
    }

    handleResize() {
        const wasAtBottom = this.atBottom;
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;
        this.scrollRegionBottom = this.height - 2;
        if (wasAtBottom)
            this.scrollToBottom();
    }

    appendLine(text) {
        const wasAtBottom = this.atBottom;
        const wrappedLines = this._wrapText(text);
        for (const line of wrappedLines) {
            const lineIndex = this.lines.length;
            this.lines.push(line);

            // Track interaction block starts (lines beginning with "> ")
            const stripped = this._stripAnsi(line);
            if (stripped.startsWith('> ')) {
                this._blockStarts.push(lineIndex);
            }

            if (this.lines.length > this.maxLines) {
                this.lines.shift();
                // Adjust block indices when lines are removed
                this._blockStarts = this._blockStarts
                    .map(i => i - 1)
                    .filter(i => i >= 0);
                if (this.currentBlockIndex >= 0 && this._blockStarts.length > 0) {
                    this.currentBlockIndex = Math.min(this.currentBlockIndex, this._blockStarts.length - 1);
                }
            }
        }
        if (wasAtBottom)
            this.scrollToBottom();
    }

    appendLines(lines) {
        for (const line of lines)
            this.appendLine(line);
    }

    _wrapText(text) {
        // Handle text that may contain ANSI codes
        // For simplicity, we'll do basic wrapping
        const lines = [];
        const rawLines = text.split('\n');
        for (const rawLine of rawLines) {
            if (this._visibleLength(rawLine) <= this.width) {
                lines.push(rawLine);
            } else {
                // Simple wrap without breaking ANSI codes
                let remaining = rawLine;
                while (this._visibleLength(remaining) > this.width) {
                    const {text: chunk, rest} = this._splitAtWidth(remaining, this.width);
                    lines.push(chunk);
                    remaining = rest;
                }
                if (remaining.length > 0)
                    lines.push(remaining);
            }
        }
        return lines;
    }

    _visibleLength(text) {
        // Remove ANSI escape sequences to get visible length
        /* eslint-disable-next-line no-control-regex */
        return text.replace(/\x1b\[[0-9;]*m/g, '').length;
    }

    _splitAtWidth(text, width) {
        // Split text at width, accounting for ANSI codes
        let visibleLen = 0;
        let i = 0;
        while (i < text.length && visibleLen < width) {
            if (text[i] === '\x1b' && text[i + 1] === '[') {
                // Skip ANSI escape sequence
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
        return {text: text.slice(0, i), rest: text.slice(i)};
    }

    clear() {
        this.lines = [];
        this.scrollOffset = 0;
        this._blockStarts = [];
        this.currentBlockIndex = -1;
    }

    scrollUp(lines = 1) {
        this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    }

    scrollDown(lines = 1) {
        const maxOffset = Math.max(0, this.lines.length - this.viewportHeight);
        this.scrollOffset = Math.min(maxOffset, this.scrollOffset + lines);
    }

    scrollToTop() {
        this.scrollOffset = 0;
    }

    scrollToBottom() {
        this.scrollOffset = Math.max(0, this.lines.length - this.viewportHeight);
    }

    scrollToLine(lineNum) {
        const maxOffset = Math.max(0, this.lines.length - this.viewportHeight);
        this.scrollOffset = Math.max(0, Math.min(maxOffset, lineNum));
    }

    pageUp() {
        this.scrollUp(Math.floor(this.viewportHeight / 2));
    }

    pageDown() {
        this.scrollDown(Math.floor(this.viewportHeight / 2));
    }

    getVisibleLines() {
        const {start, end} = this.visibleRange;
        const currentBlockLine = this.getCurrentBlockLine();

        return this.lines.slice(start, end).map((line, i) => {
            const absoluteIndex = start + i;
            let result = line;

            // Highlight the ">" on the current block's start line
            if (absoluteIndex === currentBlockLine) {
                result = this._highlightBlockMarker(result);
            }

            // If there's a search term, highlight matches
            if (this.searchTerm) {
                result = this._highlightMatches(result);
            }

            return result;
        });
    }

    _highlightBlockMarker(line) {
        const stripped = this._stripAnsi(line);
        if (!stripped.startsWith('> '))
            return line;

        // Find the ">" in the line (might have ANSI codes before it)
        /* eslint-disable-next-line no-control-regex, security/detect-unsafe-regex */
        const match = line.match(/^(\x1b\[[0-9;]*m)*(>)/);
        if (match) {
            const prefix = match[1] || '';
            const rest = line.slice(match[0].length);
            return prefix + chalk.black.bgCyan('>') + rest;
        }
        return line;
    }

    _highlightMatches(line) {
        if (!this.searchTerm)
            return line;

        // Escape special regex characters in search term
        const escaped = this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use smart case: 'gi' for case-insensitive, 'g' for case-sensitive
        const flags = this._searchCaseSensitive ? 'g' : 'gi';
        /* eslint-disable-next-line security/detect-non-literal-regexp */
        const regex = new RegExp(`(${escaped})`, flags);

        // Split line into ANSI sequences and regular text
        // We'll only highlight in regular text parts
        const parts = [];
        let lastIndex = 0;
        /* eslint-disable-next-line no-control-regex */
        const ansiRegex = /\x1b\[[0-9;]*m/g;
        let match;

        while ((match = ansiRegex.exec(line)) !== null) {
            // Text before this ANSI sequence
            if (match.index > lastIndex) {
                const text = line.slice(lastIndex, match.index);
                parts.push({type: 'text', value: text});
            }
            // The ANSI sequence itself
            parts.push({type: 'ansi', value: match[0]});
            lastIndex = ansiRegex.lastIndex;
        }
        // Remaining text after last ANSI sequence
        if (lastIndex < line.length) {
            parts.push({type: 'text', value: line.slice(lastIndex)});
        }

        // Highlight matches in text parts only
        return parts.map(part => {
            if (part.type === 'ansi')
                return part.value;
            return part.value.replace(regex, chalk.black.bgYellow('$1'));
        }).join('');
    }

    // Search functionality
    search(term) {
        this.searchTerm = term;
        this.searchMatches = [];
        this.currentMatchIndex = -1;

        if (!term)
            return false;

        // Smart case: lowercase = case-insensitive, any uppercase = case-sensitive
        const hasUppercase = term !== term.toLowerCase();
        this._searchCaseSensitive = hasUppercase;

        // Find all matching lines (search in stripped text)
        for (let i = 0; i < this.lines.length; i++) {
            const stripped = this._stripAnsi(this.lines[i]);
            const matches = hasUppercase
                ? stripped.includes(term)
                : stripped.toLowerCase().includes(term.toLowerCase());
            if (matches) {
                this.searchMatches.push(i);
            }
        }

        return this.searchMatches.length > 0;
    }

    nextMatch() {
        if (this.searchMatches.length === 0)
            return 'empty';

        // Find next match from current scroll position
        if (this.currentMatchIndex === -1) {
            // Find first match at or after current scroll position
            for (let i = 0; i < this.searchMatches.length; i++) {
                if (this.searchMatches[i] >= this.scrollOffset) {
                    this.currentMatchIndex = i;
                    break;
                }
            }
            // If no match found after scroll position, use first
            if (this.currentMatchIndex === -1)
                this.currentMatchIndex = 0;
        } else if (this.currentMatchIndex < this.searchMatches.length - 1) {
            this.currentMatchIndex++;
        } else {
            // At end, don't wrap
            return 'end';
        }

        // Scroll to show the match
        this._scrollToMatch();
        return 'ok';
    }

    prevMatch() {
        if (this.searchMatches.length === 0)
            return 'empty';

        if (this.currentMatchIndex === -1) {
            // Find last match at or before current scroll position
            for (let i = this.searchMatches.length - 1; i >= 0; i--) {
                if (this.searchMatches[i] <= this.scrollOffset + this.viewportHeight) {
                    this.currentMatchIndex = i;
                    break;
                }
            }
            // If no match found, use last match
            if (this.currentMatchIndex === -1)
                this.currentMatchIndex = this.searchMatches.length - 1;
        } else if (this.currentMatchIndex > 0) {
            this.currentMatchIndex--;
        } else {
            // At start, don't wrap
            return 'start';
        }

        this._scrollToMatch();
        return 'ok';
    }

    _scrollToMatch() {
        if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.searchMatches.length)
            return;

        const matchLine = this.searchMatches[this.currentMatchIndex];
        // Center the match in the viewport if possible
        const targetOffset = Math.max(0, matchLine - Math.floor(this.viewportHeight / 2));
        this.scrollToLine(targetOffset);
    }

    clearSearch() {
        this.searchTerm = '';
        this.searchMatches = [];
        this.currentMatchIndex = -1;
    }

    getMatchInfo() {
        if (this.searchMatches.length === 0)
            return null;
        return {
            current: this.currentMatchIndex + 1,
            total: this.searchMatches.length,
            term: this.searchTerm
        };
    }

    _stripAnsi(text) {
        /* eslint-disable-next-line no-control-regex */
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    // Interaction block navigation
    nextBlock() {
        if (this._blockStarts.length === 0)
            return 'empty';

        if (this.currentBlockIndex < 0) {
            // Find first block at or after current scroll position
            for (let i = 0; i < this._blockStarts.length; i++) {
                if (this._blockStarts[i] >= this.scrollOffset) {
                    this.currentBlockIndex = i;
                    break;
                }
            }
            if (this.currentBlockIndex < 0)
                this.currentBlockIndex = 0;
        } else if (this.currentBlockIndex < this._blockStarts.length - 1) {
            this.currentBlockIndex++;
        } else {
            // At end, don't wrap
            return 'end';
        }

        this._scrollToBlock();
        return 'ok';
    }

    prevBlock() {
        if (this._blockStarts.length === 0)
            return 'empty';

        if (this.currentBlockIndex < 0) {
            // Find last block at or before current scroll position
            for (let i = this._blockStarts.length - 1; i >= 0; i--) {
                if (this._blockStarts[i] <= this.scrollOffset + this.viewportHeight) {
                    this.currentBlockIndex = i;
                    break;
                }
            }
            if (this.currentBlockIndex < 0)
                this.currentBlockIndex = this._blockStarts.length - 1;
        } else if (this.currentBlockIndex > 0) {
            this.currentBlockIndex--;
        } else {
            // At start, don't wrap
            return 'start';
        }

        this._scrollToBlock();
        return 'ok';
    }

    _scrollToBlock() {
        if (this.currentBlockIndex < 0 || this.currentBlockIndex >= this._blockStarts.length)
            return;

        const blockLine = this._blockStarts[this.currentBlockIndex];
        // Put the block near the top of the viewport
        const targetOffset = Math.max(0, blockLine - 2);
        this.scrollToLine(targetOffset);
    }

    clearBlockSelection() {
        this.currentBlockIndex = -1;
    }

    getBlockInfo() {
        if (this._blockStarts.length === 0 || this.currentBlockIndex < 0)
            return null;
        return {
            current: this.currentBlockIndex + 1,
            total: this._blockStarts.length
        };
    }

    getCurrentBlockLine() {
        if (this.currentBlockIndex < 0 || this.currentBlockIndex >= this._blockStarts.length)
            return -1;
        return this._blockStarts[this.currentBlockIndex];
    }

    render(stream) {
        const output = [];
        const visibleLines = this.getVisibleLines();

        // Set scroll region
        output.push(ansi.setScrollRegion(this.scrollRegionTop, this.scrollRegionBottom));

        // Render each line in the viewport
        for (let i = 0; i < this.viewportHeight; i++) {
            const row = this.scrollRegionTop + i;
            output.push(ansi.moveCursor(row, 1));
            output.push(ansi.clearLine());
            if (i < visibleLines.length) {
                output.push(visibleLines[i]);
            }
        }

        stream.write(output.join(''));
    }

    renderLine(stream, lineIndex) {
        // Render a single line (useful for incremental updates)
        const viewportLine = lineIndex - this.scrollOffset;
        if (viewportLine < 0 || viewportLine >= this.viewportHeight)
            return;

        const row = this.scrollRegionTop + viewportLine;
        const line = this.lines[lineIndex] || '';

        stream.write(
            ansi.moveCursor(row, 1) +
            ansi.clearLine() +
            line
        );
    }
}

module.exports = Screen;
