"use strict";

const plugin = require('../plugin.js');

plugin.add('tui', class extends plugin.Plugin {
    constructor(opts = {}) {
        super(opts);
        const pl = this;
        pl.commands = opts.commands || {};
        pl.keys = opts.keys || {};
    }

    ready() {
        const pl = this;
        const cmdline = require('../cmdline.js');
        const tui = cmdline.tui;

        if (!tui) {
            // TUI not active, nothing to do
            return;
        }

        // Register custom commands
        Object.keys(pl.commands).forEach(name => {
            tui.registerCommand(name, (args) => {
                return pl.commands[name](tui, pl.chrjs, args);
            });
        });

        // Register custom keybindings
        Object.keys(pl.keys).forEach(key => {
            tui.registerKey(key, () => {
                return pl.keys[key](tui, pl.chrjs);
            });
        });
    }
});
