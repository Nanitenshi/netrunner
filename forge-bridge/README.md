# BatusMTG – optional Forge integration

This experimental two-seat engine supports two humans or one human and a Forge AI, separately from the casual table.
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

Fixed hand-card reveals offered during an effect now use human selection and
an explicit decline button. In particular Port Town, Choked Estuary, Foreboding
Ruins, Game Trail and Fortified Village enter untapped only after a legal card
is revealed. This choice is manual by default; the narrowly scoped opt-in
automation described below can answer reviewed unambiguous choices. Without a matching card or after declining,
Forge applies the tapped-entry replacement. This does not enable reveal costs
for ordinary spell casting or complex combined/variable reveal payments.

Native reveal callbacks are delivered to their specific permitted viewer.
The bridge retains the latest eight reveal records per viewer; server projection
removes every other viewer's records. Revealed cards do not become public
playable hand/library cards. Delayed look/search callbacks show all entitled
cards before selection, while the remaining library and hand stay private.
The read-only **Aufgedeckte Karten** dialog can be opened from the action bar
or a pending effect decision, without answering that decision. Reload restores
the same pending decision and in-memory reveal records. Commander startup now
requires `human-reveals`, `optional-reveal-automation` and `payment-review`; recompile all eight files together.

`node scripts/test-forge-reveals.mjs` covers all five reveal lands, decline,
missing eligible cards, privacy, illegal answers, Cultivate assignment/reveal
and private Impulse looks. After building,
`node scripts/test-forge-reveals-browser.mjs` checks two clients, reload,
authorized/public reveals and touch landscape selection.

Commander mana payment is automatic by default: a legal cast activates its native
mana abilities and pays in Forge without a routine confirmation dialog. The
bounded planner uses floating mana first, minimizes tap activations, then surplus,
then preserves flexible colors and sources with other abilities. It never derives
mana from card color identity. Ordinary noncreature tap sources, simple mana rocks
and fixed generic-cost filters such as Ferrous Lake/signets are supported, including
activation order and full output. It accepts a filter sequence only if every
possible floating color spent on its generic activation still pays the spell.

The **Mana: Automatisch / Selbst wählen** button is an optional per-browser
preference. Manual selection opens a native, private payment preview before any
card moves, mana is spent or commander tax changes. Changed sources produce a
new preview; a further confirmation commits that exact plan. Invalid/insufficient
selections remain unpaid. Cancellation and reload preserve the pending decision.
Other players see neither the private preview nor the selected preferences.

Native costs are revalidated during payment and only the planned abilities are
activated; final mana consumption is through Forge's ManaPool. Mana pools and the
last successful automatic payment are visible. Restricted/conditional mana,
replacement/cost-modifier effects and complex mana abilities retain Forge's native
solver. Manual source override is explicitly unavailable for those cases. Extra
costs keep their existing human cost selections. These are deterministic payment
heuristics, not a claim of globally optimal Commander play.

Turns advance through Forge's phase end/begin hooks, including cleanup with
human discards, untap/upkeep/draw and the next main phase. Empty steps advance;
stack objects stop advancement for responses. This single-phase adapter pins
private Forge 2.0.15 hook names. Do not upgrade Forge without regressions.
Human combat includes attacker/blocker selection, ordering and damage assignment.
Native first/double strike, flying, deathtouch, lifelink, trample, simultaneous
damage and deaths are tested. Damage assignments are limited to 128 points.

## AI opponents and difficulty

In Commander mode the host can fill the second seat with a Forge AI, choosing
any of the five prepared decks or one of their own saved decks. The host can
change deck/level or remove the AI before starting. An existing human is never
replaced. Changing an opponent resets the host's readiness. The AI is ready
automatically and takes at most three free opening mulligans for a 2–5-land hand.
Missing scripts in the AI deck are reported to the host without substitutions.

AI is driven by the native PlayerControllerAi with the Default profile on the
same serialized game executor as human actions. Native targeting, cost payments,
triggers, combat, blockers, damage and cleanup stay in Forge. Each non-mana stack
action returns a human response window; AI lands and mana abilities retain
priority. Human callbacks can suspend an AI turn without losing the outstanding
decision. Reload reconnects to the same in-memory game. Clients cannot control
an AI seat. Old bridges must advertise AI support before an AI match can start.

The levels are deliberate training policies, not calibrated ratings or different
Forge search algorithms:

