# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Malaya is a logic programming system with JSON pattern matching, based on Constraint Handling Rules (CHR). It provides prevalence-based persistent storage with hash-chained audit journals for building rule-based reactive systems.

## Build and Test Commands

```bash
# Run all tests
npm test

# Run JavaScript tests only
npm run test:js

# Run Malaya language tests only
npm run test:malaya

# Run specific test by name/pattern
mocha --grep "pattern" test/*.js

# Run single test file
mocha --exit -C test/node.js

# Lint
npm run eslint

# Benchmark
npm run benchmark

# Run a Malaya program
node malaya run -b examples/world.malaya
```

## Architecture

### Core Components

- **compiler.js** - Compiles `.malaya`/`.chrjs` files to JavaScript using Acorn parser with custom plugin (`acorn-plugin.js`) and Recast for AST manipulation
- **engine.js** - Prevalence-based runtime managing in-memory fact store, supports master/slave/idle modes with HTTP/WS replication
- **parser.js** - Extends Acorn with CHR-specific AST nodes: `StoreDeclaration`, `RuleStatement`, `QueryStatement`, `ItemExpression`
- **plugin.js** - Base `Plugin` class for extensible protocol/service handlers
- **cmdline.js** - CLI with subcommands: run, query, cat, ls, init, shell, debugger, etc.
- **middleware.js** - Integration layer for external web servers with WebSocket support

### Plugin System

Plugins in `plugins/` extend the `Plugin` class:
- `http.js`, `https.js` - HTTP server
- `ws.js` - WebSocket
- `tcp.js`, `udp.js` - Socket protocols
- `fifo.js` - Named pipes
- `fetch.js` - HTTP client
- `systemd.js` - systemd integration

### Malaya Language

Facts are arrays: `['factName', {fields}]` or with metadata: `['factName', {fields}, {src/dst}]`

Pattern operators:
- `-` Delete from store
- `+` Insert to store
- `M` Multiple/Match
- `=` Unify/Calculate
- `?` Query

```javascript
store {
    ['fact', {field: value}];  // Initial fact

    rule(
        -['input', {pattern}],    // Remove matching fact
        +['output', {result}]     // Insert new fact
    );
}
    .plugin('http', {port: 3000})
```

### Testing Infrastructure

- `testutil.js` - Engine setup helpers, I/O creation, assertions
- `test/bl/` - Business logic examples (count.malaya, timer.malaya, query.malaya, etc.)
- `plugins/test/` - Plugin-specific tests

### Global Variables

ESLint recognizes: `MalayaDate`, `MalayaMath`
