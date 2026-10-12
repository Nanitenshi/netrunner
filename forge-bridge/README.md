# BatusMTG – optional Forge integration prototype

This is a separate experimental match engine, not a replacement for the casual table.
`BatusForge.java` is licensed under GPL-3.0-or-later (see LICENSE). It links against
Card-Forge 2.0.15. Forge and its card scripts are supplied separately:
https://github.com/Card-Forge/forge/releases/tag/forge-2.0.15

## Current scope

Two authenticated human clients control casting, targets, modes, trigger ordering,
priority and cleanup discards. Forge pays actual mana and resolves the results.
The standard fixture still contains Grizzly Bears, Swords to Plowshares,
Counterspell, Raise the Alarm and Divination. The new **Effektentscheidungen**
fixture contains Preordain, Impulse, Innocent Blood, You Meet in a Tavern,
Raise the Alarm and Man-o'-War, with Soul's Attendant on the battlefield.

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
to the stack. Basic mana payment still uses the Forge AI cost solver. Non-mana
cost decisions, numbers/colors, divided targets, special reveal rules and other
unimplemented controller callbacks are not validated for arbitrary decks.

Predefined hands/lands/libraries remain. Turns now advance through Forge's own
phase end/begin hooks: end-step response window, cleanup with human discards,
untap/upkeep/draw and the next main phase. Empty steps advance automatically;
stack entries stop advancement for responses. Basic lands can be played under
Forge's land/timing restrictions and land counts reset on actual turn changes.
The single-phase adapter pins Forge 2.0.15 private hook names via reflection;
it never resets the game to fake a new turn. Regression tests are mandatory
before upgrading Forge.
No commander selection, interactive combat, mulligans, arbitrary decks,
four-player games or persistence are implemented.
Combat phases currently pass with no attackers. This is not a full game yet.
Both clients' match ends if either explicitly leaves. Reload reconnects to the
in-memory match; server restart loses experimental matches.

The existing casual engine is independent. A user cannot simultaneously join a
Forge match and a casual room. Library identities and opponent hand identities
are removed by the server before broadcasting. Action queues, revisions and
request IDs prevent racing and duplicate casts. Maximum two experimental rooms.

## Opt-in setup

Requires Java 17, the unpacked official Forge 2.0.15 desktop release including
`res`, and compiled BatusForge classes. Compile **both BatusForge.java and HumanDecisions.java** using Java 17 with explicit UTF-8 source encoding (`-encoding UTF-8`)
against `forge-gui-desktop-2.0.15-jar-with-dependencies.jar`.

Set **all three** server environment variables to absolute paths:

- `FORGE_JAVA`: Java executable
- `FORGE_RUNTIME`: unpacked Forge directory
- `FORGE_CLASSES`: compiled class directory

Run the existing server. The lobby exposes “Automatik-Testtisch · Forge”. Without
these variables the mode is disabled. The production Docker image does not include
Java, Forge assets or compiled bridge classes. Do not deploy that image expecting
Forge automation to be available.

Keep Forge's GPL license and provide corresponding source when distributing a
linked bridge. MTG card images and scripts have separate third-party rights.

## Next milestone

Implement human combat, audit remaining controller callbacks and non-mana costs,
then validate genuine Commander decks before general release.

With FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES set, run
`node scripts/test-forge.mjs` and `node scripts/test-forge-decisions.mjs`
for the real engine regression tests.
