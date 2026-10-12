# Forge integration – interactive milestone

Decision: retain the freely correctable casual game and develop Forge as an
independent, opt-in automated engine. No Moxgate source has been copied.

Implemented:

- Genuine Forge Java worker with JSON-line commands, separate process, bounded
  startup/action waits and explicit shutdown.
- Two authenticated players, own hand visibility, public battlefield and stack;
  hidden library identities and opponent hands filtered on the server.
- Direct click-to-cast and highlighted click-to-target, compact response stack,
  hover preview, priority pass and always reachable leave action.
- Real mana costs, automatic basic-land payment, legal-target validation,
  Counterspell resolution, creature entry triggers, tokens and card draw through
  Forge instead of recreating those effects in the casual engine.
- Serial action queue, revision checking, duplicate-action protection,
  reconnect after page reload and protection against simultaneous casual/Forge
  membership. Maximum two experimental tables.
- Optional environment configuration; disabled by default on production.

Verified:

- Java compilation against the official Forge 2.0.15 desktop release.
- Real engine tests: Swords answered with Counterspell; paid lands tap; target
  remains on battlefield; Divination draws two; Raise the Alarm creates two
  tokens; both Soul Wardens gain two life through their stack triggers.
- Two real Socket.IO sessions: privacy, third-seat rejection, unauthorized
  priority, duplicate requests, stale revisions, creature entry/life triggers,
  leaving closes the test room.
- Two separate Chromium contexts: create/join, targeted casting, responding,
  passing, resolution, page reload and leaving. No browser script errors.
- TypeScript check, production build and all 209 existing/new unit/server tests.

Limits:

This is a five-card fixture in a fixed main phase. It is **not** full automated
Commander, and accepts no user decks. The AI controller supplies automatic mana
payment and the fixture's mandatory triggers; a general human decision adapter
is still needed. No complete turns/combat, mulligans, four-player setup,
general optional/targeted triggers, match persistence or recovery after a worker
crash. Leaving terminates both players' experimental match.

Deployment: no live-server update performed. The ordinary server archive/Docker
image has no Forge runtime and will not enable this mode. Read
`forge-bridge/README.md` before enabling it; Java/assets/classes are supplied
separately. The linked Java bridge carries GPL-3.0-or-later and includes its
license. Source availability must accompany distribution.

Next: human decision adapter and real turn transitions, followed by genuine
Commander deck loading and broader card/choice tests. Keep prototype opt-in
until those pass; never advertise arbitrary deck automation prematurely.
