"use strict";

// Main TUI module for Malaya

const          ansi = require('./tui/ansi.js');
const        Screen = require('./tui/screen.js');
const    StatusLine = require('./tui/statusline.js');
const  CommandPopup = require('./tui/command.js');
const   KeyBindings = require('./tui/keybindings.js');
const   HelpOverlay = require('./tui/help.js');
const         chalk = require('chalk');
const       tracing = require('./tracing.js');

class TUI {
    constructor(options = {}) {
        this.options = options;
        this.screen = new Screen({maxLines: options.maxLines || 10000});
        this.statusLine = new StatusLine();
        this.command = new CommandPopup();
        this.search = new CommandPopup({promptChar: '/'});  // Reuse CommandPopup for search
        this.keys = new KeyBindings(this);
        this.help = new HelpOverlay();

        this._engine = null;
        this._running = false;
        this._origConsole = {};
        this._exitCallback = null;
        this._resizeHandler = null;
        this._searchVisible = false;
        this._searchForward = true;  // Direction of search

        // Formatting options
        this._long = options.long || false;

        // Custom commands and keybindings from plugins
        this._customCommands = {};
        this._customKeys = {};
    }

    registerCommand(name, handler) {
        this._customCommands[name] = handler;
    }

    registerKey(key, handler) {
        this._customKeys[key] = handler;
    }

    getCustomCommand(name) {
        return this._customCommands[name];
    }

    getCustomKey(key) {
        return this._customKeys[key];
    }

    setEngine(engine) {
        this._engine = engine;
        this.statusLine.setEngine(engine);
    }

    start() {
        if (this._running)
            return;
        this._running = true;

        // Save original console methods
        this._interceptConsole();

        // Enter alternate screen
        process.stdout.write(
            ansi.enterAltScreen() +
            ansi.clearScreen() +
            ansi.hideCursor()
        );

        // Initialize components
        this.screen.init();
        this._updateLayout();

        // Set up resize handler
        this._resizeHandler = () => this._handleResize();
        process.stdout.on('resize', this._resizeHandler);

        // Start keyboard handling
        this.keys.start();

        // Initial render
        this.fullRender();
    }

    stop() {
        if (!this._running)
            return;
        this._running = false;

        // Stop keyboard handling
        this.keys.stop();

        // Remove resize handler
        if (this._resizeHandler) {
            process.stdout.removeListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }

        // Destroy screen
        this.screen.destroy();

        // Restore console
        this._restoreConsole();

        // Exit alternate screen
        process.stdout.write(
            ansi.resetScrollRegion() +
            ansi.showCursor() +
            ansi.exitAltScreen()
        );

        if (this._exitCallback)
            this._exitCallback();
    }

    quit() {
        this.stop();
        /* eslint no-process-exit:0 */
        process.exit(0);
    }

    onExit(callback) {
        this._exitCallback = callback;
    }

    _handleResize() {
        this._updateLayout();
        this.fullRender();
    }

    _updateLayout() {
        const height = process.stdout.rows || 24;
        this.screen.scrollRegionTop = 1;
        this.screen.scrollRegionBottom = height - 2;
        this.command.updatePosition(height - 1);
        this.search.updatePosition(height - 1);
        this.statusLine.updatePosition(height);
    }

    _interceptConsole() {
        const self = this;
        const util = require('util');

        this._origConsole.log = console.log;
        this._origConsole.warn = console.warn;
        this._origConsole.error = console.error;

        console.log = function(...args) {
            const text = util.format(...args);
            self.appendOutput(text);
        };

        console.warn = function(...args) {
            const text = chalk.yellow(util.format(...args));
            self.appendOutput(text);
        };

        console.error = function(...args) {
            const text = chalk.red(util.format(...args));
            self.appendOutput(text);
        };
    }

    _restoreConsole() {
        if (this._origConsole.log)
            console.log = this._origConsole.log;
        if (this._origConsole.warn)
            console.warn = this._origConsole.warn;
        if (this._origConsole.error)
            console.error = this._origConsole.error;
    }

