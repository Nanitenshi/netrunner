import {test, type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {createForgeRooms} from '../server/forge-rooms.ts';
import {ForgeTransport} from '../server/forge-transport.ts';
import type {ForgeWorker} from '../server/forge-worker.ts';
import type {ForgeAction, ForgeRoom, ForgeState} from '../shared/forge-protocol.ts';

type ActionReply = Awaited<ReturnType<ForgeWorker['action']>>;
const host = {id: 'host', name: 'Host', provider: 'guest' as const};
const peer = {id: 'peer', name: 'Peer', provider: 'guest' as const};
const state = (turn = 1): ForgeState => ({
 cards: [], stack: [], life: [40, 40], active: 0, priority: 0,
 passes: 0, turn, log: [], choice: null,
});
function setup(t: TestContext) {
 const requests: {seat: number; action: ForgeAction; reply: {resolve: (reply: ActionReply) => void}}[] = [];
 const views = new Map<string, ForgeRoom | null>();
 let stops = 0;
 const child = Object.assign(new EventEmitter(), {
  stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
  kill() { stops++; return true; },
 });
 const send = (reply: unknown) => child.stdout.write('@@BATUSFORGE@@' + JSON.stringify(reply) + '\n');
 child.stdin.on('data', chunk => {
  const request = JSON.parse(chunk.toString());
  requests.push({seat: request.seat, action: request.action,
   reply: {resolve: result => { send({id: request.id, ...result}); }}});
 });
 const ready = {resolve: (state: ForgeState) => { send({ready: true, state}); }};
 const rooms = createForgeRooms({java: 'unused', runtime: 'unused', classes: 'unused'},
  (id, view) => views.set(id, view), (_config, onFailure, onUpdate) => {
   const transport = new ForgeTransport(child as unknown as ChildProcessWithoutNullStreams,
    {onReady: () => {}, onFailure, onUpdate});
   return {
    ready: transport.ready,
    async action(seat, action) { const reply = await transport.request(seat, action); return {...reply, ok: reply.ok === true}; },
    stop() { transport.stop(); },
   };
  });
 rooms.create(host); rooms.join(peer, {code: rooms.snapshot(host.id)!.code});
 t.after(() => rooms.close());
 return {
  rooms, views, ready, requests, stops: () => stops,
  fail: () => child.emit('error', new Error('private engine error')),
  update: (state: ForgeState, error?: string) => { send({update: true, state, error}); },
  input: (id = 'action') => ({id, revision: rooms.snapshot(host.id)!.revision, action: {type: 'pass' as const}}),
  async start() { const starting = rooms.start(host); ready.resolve(state()); await starting; },
 };
}

test('newer native update wins over an earlier action reply in the same event-loop turn', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input()); await setImmediate();
 f.requests[0].reply.resolve({ok: true, state: state(2)});
 const latest = state(3);
 latest.cards = [{id: 'secret', name: 'Private hand', owner: 0, controller: 0, zone: 'hand', tapped: false, token: false, type: 'Land'}];
 f.update(latest);
 await action;
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 3);
 assert.equal(f.views.get(peer.id)!.game!.turn, 3);
 assert.equal(f.rooms.snapshot(host.id)!.game!.cards[0].name, 'Private hand');
 assert(!JSON.stringify(f.views.get(peer.id)).includes('Private hand'));
 assert.deepEqual(f.views.get(peer.id)!.game!.handCounts, [1, 0]);
});

test('an action reply cannot resurrect a table after a worker failure', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input());
 const rejected = assert.rejects(action, /nicht aktiv|beendet/);
 await setImmediate();
 f.requests[0].reply.resolve({ok: true, state: state(2)});
 f.fail();
 await rejected;
 assert.equal(f.rooms.snapshot(host.id)!.game, null);
 assert.match(f.views.get(peer.id)!.error!, /Verbindung beendet/);
});

test('a later action snapshot wins over an earlier unsolicited update', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input()); await setImmediate();
 f.update(state(2));
 f.requests[0].reply.resolve({ok: true, state: state(3)});
 await action;
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 3);
});

