# Malaya — language design review

*A review of the Malaya language design (the DSL, its model, semantics, and
trade-offs), as distinct from implementation quality. 2026-07-13.*

**Bottom line.** Malaya is a small, sharply-focused, and in one respect
genuinely original language: it treats determinism as a single load-bearing
invariant and spends it four times over. But it markets itself as "logic
programming" while dropping the two things that define that tradition, and it
exhibits one deep, recurring asymmetry — it enforces the invariants *it*
depends on loudly, while leaving the invariants the *programmer* depends on
silent and unenforced. It is delightful in the small and for its niche; it
strains as programs grow.

## The central idea, and why it's good

The whole design hangs off one bet: **the rule engine is a pure function of
(frozen store state, input fact), with all nondeterminism quarantined into
journalled inputs.** From that single property fall four features that normally
cost four separate mechanisms: crash recovery (replay the journal), hot-standby
replication (stream the same inputs to a slave), tamper-evident audit
(hash-chain the journal), and aspirational model-checking. That spine is real
and visible in the code, not marketing — `Date.now()`/`Math.random()` *throw*
at runtime ("malaya is timeless", "malaya does not play dice"), and
time/entropy must be injected as data. Enforcing purity by making the impure
primitives fail loudly is the correct enforcement level, and the austere
language restrictions (frozen facts, no `var`, no global mutation, no `async`)
are disciplined engineering downstream of that invariant rather than dogma.

The second good idea is **one uniform mechanism for everything.** A fact is JSON
(`['name',{fields}]`, with a third `{src|dst}` metadata slot for I/O), and one
pattern grammar drives rule heads, rule bodies, *and* the read side — where a
single comprehension `[element where …pattern]` collapses queries, aggregation,
ranking, and invariants into one fold. Input, output, timers, config, and
working state are all just facts; outbound facts (those with a live `{dst}`)
are auto-routed and immediately deleted, so emitting is transient and needs no
separate effect system. You learn matching once and reuse it everywhere. For
its sweet spot — JSON in, react, JSON out, persist — a program reads as almost
nothing but its business logic. The CHR foundation is faithful and legible:
simplification/propagation/simpagation fall straight out of "does this head
carry a leading `-`", and deterministic textual-order firing keeps the system
reasoned-about rather than an opaque search.

## The recurring weaknesses

**1. Meaning is inferred from JavaScript's AST shape and enclosing context
rather than spelled in the notation.** The item operators (`+ - M = ?`) aren't
tokens; the compiler assigns them by inspecting expression shape. So `x = f()`
*binds* while `x == f()` *guards* — a one-character slip silently converts a
test into a mutation. A bare `['x']` is a match head only *inside* a rule;
`out` is a keyword smuggled through a function-call name-check; `^` and `%` are
JS xor/mod re-purposed as rank/group, but only in query position. The
vocabulary is minimal and coherent once internalized, but not self-evident, and
the disambiguation lives in the parser instead of the surface. Surface honesty
is traded for parser cleverness.

**2. The deep asymmetry: Malaya enforces its own invariants but not the
programmer's.** Determinism and frozen facts are enforced loudly. Yet the
invariants a programmer actually relies on are pure convention with
silent-failure modes: "there is exactly one `stats` fact" is maintained only by
discipline (delete-old-then-insert-new); uniqueness is a hand-written rule you
must get right; a timer program must remember a boilerplate `rule(-['tick'])`
to consume its trigger or it leaks memory; forget a `...rest` spread and you
silently drop every unmentioned field. Meanwhile the fact model is schema-free
(the `TypeSpecifier` `id::specs` exists in the AST but is unimplemented), so a
typo in a fact-name or field degrades to a non-matching fact rather than an
error. Compounding this, the language guarantees neither **termination** nor
**confluence** — a propagation rule that re-adds what it matched loops
silently, and when two rules match the same fact (as in dns.malaya's
local-answer vs. forward-upstream), which fires isn't something you can point to
in the source. Post-hoc debuggability is excellent (journal replay,
`add`/`del`/`fire` events); *a-priori* reasoning is the weak spot, and the
failure mode is a quietly-wrong store, not a crash.