    createPrintFunction() {
        const self = this;
        return function(line) {
            self.appendOutput(line);
        };
    }

    appendOutput(text) {
        if (!this._running)
            return;

        // Split on newlines and append each line
        const lines = text.split('\n');
        for (const line of lines) {
            this.screen.appendLine(line);
        }
        this.render();
    }

    fullRender() {
        if (!this._running)
            return;

        process.stdout.write(ansi.clearScreen());
        this.screen.render(process.stdout);
        this._renderPrompt(process.stdout);
        this.statusLine.render(process.stdout);
        this.help.render(process.stdout);

        if (this.keys.mode !== 'command' && this.keys.mode !== 'search')
            process.stdout.write(ansi.hideCursor());
    }

    render() {
        if (!this._running)
            return;

        // Update status line with search and block info
        this.statusLine.setSearchInfo(this.screen.getMatchInfo());
        this.statusLine.setBlockInfo(this.screen.getBlockInfo());

        this.screen.render(process.stdout);
        this._renderPrompt(process.stdout);
        this.statusLine.render(process.stdout);
        this.help.render(process.stdout);

        if (this.keys.mode !== 'command' && this.keys.mode !== 'search')
            process.stdout.write(ansi.hideCursor());
    }

    _renderPrompt(stream) {
        // Only render one prompt at a time
        if (this._searchVisible) {
            this.search.render(stream);
        } else {
            this.command.render(stream);
        }
    }

    beep() {
        process.stdout.write('\x07');
    }

    executeCommand(cmd) {
        const parts = cmd.split(/\s+/);
        const name = parts[0];
        const args = parts.slice(1);

        // Check for custom command first
        const customCmd = this.getCustomCommand(name);
        if (customCmd) {
            try {
                customCmd(args);
            } catch (e) {
                this.appendOutput(chalk.red(`Command error: ${e.message}`));
            }
            return;
        }

        switch (name) {
        case 'q':
        case 'quit':
            this.quit();
            break;

        case 'clear':
            this.screen.clear();
            this.appendOutput(chalk.dim('--- output cleared ---'));
            break;

        case 'scroll':
            if (args[0]) {
                const line = parseInt(args[0], 10);
                if (!isNaN(line))
                    this.screen.scrollToLine(line - 1);
            }
            break;

        case 'help':
            this._showHelp();
            break;

        case 'query':
            if (this._engine && args.length > 0) {
                this._executeQuery(args.join(' '));
            } else {
                this.appendOutput(chalk.red('Usage: :query <expression>'));
            }
            break;

        case 'facts':
            this._showFacts(args[0]);
            break;

        case 'mode':
            if (this._engine && args[0]) {
                this._changeMode(args[0]);
            } else {
                this.appendOutput(chalk.red('Usage: :mode <master|slave|idle>'));
            }
            break;

        case 'save':
            this._triggerSave();
            break;

        case 'debug':
            this._toggleDebug();
            break;

        default:
            this.appendOutput(chalk.red(`Unknown command: ${name}`));
            this.appendOutput(chalk.dim('Type :help for available commands'));
        }
    }

    _showHelp() {
        this.help.show();
    }

    _hideHelp() {
        this.help.hide();
    }

    isHelpVisible() {
        return this.help.visible;
    }

    // Search functionality
    showSearch(forward = true) {
        this._searchVisible = true;
        this._searchForward = forward;
        this.search.setPromptChar(forward ? '/' : '?');
        this.search.show();
    }

    hideSearch(clearHighlight = true) {
        this._searchVisible = false;
        this.search.hide();
        if (clearHighlight) {
            this.screen.clearSearch();
        }
    }

    incrementalSearch() {
        const term = this.search.getCommand();
        if (term.length > 0) {
            this.screen.search(term);
            // Jump to first match while typing
            if (this.screen.searchMatches.length > 0) {
                this.screen.nextMatch();
            }
        } else {
            this.screen.clearSearch();
        }
    }

