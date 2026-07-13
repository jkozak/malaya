# Malaya — code review

*A code-quality and security review of the implementation (as opposed to the
[language design review](language-design-review.md)). 2026-07-13. Conducted as
a multi-perspective read across four areas: the language core (compiler,
parser, acorn plugin), the runtime and persistence layer (engine, hash store,
journal, replication), the CLI and plugin system, and tests/tooling/deps.*

Findings marked **[Fixed in PR #1]** were addressed in the
`fix/review-batch` branch; everything else is outstanding.

## Verdict

A genuinely interesting and unusually well-tested system whose core mechanics —
prevalence, content-addressed hash store, verified journal chains, deterministic
replay — are sound in design. It is not currently safe to expose to a network,
its durability guarantees are weaker than the "hash-chained audit journal"
framing implies, and the compiler carries a few silent-wrong-behaviour bugs plus
one large strategic liability (recast pinned at 0.9.5 from 2015). The test suite
is the healthiest part: 610 JS + 112 Malaya tests passing, lint clean (624 + 113
after PR #1).

## What's good

- **Test culture.** Every major module has a dedicated test file; `.malaya`
  tests run as executable language specs via the compiler require-hook,
  including determinism enforcement. `testutil.js` is serious infrastructure.
- **Persistence mechanics.** The hash store publishes atomically
  (write-tmp-then-rename, `hash.js:56-65`); slave sync re-hashes every fetched
  object and verifies chain linkage before trusting it (`engine.js:1144-1204`);
  journal replay cross-checks syshash continuity and truncates torn tail writes;
  RNG seed / use-count persist for deterministic replay.
- **Design taste.** The plugin lifecycle with `-O` overrides substituting
  `dummy` plugins for deterministic re-runs, the `cat` map/filter/reduce journal
  pipeline, and the single-step `replay` debugger are all well-conceived.

## Critical — security (the network surface is open)

These compose into a practical remote-code-execution chain:

1. **Admin channel gated only by `ip.isPrivate` on the immediate peer**
   (`engine.js:703-708`) — behind any reverse proxy, everyone looks private.
   The admin `facts` command compiles attacker strings through `util.eval`
   (`engine.js:1331-1356`)…
2. **…which runs in vm2 3.9.9** (`util.js:8,230-236`) — abandoned since 2023
   with unfixable published sandbox escapes. The 100 ms timeout is irrelevant to
   an escape.
3. **The `ip` package is 1.1.8** (`engine.js:40`) — predates CVE-2023-42282, so
   the security boundary itself misclassifies certain encoded IPs as private.
4. **Replication endpoints (`/replication/{hashes,hash,state,journal}`) require
   no auth at all** (`www.js:108-120`) — anyone reachable can download the entire
   fact history and audit chain, or serve a rogue but self-consistent journal to
   a slave (master authenticity is never verified; the git-signing hooks are
   stubbed comments at `engine.js:254,501-503`).
5. **Any socket plugin crashed the whole engine on one malformed packet.**
   `ws.js`, `udp.js`, `tcp.js` all let a bare `JSON.parse` / stream `error` reach
   the `uncaughtException` → `process.exit(101)` handler. **[Fixed in PR #1]** —
   all three now log and drop/close on malformed input, via a shared
   `plugin.isWellFormedFact`.
6. **The one global fact-shape guard was a no-op** (`plugin.js:154`): mixed `&`
   with `&&`. Arbitrary junk from a WS client was journaled permanently.
   **[Fixed in PR #1].**

None of the network-facing plugins have authentication, and updates are
journaled *before* rules run, so even ignored payloads are recorded forever.

## High — durability doesn't match the pitch

- **No per-commit fsync.** `eng.journalFlush` is initialized to a no-op
  (`engine.js:145`) and never reassigned — commits are acknowledged when data
  hits the OS page cache, not disk. `fdatasync` happens only on clean shutdown.
  `kill -9` or power loss can lose acknowledged, already-applied transactions.
- **Apply-and-emit races the journal write** (`engine.js:1045-1061`):
  `chrjs.update` fires rules and broadcasts to clients before the async journal
  callback completes, so clients can observe state the server has no durable
  record of.
- **World-save only at shutdown** — the journal grows unbounded during normal
  operation, so replay time grows without bound; and `_saveWorld` doesn't fsync
  new snapshot files before the directory-swap renames.

## High — the stash WIP was not shippable

Two reviewers independently flagged `compiler.js:169`:
`index[STASH].filter(t=>!dels.includes[t])` used property access `includes[t]`
instead of the call `includes(t)`, so it pruned nothing; the dangling entry then
made the next `unstash` dereference a deleted fact. The become-master/idle
lifecycle (`engine.js:844,881`) hits this on the second stop/start cycle.
**[Fixed in PR #1].** Still open: stash bypasses the journal entirely
(`compiler.js:153-171`), so a world snapshot can contain facts that replaying
the chain never reproduces — undermining the audit story; and `Plugin.wantStash`
is dead code.

## Medium — compiler correctness (silent wrong behaviour)

- **Non-indexed fact scan is broken** (`compiler.js:1203-1219`): the generated
  fallback loop iterates ids `0…count-1`, but fact ids start at 1 and go sparse
  after deletions — so a variable-tag head silently misses matches (and it's
  O(n²)). Either fix to `for (var T in facts)` like the ranked path does, or
  hard-error on non-literal heads. **Outstanding.**
- **Template literals were expanded with `.raw` instead of `.cooked`**
  (`parser.js:170-180`) — every `\n`/`\t` compiled to a literal backslash-n.
  **[Fixed in PR #1].**
- **Two "must not modify store" guards can never fire**
  (`compiler.js:1436,1472`): `for…in` over an array yields index strings, so
  `item.op` is always undefined. **Outstanding.**
- **Guards can steal bindings** (`compiler.js:711-714`): an identifier first seen
  inside a guard call is marked `boundHere`, so the real pattern occurrence
  compiles to an equality test against `undefined` and the rule silently never
  fires. **Outstanding.**
- **Compile-cache collisions** (`compiler.js:2099-2121`): the cache key excludes
  filename and `util.env`, so two same-content files at different paths share
  `__file__`; and a runtime error from the cached module is swallowed and the
  body re-executed (doubling side effects like plugin registration).
  **Outstanding.**
- **Dead debug/dump chain**: `parser.parse` drops the `loc` option
  (`parser.js:88`), so `buildStanzas`/`getStanzas` and `dump.js` are broken.
  **Outstanding.**

## Medium — plugin / CLI bugs

- `tcp.js:22` listened on `pl.portReq` (undefined; field is `port0`) → configured
  port silently ignored. **[Fixed in PR #1].** (Still open: it inserts every
  `connect` fact twice, `tcp.js:46+53`.)
- `ws.js:35` read `pl.wss.address.port` (missing call, before listening) → port
  always undefined, never emits `listen`, invisible to `malaya status`.
  **[Fixed in PR #1].**
- `https.js` can't load (`plugin.classes` isn't exported) and `plugin.require`
  masks the real error as "missing third-party module". **Outstanding.**
- **Ctrl-C is dead** in slave/idle modes and in `malaya lock`
  (`cmdline.js:883-891,1499-1506`) — the process hangs, killable only by SIGTERM.
  **Outstanding.**
- `util.nCalls` (`util.js:187-193`) drops all callback args, so every
  plugin-lifecycle error path silently discards failures — the engine reports
  success even when a plugin's `stop()`/`stash()` failed. **Outstanding.**
- `http.js:83` crashes on an unknown response id; request bodies buffer with no
  size cap (DoS); `pl.reqs` entries leak. **Outstanding.**
- `browse` subcommand is in `--help` but throws "NYI"; `repl.js` is a
  non-functional stub. **Outstanding.**

## Medium — dependencies, tooling, docs

- **No CI at all** — a 20 s green suite with a lint gate is the ideal case for it.
- **`vm2`** (drop/replace with `isolated-vm` or `node:vm` + a threat model),
  **deprecated `request`** powering `plugins/fetch.js` (and listed twice in
  package.json), **`node-fetch` and `systemd` are unused deps**, and
  `ws@7.5.8` / `express@4.18.1` / `moment@2.29.3` all have lockfile-level CVEs
  cleared by a plain `npm update` within existing ranges.
- **License is wrong twice**: `package.json` says `AGPL-1.0` (a deprecated,
  non-existent SPDX id); `COPYING` is AGPL v3. Should be `AGPL-3.0-or-later`.
- **Dockerfile is dead** (2015 alpine base, runs a nonexistent Makefile, builds a
  nonexistent example). **README actively tells people not to download** and
  promises a 1.0 "by the beginning of 2020" (version is 0.8.997).
- **`recast` pinned `=0.9.5`** (2015, bundled esprima-fb) while parsing with
  `acorn ^8`. The `{acorn:...}` option passed to recast is silently ignored, and
  the whole `parser.js` LEGACY pass exists to fold acorn-8 output back into the
  2015 ESTree dialect. Every new JS syntax feature becomes a hand-written
  workaround. This is the single biggest long-term liability in the core.

## Suggested priority order

1. **Lock down the network surface** before any deployment: the `plugin.js:154`
   validation and socket decode paths are done; still need pre-upgrade auth on
   ws/middleware, and either auth or bind-to-loopback for the admin + replication
   endpoints.
2. **Replace vm2** on the eval path.
3. **Finish or fence the stash WIP** — the crash is fixed, but the journal-bypass
   remains.
4. **Durability**: add an opt-in per-commit `fdatasync` in `journalFlush`, and
   resolve the apply-before-durable ordering.
5. **Compiler bugs**: the non-indexed scan (`compiler.js:1203`) and the
   cache-key gaps.
6. **Hygiene**: add CI, `npm update`, drop unused deps, fix the license id,
   delete the Dockerfile, and refresh the README.

## Status of fixes (PR #1)

Addressed on `fix/review-batch`, each with a red/green-verified test:
the `plugin.js:154` fact-shape guard, the `tcp.js`/`ws.js` port bugs, the stash
`includes(t)` typo, the `parser.js` template `cooked` fix, and socket input
hardening for ws/udp/tcp (shared `plugin.isWellFormedFact`, `WS_CLOSE` moved to
`plugin.js`). Full suite: 624 JS + 113 Malaya tests passing, eslint clean.