test('state on a rejected action is still applied before a later native update', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input());
 const rejected = assert.rejects(action, /Keine Priorität/);
 await setImmediate();
 f.requests[0].reply.resolve({ok: false, error: 'Keine Priorität', state: state(2)});
 f.update(state(3)); await rejected;
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 3);
});

test('a settings revision during a pending action does not discard its legitimate state', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input()); await setImmediate();
 f.rooms.automation(host, {revealLands: true});
 f.requests[0].reply.resolve({ok: true, state: state(2)});
 await action;
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 2);
});

test('queued duplicate action IDs execute once despite the changed room revision', async t => {
 const f = setup(t); await f.start(); const input = f.input();
 const first = f.rooms.action(host, input), second = f.rooms.action(host, input);
 await setImmediate(); assert.equal(f.requests.length, 1);
 f.requests[0].reply.resolve({ok: true, state: state(2)});
 await Promise.all([first, second]);
 assert.equal(f.requests.length, 1);
});

test('stale room revision never reaches the native worker', async t => {
 const f = setup(t); await f.start(); const input = f.input();
 f.rooms.automation(host, {revealLands: true});
 await assert.rejects(f.rooms.action(host, input), /Spielstand hat sich geändert/);
 assert.equal(f.requests.length, 0);
});

test('automatic reveal reply cannot replace a newer native snapshot', async t => {
 const f = setup(t); await f.start(); f.rooms.automation(host, {revealLands: true});
 const choice = state();
 choice.choice = {id: '00000000-0000-4000-8000-000000000001', seat: 0, kind: 'reveal',
  automation: 'reveal-land', source: 'Port Town', count: 1, min: 1, max: 1,
  options: [{id: 'private-card', name: 'Plains', kind: 'card'}]};
 f.update(choice); await setImmediate();
 assert.equal(f.requests.length, 1);
 assert.equal(f.requests[0].action.type, 'choose');
 f.requests[0].reply.resolve({ok: true, state: state(2)});
 f.update(state(3)); await setImmediate();
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 3);
 assert.equal(f.rooms.snapshot(host.id)!.automaticDecisions.length, 1);
 assert.equal(f.rooms.snapshot(peer.id)!.automaticDecisions.length, 0);
 assert.equal(f.requests.length, 1);
});

test('native update received during startup wins over the initial ready snapshot', async t => {
 const f = setup(t); const starting = f.rooms.start(host);
 f.ready.resolve(state()); f.update(state(2)); await starting;
 assert.equal(f.rooms.snapshot(host.id)!.game!.turn, 2);
 assert.equal(f.rooms.snapshot(host.id)!.starting, false);
});

test('worker failure just after ready cannot start a dead game', async t => {
 const f = setup(t); const starting = f.rooms.start(host);
 const rejected = assert.rejects(starting, /Forge konnte nicht gestartet werden/);
 f.ready.resolve(state()); f.fail(); await rejected;
 assert.equal(f.rooms.snapshot(host.id)!.game, null);
 assert.equal(f.rooms.snapshot(host.id)!.starting, false);
});

test('leaving during startup cancels the worker and ignores its late updates', async t => {
 const f = setup(t); const starting = f.rooms.start(host);
 const rejected = assert.rejects(starting);
 f.rooms.leave(host); f.update(state(2)); await rejected;
 assert.equal(f.stops() > 0, true);
 assert.equal(f.rooms.snapshot(host.id), null);
 assert.equal(f.views.get(peer.id), null);
});

test('leaving during an action rejects it and never restores the deleted room', async t => {
 const f = setup(t); await f.start();
 const action = f.rooms.action(host, f.input()); const rejected = assert.rejects(action, /beendet/);
 await setImmediate(); f.rooms.leave(peer); f.update(state(2)); await rejected;
 assert.equal(f.rooms.snapshot(host.id), null);
 assert.equal(f.views.get(host.id), null);
});