- **Leicht:** at most one proactive spell/non-mana activation per own turn;
  no proactive actions in the human's turn.
- **Normal:** at most three proactive spells/non-mana activations per own turn;
  native responses during the human's turn.
- **Schwer:** native decisions without an additional per-turn action limit,
  including responses during the human's turn.

Lands, mana abilities, triggers and choices during effects do not consume these
limits. No extra starting life, mana, or cards are granted. Each uninterrupted
AI executor burst is capped at 64 steps to prevent endless automatic actions;
if that limit is exceeded, an error is shown and the match must be left/restarted.
Forge AI has card-specific limitations, particularly with unusual combos; custom
deck strength and perfect play are not guaranteed. The existing casual training
bot remains independent. Multi-opponent AI pods are a later milestone.

`node scripts/test-forge-ai.mjs` plays multi-turn scenarios for all five prepared
decks at all three levels and an Isamaru combat control deck. After building,
`node scripts/test-forge-ai-browser.mjs` tests solo setup, levels, own/prepared
decks, readiness changes, remove, response windows, reload, resolution,
concession and leaving. Browser prerequisites are the same as below.
## Opt-in decision automation

The **Entscheidungen** button opens settings in the lobby or during play, on
phones and desktop. Settings belong to the authenticated human at this table;
new tables default to manual. Reconnect restores the same preference and the
last eight automatically answered decisions. No account-wide consent is inferred.

The first reviewed family is the five reveal lands: Port Town, Choked Estuary,
Foreboding Ruins, Game Trail and Fortified Village. Forge marks only their
single-card reveal cost with `automation: 'reveal-land'`. Manual mode preserves
both explicit card selection and declining (tapped entry). Opt-in automatic mode
reveals one legal candidate only when every legal candidate has the same name.
Distinct names stay manual because revealing information is a strategic choice.
No eligible candidate follows native tapped entry without an impossible prompt.

The server consumes only that player's projected pending options and answers
through the same serial queue and native seat/choice/ID/count validation as
manual choices. It rechecks consent and choice ID when queued work executes.
Accepted answers are journaled privately; actual card reveals retain the existing
viewer-scoped native journal. Each choice ID is attempted once. Rejected automatic
answers switch that player to manual with an error notice; they are never blindly
retried. The failed pending choice must be answered manually before opt-in can
be enabled again. Turning automation off cannot undo an already accepted reveal.

Other callback families are not enabled by this preference. Further increments
must have their own opt-in, manual path, native examples, privacy and reconnect
checks before being enabled. Existing unsupported callbacks remain subject to
the limitations below; this is not a claim that every card is implemented.

Run `node scripts/test-forge-automation.mjs` with Forge configured and, after
building, `node scripts/test-forge-automation-browser.mjs` with the browser
prerequisites below. See [optional automation verification](../deploy/FORGE-AUTOMATION-2026-10-14.md).

## Remaining scope

Experimental two-seat matches are kept in memory and lost on server restart.
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
and all **eight** bridge files compiled with UTF-8:

```sh
javac -encoding UTF-8 -cp /path/to/forge-gui-desktop-2.0.15-jar-with-dependencies.jar -d /path/to/classes forge-bridge/BatusForge.java forge-bridge/HumanDecisions.java forge-bridge/HumanCombat.java forge-bridge/HumanCosts.java forge-bridge/CommanderDecks.java forge-bridge/FilterMana.java forge-bridge/ForgeAi.java forge-bridge/HumanMana.java
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
node scripts/test-forge-payments.mjs
node scripts/test-forge-deck-mechanics.mjs
node scripts/test-forge-ai.mjs
node scripts/test-forge-ai-interactions.mjs
```

After building, `node scripts/test-forge-commander-browser.mjs` tests two
authenticated browsers, local/account decks, privacy, readiness, mulligan,
reload, cast/resolve and concession. `test-forge-costs-browser.mjs` covers the
previous payment fixture. They require Playwright (or `PLAYWRIGHT_MODULE`) and
Chromium (`CHROME_PATH` can select an installed executable). Screenshots go to
ignored `.local/browser`. See the [Commander verification report](../deploy/FORGE-COMMANDER-2026-10-13.md).

Keep Forge's GPL license and provide corresponding source when distributing the
linked bridge. MTG card images and scripts have separate third-party rights.
