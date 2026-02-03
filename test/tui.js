"use strict";

const assert = require('assert');

describe("TUI", function() {
    describe("Screen", function() {
        const Screen = require('../tui/screen.js');

        it("creates a screen", function() {
            const screen = new Screen();
            assert.strictEqual(screen.totalLines, 0);
            assert.strictEqual(screen.scrollOffset, 0);
        });

        it("appends lines", function() {
            const screen = new Screen();
            screen.appendLine("test line 1");
            screen.appendLine("test line 2");
            assert.strictEqual(screen.totalLines, 2);
        });

        it("scrolls down", function() {
            const screen = new Screen({maxLines: 100});
            screen.scrollRegionBottom = 5;  // Small viewport
            for (let i = 0; i < 20; i++) {
                screen.appendLine(`line ${i}`);
            }
            screen.scrollToTop();
            assert.strictEqual(screen.scrollOffset, 0);
            screen.scrollDown(5);
            assert.strictEqual(screen.scrollOffset, 5);
        });

        it("scrolls up", function() {
            const screen = new Screen({maxLines: 100});
            screen.scrollRegionBottom = 5;
            for (let i = 0; i < 20; i++) {
                screen.appendLine(`line ${i}`);
            }
            screen.scrollToBottom();
            const bottomOffset = screen.scrollOffset;
            screen.scrollUp(3);
            assert.strictEqual(screen.scrollOffset, bottomOffset - 3);
        });

        it("clears the screen", function() {
            const screen = new Screen();
            screen.appendLine("test");
            screen.clear();
            assert.strictEqual(screen.totalLines, 0);
        });

        it("respects maxLines", function() {
            const screen = new Screen({maxLines: 5});
            for (let i = 0; i < 10; i++) {
                screen.appendLine(`line ${i}`);
            }
            assert.strictEqual(screen.totalLines, 5);
        });

        it("searches for text", function() {
            const screen = new Screen();
            screen.appendLine("hello world");
            screen.appendLine("foo bar");
            screen.appendLine("hello again");
            const found = screen.search("hello");
            assert.strictEqual(found, true);
            assert.strictEqual(screen.searchMatches.length, 2);
            assert.deepStrictEqual(screen.searchMatches, [0, 2]);
        });

        it("searches case-insensitively with lowercase term", function() {
            const screen = new Screen();
            screen.appendLine("Hello World");
            screen.appendLine("HELLO AGAIN");
            screen.appendLine("hello there");
            const found = screen.search("hello");
            assert.strictEqual(found, true);
            assert.strictEqual(screen.searchMatches.length, 3);
        });

        it("searches case-sensitively with uppercase term", function() {
            const screen = new Screen();
            screen.appendLine("Hello World");
            screen.appendLine("HELLO AGAIN");
            screen.appendLine("hello there");
            const found = screen.search("Hello");
            assert.strictEqual(found, true);
            assert.strictEqual(screen.searchMatches.length, 1);
            assert.strictEqual(screen.searchMatches[0], 0);
        });

        it("navigates to next match", function() {
            const screen = new Screen();
            screen.scrollRegionBottom = 5;
            for (let i = 0; i < 20; i++) {
                screen.appendLine(i % 3 === 0 ? "FOUND here" : "nothing");
            }
            screen.scrollToTop();  // Reset to top before searching
            screen.search("FOUND");
            assert.strictEqual(screen.searchMatches.length, 7);
            screen.nextMatch();
            assert.strictEqual(screen.currentMatchIndex, 0);
            screen.nextMatch();
            assert.strictEqual(screen.currentMatchIndex, 1);
        });

        it("navigates to previous match", function() {
            const screen = new Screen();
            screen.scrollRegionBottom = 5;
            for (let i = 0; i < 20; i++) {
                screen.appendLine(i % 3 === 0 ? "FOUND here" : "nothing");
            }
            screen.scrollToTop();  // Reset to top before searching
            screen.search("FOUND");
            screen.nextMatch();
            screen.nextMatch();
            screen.prevMatch();
            assert.strictEqual(screen.currentMatchIndex, 0);
        });

        it("clears search", function() {
            const screen = new Screen();
            screen.appendLine("test");
            screen.search("test");
            screen.clearSearch();
            assert.strictEqual(screen.searchTerm, '');
            assert.strictEqual(screen.searchMatches.length, 0);
        });

        it("returns match info", function() {
            const screen = new Screen();
            screen.appendLine("test one");
            screen.appendLine("test two");
            screen.search("test");
            screen.nextMatch();
            const info = screen.getMatchInfo();
            assert.strictEqual(info.current, 1);
            assert.strictEqual(info.total, 2);
            assert.strictEqual(info.term, "test");
        });

        it("tracks interaction blocks", function() {
            const screen = new Screen();
            screen.appendLine("> first block");
            screen.appendLine("some content");
            screen.appendLine("");
            screen.appendLine("> second block");
            screen.appendLine("more content");
            assert.strictEqual(screen._blockStarts.length, 2);
            assert.deepStrictEqual(screen._blockStarts, [0, 3]);
        });

        it("navigates to next block", function() {
            const screen = new Screen();
            screen.scrollRegionBottom = 10;
            screen.appendLine("> first block");
            screen.appendLine("content");
            screen.appendLine("");
            screen.appendLine("> second block");
            screen.scrollToTop();
            assert.strictEqual(screen.nextBlock(), 'ok');
            assert.strictEqual(screen.currentBlockIndex, 0);
            assert.strictEqual(screen.nextBlock(), 'ok');
            assert.strictEqual(screen.currentBlockIndex, 1);
            assert.strictEqual(screen.nextBlock(), 'end');  // No wrap
        });

        it("navigates to previous block", function() {
            const screen = new Screen();
            screen.scrollRegionBottom = 10;
            screen.appendLine("> first block");
            screen.appendLine("");
            screen.appendLine("> second block");
            screen.scrollToTop();
            screen.nextBlock();
            screen.nextBlock();
            assert.strictEqual(screen.prevBlock(), 'ok');
            assert.strictEqual(screen.currentBlockIndex, 0);
            assert.strictEqual(screen.prevBlock(), 'start');  // No wrap
        });

        it("clears block selection", function() {
            const screen = new Screen();
            screen.appendLine("> block");
            screen.nextBlock();
            assert.strictEqual(screen.currentBlockIndex, 0);
            screen.clearBlockSelection();
            assert.strictEqual(screen.currentBlockIndex, -1);
        });

        it("returns block info", function() {
            const screen = new Screen();
            screen.appendLine("> first");
            screen.appendLine("> second");
            screen.nextBlock();
            const info = screen.getBlockInfo();
            assert.strictEqual(info.current, 1);
            assert.strictEqual(info.total, 2);
        });
    });

    describe("CommandPopup", function() {
        const CommandPopup = require('../tui/command.js');

        it("creates a command popup", function() {
            const cmd = new CommandPopup();
            assert.strictEqual(cmd.visible, false);
            assert.strictEqual(cmd.input, '');
        });

        it("shows and hides", function() {
            const cmd = new CommandPopup();
            cmd.show();
            assert.strictEqual(cmd.visible, true);
            cmd.hide();
            assert.strictEqual(cmd.visible, false);
        });

        it("inserts characters", function() {
            const cmd = new CommandPopup();
            cmd.show();
            cmd.insertChar('h');
            cmd.insertChar('e');
            cmd.insertChar('l');
            cmd.insertChar('p');
            assert.strictEqual(cmd.getCommand(), 'help');
        });

        it("deletes characters", function() {
            const cmd = new CommandPopup();
            cmd.show();
            cmd.insertChar('t');
            cmd.insertChar('e');
            cmd.insertChar('s');
            cmd.insertChar('t');
            cmd.deleteChar();
            assert.strictEqual(cmd.getCommand(), 'tes');
        });

        it("tracks history", function() {
            const cmd = new CommandPopup();
            cmd.addToHistory('first');
            cmd.addToHistory('second');
            cmd.show();
            cmd.historyPrev();
            assert.strictEqual(cmd.input, 'second');
            cmd.historyPrev();
            assert.strictEqual(cmd.input, 'first');
        });

        it("navigates history forward", function() {
            const cmd = new CommandPopup();
            cmd.addToHistory('first');
            cmd.addToHistory('second');
            cmd.show();
            cmd.historyPrev();
            cmd.historyPrev();
            cmd.historyNext();
            assert.strictEqual(cmd.input, 'second');
        });
    });

    describe("StatusLine", function() {
        const StatusLine = require('../tui/statusline.js');

        it("creates a status line", function() {
            const sl = new StatusLine();
            assert.ok(sl);
        });

        it("gets content", function() {
            const sl = new StatusLine();
            const content = sl.getContent();
            assert.ok(content.includes('NORMAL'));
        });

        it("changes mode", function() {
            const sl = new StatusLine();
            sl.setMode('command');
            const content = sl.getContent();
            assert.ok(content.includes('COMMAND'));
        });
    });

    describe("KeyBindings", function() {
        const KeyBindings = require('../tui/keybindings.js');

        it("creates key bindings", function() {
            const mockTui = {
                statusLine: { setMode: () => {} },
                screen: {},
                command: {},
                render: () => {}
            };
            const kb = new KeyBindings(mockTui);
            assert.strictEqual(kb.mode, 'normal');
        });

        it("changes mode", function() {
            const mockTui = {
                statusLine: { setMode: () => {} },
                screen: {},
                command: {},
                render: () => {}
            };
            const kb = new KeyBindings(mockTui);
            kb.setMode('command');
            assert.strictEqual(kb.mode, 'command');
        });
    });

    describe("ANSI", function() {
        const ansi = require('../tui/ansi.js');

        it("generates enter alt screen", function() {
            assert.strictEqual(ansi.enterAltScreen(), '\x1b[?1049h');
        });

        it("generates exit alt screen", function() {
            assert.strictEqual(ansi.exitAltScreen(), '\x1b[?1049l');
        });

        it("generates move cursor", function() {
            assert.strictEqual(ansi.moveCursor(5, 10), '\x1b[5;10H');
        });

        it("generates clear line", function() {
            assert.strictEqual(ansi.clearLine(), '\x1b[2K');
        });

        it("generates scroll region", function() {
            assert.strictEqual(ansi.setScrollRegion(1, 20), '\x1b[1;20r');
        });
    });

    describe("HelpOverlay", function() {
        const HelpOverlay = require('../tui/help.js');

        it("creates a help overlay", function() {
            const help = new HelpOverlay();
            assert.strictEqual(help.visible, false);
        });

        it("shows and hides", function() {
            const help = new HelpOverlay();
            help.show();
            assert.strictEqual(help.visible, true);
            help.hide();
            assert.strictEqual(help.visible, false);
        });

        it("toggles visibility", function() {
            const help = new HelpOverlay();
            help.toggle();
            assert.strictEqual(help.visible, true);
            help.toggle();
            assert.strictEqual(help.visible, false);
        });
    });

    describe("TUI main module", function() {
        const TUI = require('../tui.js');

        it("creates a TUI instance", function() {
            const tui = new TUI();
            assert.ok(tui);
            assert.ok(tui.screen);
            assert.ok(tui.statusLine);
            assert.ok(tui.command);
            assert.ok(tui.keys);
            assert.ok(tui.help);
        });

        it("accepts options", function() {
            const tui = new TUI({long: true, maxLines: 5000});
            assert.strictEqual(tui._long, true);
        });

        it("shows and hides help", function() {
            const tui = new TUI();
            assert.strictEqual(tui.isHelpVisible(), false);
            tui._showHelp();
            assert.strictEqual(tui.isHelpVisible(), true);
            tui._hideHelp();
            assert.strictEqual(tui.isHelpVisible(), false);
        });

        it("registers custom commands", function() {
            const tui = new TUI();
            let called = false;
            tui.registerCommand('test', (args) => { called = true; });
            assert.ok(tui.getCustomCommand('test'));
            tui.getCustomCommand('test')([]);
            assert.strictEqual(called, true);
        });

        it("registers custom keybindings", function() {
            const tui = new TUI();
            let called = false;
            tui.registerKey('x', () => { called = true; });
            assert.ok(tui.getCustomKey('x'));
            tui.getCustomKey('x')();
            assert.strictEqual(called, true);
        });
    });
});
