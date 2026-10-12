# BatusMTG – optional Forge integration prototype

This is a separate experimental match engine, not a replacement for the casual table.
The Java bridge sources are licensed under GPL-3.0-or-later (see LICENSE). It links against
Card-Forge 2.0.15. Forge and its card scripts are supplied separately:
https://github.com/Card-Forge/forge/releases/tag/forge-2.0.15

## Current scope

Two authenticated human clients control casting, targets, modes, trigger ordering,
priority and cleanup discards. Forge pays actual mana and resolves the results.
The standard fixture still contains Grizzly Bears, Swords to Plowshares,
Counterspell, Raise the Alarm and Divination. The new **Effektentscheidungen**
fixture contains Preordain, Impulse, Innocent Blood, You Meet in a Tavern,
Raise the Alarm and Man-o'-War, with Soul's Attendant on the battlefield. The separate **Kampf** fixture provides
Grizzly Bears, Air Elemental, Silvercoat Lion, Fencing Ace, Vampire Nighthawk and
Colossal Dreadmaw for human combat decisions. The **Zusatzkosten** fixture supplies
Village Rites, Tormenting Voice and Fling, two differently sized creatures,
Counterspell and enough basic lands to exercise actual payments and responses.

HumanDecisions bridges synchronous Forge callbacks to online input. The game
executor pauses for Scry/Surveil, card/entity selections, ordering, sacrifices
by effects, modes, targets and optional confirmations. The stdin reader remains
available for validated answers; it cannot mutate game objects. The first pause
returns the original action, later pauses/completion publish snapshots. This
keeps Socket.IO requests short while allowing the player time to decide.
Each decision checks its ID, seat, allowed IDs, bounds, repeats and complete
Scry partitions. Invalid responses leave the engine waiting. Private options,
prompts and source names are excluded from opponents' projections.

Mandatory choices have no automatic AI fallback or automatic timeout answer.
Leaving kills the match process; reload restores the outstanding choice.
Identical life-gain triggers from the same Soul Warden/Attendant keep their
existing order to avoid an unnecessary ordering prompt. Other simultaneous
abilities require human ordering, and targets are chosen before adding triggers
to the stack. Basic mana payment still uses the Forge AI cost solver. Ordinary
discard-one-card and sacrifice-one-creature spell costs now use HumanCosts:
the player chooses a legal card or cancels before payment. The spell cannot pay
its own discard cost. Choices remain private, survive reload and reject stale,
foreign or malformed answers. Forge collects the decisions before paying costs;
only then does the opponent get priority. Countering a spell does not refund
its paid costs. Fling can target either player or a legal creature and uses the
sacrificed creature's last-known power. Unsupported additional spell costs are
rejected rather than silently selected by the AI. Other non-mana costs,
numbers/colors, divided targets, special reveal rules and other
unimplemented controller callbacks are not validated for arbitrary decks.

Predefined hands/lands/libraries remain. Turns now advance through Forge's own
phase end/begin hooks: end-step response window, cleanup with human discards,
untap/upkeep/draw and the next main phase. Empty steps advance automatically;
stack entries stop advancement for responses. Basic lands can be played under
Forge's land/timing restrictions and land counts reset on actual turn changes.
The single-phase adapter pins Forge 2.0.15 private hook names via reflection;
it never resets the game to fake a new turn. Regression tests are mandatory
before upgrading Forge.
No commander selection, mulligans, arbitrary decks,
four-player games or persistence are implemented.
The combat fixture exposes an explicit attack action, human attacker and blocker
selection on the board, and damage allocation for multiple recipients or trample.
Forge checks attack/block constraints, handles first/double strike, flying,
deathtouch, lifelink, simultaneous damage and state-based deaths. Both players
receive response windows before declarations and damage. Invalid global block
or damage combinations require a corrected choice. Simultaneous graveyard moves
may require the owner to order cards. Damage choices are limited to 128 points.
Only the opposing player can be attacked in this fixture; planeswalkers, battles,
banding, special attack costs and unusual damage assignment are not validated.
The original fixtures continue to skip attacking when ending a turn.
This is still not a full Commander game.
Both clients' match ends if either explicitly leaves. Reload reconnects to the
in-memory match; server restart loses experimental matches.

The existing casual engine is independent. A user cannot simultaneously join a
Forge match and a casual room. Library identities and opponent hand identities
are removed by the server before broadcasting. Action queues, revisions and
request IDs prevent racing and duplicate casts. Maximum two experimental rooms.

## Opt-in setup

Requires Java 17, the unpacked official Forge 2.0.15 desktop release including
`res`, and compiled BatusForge classes. Compile **all four BatusForge.java, HumanDecisions.java, HumanCombat.java and HumanCosts.java** using Java 17 with explicit UTF-8 source encoding (`-encoding UTF-8`)
against `forge-gui-desktop-2.0.15-jar-with-dependencies.jar`.

Set **all three** server environment variables to absolute paths:

- `FORGE_JAVA`: Java executable
- `FORGE_RUNTIME`: unpacked Forge directory
- `FORGE_CLASSES`: compiled class directory

Run the existing server. The lobby exposes “Automatik-Testtisch · Forge”. Without
these variables the mode is disabled. The production Docker image does not include
Java, Forge assets or compiled bridge classes. Do not deploy that image expecting
Forge automation to be available.

The UI shows the current phase, who needs to act and the latest public actions.
Player targets are selected through highlighted player names. Cost windows do
not overlap card previews, and the table/choices adapt to narrow phone screens.
Selections cannot be submitted while disconnected; reconnect/reload retrieves
the engine's outstanding decision.

Keep Forge's GPL license and provide corresponding source when distributing a
linked bridge. MTG card images and scripts have separate third-party rights.

## Next milestone

Audit remaining controller callbacks, special combat rules and non-mana costs,
then validate genuine Commander decks before general release.

With FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES set, run
`node scripts/test-forge.mjs`, `node scripts/test-forge-decisions.mjs`,
`node scripts/test-forge-combat.mjs` and `node scripts/test-forge-costs.mjs`
for the real engine regression tests.

After building the client, `node scripts/test-forge-costs-browser.mjs` exercises
two authenticated browsers, reconnect, payments, responses and a 390px viewport.
It requires Playwright (or `PLAYWRIGHT_MODULE` pointing to its ESM entry) and a
Chromium browser; `CHROME_PATH` can select a locally installed executable.
Screenshots go to the ignored `.local/browser` directory.