    confirmSearch(term) {
        this.screen.search(term);
        if (this.screen.searchMatches.length > 0) {
            this.screen.nextMatch();
        } else {
            this.appendOutput(chalk.yellow(`Pattern not found: ${term}`));
        }
    }

    searchNext() {
        if (!this.screen.searchTerm) {
            this.appendOutput(chalk.yellow('No search pattern'));
            return;
        }
        // n goes in the same direction as the original search
        const result = this._searchForward ? this.screen.nextMatch() : this.screen.prevMatch();
        if (result === 'empty') {
            this.appendOutput(chalk.yellow('Pattern not found: ' + this.screen.searchTerm));
        } else if (result !== 'ok') {
            this.beep();
        }
    }

    searchPrev() {
        if (!this.screen.searchTerm) {
            this.appendOutput(chalk.yellow('No search pattern'));
            return;
        }
        // N goes in the opposite direction
        const result = this._searchForward ? this.screen.prevMatch() : this.screen.nextMatch();
        if (result === 'empty') {
            this.appendOutput(chalk.yellow('Pattern not found: ' + this.screen.searchTerm));
        } else if (result !== 'ok') {
            this.beep();
        }
    }

    _executeQuery(expr) {
        if (!this._engine || !this._engine.chrjs) {
            this.appendOutput(chalk.red('No engine available'));
            return;
        }

        try {
            // Try to execute as a named query
            const result = this._engine.chrjs.query(expr);
            if (result !== undefined) {
                this.appendOutput(chalk.green(`Query: ${expr}`));
                if (Array.isArray(result)) {
                    for (const item of result) {
                        this.appendOutput('  ' + tracing.fmtFact(item, {long: this._long}));
                    }
                } else {
                    this.appendOutput('  ' + JSON.stringify(result));
                }
            }
        } catch (e) {
            this.appendOutput(chalk.red(`Query error: ${e.message}`));
        }
    }

    _showFacts(pattern) {
        if (!this._engine || !this._engine.chrjs) {
            this.appendOutput(chalk.red('No engine available'));
            return;
        }

        try {
            const facts = this._engine.chrjs.orderedFacts;
            this.appendOutput(chalk.green(`Facts${pattern ? ` matching "${pattern}"` : ''}:`));

            let count = 0;
            for (const fact of facts) {
                if (pattern && !fact[0].includes(pattern))
                    continue;
                this.appendOutput('  ' + tracing.fmtFact(fact, {long: this._long}));
                count++;
            }
            this.appendOutput(chalk.dim(`(${count} facts)`));
        } catch (e) {
            this.appendOutput(chalk.red(`Error: ${e.message}`));
        }
    }

    _changeMode(mode) {
        if (!['master', 'slave', 'idle'].includes(mode)) {
            this.appendOutput(chalk.red(`Invalid mode: ${mode}`));
            return;
        }

        if (!this._engine) {
            this.appendOutput(chalk.red('No engine available'));
            return;
        }

        try {
            this._engine.become(mode);
            this.appendOutput(chalk.green(`Mode changing to: ${mode}`));
        } catch (e) {
            this.appendOutput(chalk.red(`Error: ${e.message}`));
        }
    }

    _triggerSave() {
        if (!this._engine) {
            this.appendOutput(chalk.red('No engine available'));
            return;
        }

        try {
            this._engine.stopPrevalence(false, (err) => {
                if (err) {
                    this.appendOutput(chalk.red(`Save error: ${err.message}`));
                } else {
                    this.appendOutput(chalk.green('World saved'));
                    this._engine.startPrevalence();
                }
            });
        } catch (e) {
            this.appendOutput(chalk.red(`Error: ${e.message}`));
        }
    }

    _toggleDebug() {
        // This would toggle tracing - for now just show status
        this.appendOutput(chalk.yellow('Debug toggle not yet implemented'));
        this.appendOutput(chalk.dim('Use SIGUSR1 to toggle tracing'));
    }
}

module.exports = TUI;