**3. No in-language modularity, and it falls out of itself exactly where it
matters.** There is one flat, global fact store per engine — no namespacing, no
importable rule modules, no cooperating sub-stores. You modularize by deploying
more processes, not by structuring one program, so at scale every fact-name and
rule interaction shares one global scope. And the moment a program needs binary
I/O, stateful request/response correlation, or structured config edits, it
drops out of the declarative core into hand-written JS: dns.malaya is ~80% JS
bit-twiddling wrapped around seven rules; HTTP correlation lives in a mutable
`reqs[id]` map inside the plugin, invisible to the store. That imperative shell
is precisely the un-audited, un-replayable half — where the latent bugs sit
(there's a dead `qr===null` check in dns.malaya that the language does nothing
to surface). The same escape hatch undermines the value proposition: `require`
is unrestricted, so any imported module can silently reintroduce the
nondeterminism the whole design depends on excluding — a known, un-plugged
hole.

## Where it actually sits

Despite the "logic programming" framing, Malaya **forgoes the two things that
define that lineage**: unification-with-backtracking (its patterns are one-way
destructuring matches, not two-way search) and CHR's confluence/termination
*theory* (it takes CHR's operational rewriting and drops its analytical
apparatus). What it actually is: a **deterministic forward-chaining
production-rule engine over an event-sourced, hash-chained store** — closer to
Drools-meets-Datomic than to Prolog. Its ingredients are all borrowed and
sensible (prevalence from Prevayler, JSON matching, plugin-per-protocol), but
the *synthesis* — CHR as the command model of a prevalent store, with
tamper-evident deterministic replay as the unifying invariant — is one with no
clear prior art. That combination is the real contribution.

## Vision versus delivery

The conceptual model is complete and self-consistent; productionization is not.
Version `0.8.997` is parked three patches shy of 0.9; the README still says
"wait before downloading"; a 1.0 promised for 2020 remains unshipped six years
on; the reference manual in book.org is a skeleton of empty headings;
replication is a feature that *worked and was lost*. Most tellingly, the FAQ
leaves its hardest questions as bare headings — including the genuine
contradiction at the heart of the pitch: **an immutable, tamper-evident audit
journal versus GDPR's right-to-erasure and secret-hygiene.** The author knows
it's unresolved and has not answered it. Add the in-memory-only ceiling ("10s of
gigabytes"), no schema-evolution story, and no distribution/consensus, and the
picture is an under-resourced single-author research system whose vision outran
its delivery.

## What I'd change (in priority order)

1. **Plug the determinism hole** (`require` whitelist) — it's load-bearing for
   recovery, replication, and audit, and it's currently open.
2. **Spell the operators.** Make bind-vs-guard, `out`, and rank/group lexically
   distinct so meaning stops depending on AST shape and a one-character slip
   stops changing semantics.
3. **Turn the programmer's conventions into language features.** A declarable
   singleton/unique-key modifier per fact-name would replace the
   delete-old-insert-new dance and the hand-written uniqueness rules, and turn
   silent duplicates into errors. Ship the aspirational schema/arity declaration
   so field typos fail loudly.
4. **Give confluence/termination a lint pass** — even a warning when a
   propagation rule re-adds a matched head, or when two rules non-confluently
   match the same fact.
5. **Add some modularity** — namespaced fact-names or composable stores —
   before the flat global store becomes the scaling wall.
6. **Answer the GDPR/erasure tension** (crypto-shredding, tombstones, or an
   explicit "audit and erasure are mutually exclusive, pick per-store" stance).
   It's core to the value proposition, not a footnote.

Net: a coherent and elegant core — CHR + JSON + comprehensions + enforced
determinism — worth pursuing for auditable, forever-running JSON daemons, whose
principal design debt is that its notation leans on JavaScript's grammar to
disambiguate meaning by context, and whose safety model protects the system's
invariants while leaving the programmer's unguarded.

---

## Appendix: grounding references

Semantics and grammar: `acorn-plugin.js` (grammar and operator inference in
`importItemExpression`), `parser.js` (AST, `BindRest`/regex/template
desugarings), `test/language.malaya` (the canonical simpagation trade-matcher),
`test/simple.malaya` (ground-truth semantics for matching, `...`, firing order,
determinism, query/where/invariant), `compiler.js:538-595` (where
`where`/`query`/`invariant` all lower onto `SnapExpression`).

Programming model: `examples/world.malaya`, `examples/dns.malaya`,
`test/bl/count.malaya`, `test/bl/match.malaya`, `test/bl/middleware.malaya`,
`plugin.js` (`src` tagging), `compiler.js:61-67` (`dst` auto-routing / transient
outbound facts), `plugins/http.js` (the `reqs[id]` correlation side-channel).

Design intent and determinism spine: `README.org`, `book.org`, `FAQ.org`,
`doc/ops.txt`, `compiler.js:384-406` ("malaya is timeless" / "does not play
dice"), `engine.js:230-263` (hash-chained saves), `engine.js:1397-1398`
(timestamp/RNG replay).
