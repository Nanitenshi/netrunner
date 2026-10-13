# BatusMTG – optional Forge integration

This experimental two-human engine runs separately from the casual table.
The Java sources are GPL-3.0-or-later (see LICENSE) and link against the pinned
[Card-Forge 2.0.15 release](https://github.com/Card-Forge/forge/releases/tag/forge-2.0.15).
Forge and its card scripts are supplied separately.

## Own Commander decks

The host chooses **Eigene Commander-Decks**. Each player selects a saved local,
account, or prepared deck and marks themselves ready. Changing a deck or the
shared mode clears the relevant readiness. Both players must be ready to start.

The server validates catalog IDs, commander/partner eligibility, singleton,
color identity, and the existing house limit of 100–250 cards including commanders.
Only catalog-derived names/counts enter Java through stdin; there are no client
scripts or arbitrary deck paths. The opponent sees deck name, commanders and
count, never the private list or notes. If the installed Forge release lacks a
card script, the entire startup fails and the affected player receives their
missing names privately. No cards are substituted. Old compiled bridges are
rejected for Commander startup instead of silently loading a fixture.

Each player starts at 40 life with a shuffled actual library and seven cards.
The free mulligan back to seven is the project's house rule. Both players keep
before the host's first main phase. Native Forge commander permissions, partner
command zones, return decisions, accumulated casting tax and commander damage
are used. A concession ends the game while retaining stable client seat IDs.

The fixture spell-name whitelist does not apply to own decks. Native abilities
and alternative costs are offered when legal and supported; spells cast from
hand or the command zone, and abilities activate from battlefield, hand, or
command zone when permitted. Explicit ability selection displays its
costs before activation. Cycling discards its source; fetchlands pay life and
sacrifice before a human library search. Ordinary mana abilities resolve
immediately and retain priority. Graveyard/exile/command card targets are
included when Forge allows them, alongside battlefield, player and stack targets.

## Shared automation and human choices

Forge resolves effects, actual payments, triggers, state actions and combat.
HumanDecisions pauses synchronous callbacks for targets, modes, Scry/Surveil,
card/entity selections, library searches, orders, optional confirmations,
types, colors and bounded numeric input. Answers check choice ID, authenticated
seat, legal IDs, counts, partitions and numeric bounds. Private options, prompts
and source names are removed from the opponent's projection. Reload restores
the outstanding choice; leaving stops the process. These supported choices have
no timeout answer. The adapter still inherits unreviewed Forge AI callbacks:
arbitrary card combinations are not yet fully validated.

Supported costs currently include fixed mana, tap/untap, fixed life, and fixed
discard/sacrifice costs. Non-source card costs use human selections/cancellation
before payment. A spell cannot discard itself; source discard/sacrifice is
deterministic. Countering a spell never refunds costs. Other cost families and X
payments are rejected.

Normal mana payment uses Forge's solver. A bounded fallback plans ordinary
noncreature tap sources and fixed generic-cost filters such as Ferrous Lake or
signets, including their activation mana and full output. It accepts a sequence
only if the final cost is payable for every possible floating color spent on a
generic activation. Replay uses native mana abilities and native payment.
Restricted mana, output replacements/cost modifiers, complex mana abilities,
hybrid-cost filters and extra-cost spells are outside this fallback; manually
activate supported mana abilities when needed.

Turns advance through Forge's phase end/begin hooks, including cleanup with
human discards, untap/upkeep/draw and the next main phase. Empty steps advance;
stack objects stop advancement for responses. This single-phase adapter pins
private Forge 2.0.15 hook names. Do not upgrade Forge without regressions.
Human combat includes attacker/blocker selection, ordering and damage assignment.
Native first/double strike, flying, deathtouch, lifelink, trample, simultaneous
damage and deaths are tested. Damage assignments are limited to 128 points.

## Remaining scope

Experimental two-player matches are kept in memory and lost on server restart.
There are at most two rooms. A user cannot join Forge and casual simultaneously.
Hand/library privacy, queues, revisions and request IDs protect online actions.

Four-player Forge, persistence, advanced pre-opening actions such as Leylines,
dynamic extra-color commanders, modal back-face land play, graveyard/exile casting permissions, divided
spell targets, special reveal/controller callbacks and unusual combat rules
(planeswalkers/battles, banding or attack costs) remain unvalidated or unavailable.
Loading all five prepared decks proves script availability and physical deck
sizes, not that every card combination already works correctly.

The next automation increments should cover mechanics shared across decks:

1. Review remaining controller choices with representative real cards and
   private/reconnect checks, especially graveyard/exile and reveals.
2. Add X, counters, reveal/exile/tap-other costs and alternative payments with
   cancellation tests before enabling those abilities.
3. Extend casting zones, special mana and trigger/replacement families.
4. Add complete multi-turn scenarios for each prepared deck's main mechanics.
5. Validate multiplayer and persistence before broad release.

## Setup and verification

Requires Java 17, the unpacked official Forge desktop release including `res`,
and all **six** bridge files compiled with UTF-8:

```sh
javac -encoding UTF-8 -cp /path/to/forge-gui-desktop-2.0.15-jar-with-dependencies.jar -d /path/to/classes forge-bridge/BatusForge.java forge-bridge/HumanDecisions.java forge-bridge/HumanCombat.java forge-bridge/HumanCosts.java forge-bridge/CommanderDecks.java forge-bridge/FilterMana.java
```

Set absolute `FORGE_JAVA`, `FORGE_RUNTIME` and `FORGE_CLASSES` paths on the server.
The lobby exposes **Automatik-Testtisch · Forge** when configured. The production
Docker image does not bundle Java, Forge assets or compiled classes.

Application checks: `pnpm test` and `pnpm build`. With Forge configured:

```sh
node scripts/test-forge.mjs
node scripts/test-forge-decisions.mjs
node scripts/test-forge-combat.mjs
node scripts/test-forge-costs.mjs
node scripts/test-forge-commander.mjs
node scripts/test-forge-deck-mechanics.mjs
```

After building, `node scripts/test-forge-commander-browser.mjs` tests two
authenticated browsers, local/account decks, privacy, readiness, mulligan,
reload, cast/resolve and concession. `test-forge-costs-browser.mjs` covers the
previous payment fixture. They require Playwright (or `PLAYWRIGHT_MODULE`) and
Chromium (`CHROME_PATH` can select an installed executable). Screenshots go to
ignored `.local/browser`. See the [Commander verification report](../deploy/FORGE-COMMANDER-2026-10-13.md).

Keep Forge's GPL license and provide corresponding source when distributing the
linked bridge. MTG card images and scripts have separate third-party rights.
