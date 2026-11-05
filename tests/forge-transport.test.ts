import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {PassThrough} from 'node:stream';
import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {ForgeTransport} from '../server/forge-transport.ts';
import type {ForgeState} from '../shared/forge-protocol.ts';

const state: ForgeState = {
 cards: [], stack: [], life: [40, 40], active: 0, priority: 0,
 passes: 0, turn: 1, log: [],
};
function fixture(timeouts = {ready: 1000, action: 1000}, onReady = (_reply: unknown) => {}) {
 const child = Object.assign(new EventEmitter(), {
  stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
  kills: 0, kill() { this.kills++; return true; },
 });
 const sent: any[] = [];
 child.stdin.on('data', chunk => sent.push(JSON.parse(chunk.toString())));
 let failures = 0;
 const updates: {state: ForgeState; error?: string}[] = [];
 const transport = new ForgeTransport(child as unknown as ChildProcessWithoutNullStreams, {
  onFailure: () => failures++, onReady,
  onUpdate: (state, error) => updates.push({state, error}),
 }, timeouts);
 const reply = (value: unknown) => child.stdout.write('@@BATUSFORGE@@' + JSON.stringify(value) + '\n');
 return {child, sent, updates, transport, reply, failures: () => failures};
}

test('bridge separates diagnostics, updates and correlated action replies', async t => {
 const f = fixture(); t.after(() => f.transport.stop());
 f.child.stdout.write('Forge diagnostic without protocol prefix\n');
 f.reply({ready: true, state});
 assert.deepEqual(await f.transport.ready, state);
 f.transport.initialize({decks: []});
 const first = f.transport.request(0, {type: 'pass'});
 const second = f.transport.request(1, {type: 'keep'});
 assert.deepEqual(f.sent, [{decks: []}, {id: '1', seat: 0, action: {type: 'pass'}}, {id: '2', seat: 1, action: {type: 'keep'}}]);
 f.reply({update: true, state: {...state, turn: 2}, error: 'Entscheidung nötig'});
 f.reply({id: 'unknown', ok: true});
 f.reply({id: '2', ok: false, error: 'Keine Priorität'});
 f.reply({id: '2', ok: true});
 f.reply({id: '1', ok: true, state});
 assert.equal((await first).ok, true);
 assert.equal((await second).error, 'Keine Priorität');
 assert.deepEqual(f.updates, [
  {state, error: undefined},
  {state: {...state, turn: 2}, error: 'Entscheidung nötig'},
  {state, error: undefined},
 ]);
 assert.equal(f.failures(), 0);
});

for (const source of ['process', 'stdin', 'stdout', 'stderr', 'exit', 'close', 'eof'] as const) {
 test(`${source} failure rejects every request and reports failure once`, async t => {
  const f = fixture(); t.after(() => f.transport.stop());
  f.reply({ready: true, state}); await f.transport.ready;
  const first = assert.rejects(f.transport.request(0, {type: 'pass'}), /beendet/);
  const second = assert.rejects(f.transport.request(1, {type: 'pass'}), /beendet/);
  if (source === 'process') f.child.emit('error', new Error('private Java diagnostic'));
  else if (source === 'exit') f.child.emit('exit', 1);
  else if (source === 'close') f.child.emit('close', 1);
  else if (source === 'eof') f.child.stdout.end();
  else f.child[source].emit('error', new Error('private card data'));
  await Promise.all([first, second]);
  f.child.emit('error', new Error('late process error'));
  f.child.emit('close', 1);
  f.child.stdin.emit('error', new Error('late pipe error'));
  assert.equal(f.failures(), 1);
  assert.equal(f.child.kills, 1);
  await assert.rejects(f.transport.request(0, {type: 'pass'}), /beendet/);
  assert.equal(f.sent.length, 2);
 });
}

test('startup timeout rejects readiness and terminates the process', async t => {
 const f = fixture({ready: 20, action: 1000}); t.after(() => f.transport.stop());
 await assert.rejects(f.transport.ready, /antwortet nicht/);
 assert.equal(f.failures(), 1);
 assert.equal(f.child.kills, 1);
});

test('action timeout invalidates the bridge and rejects all outstanding requests', async t => {
 const f = fixture({ready: 1000, action: 20}); t.after(() => f.transport.stop());
 f.reply({ready: true, state}); await f.transport.ready;
 const results = await Promise.allSettled([
  f.transport.request(0, {type: 'pass'}), f.transport.request(1, {type: 'pass'}),
 ]);
 for (const result of results) {
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.reason.message, /antwortet nicht/);
 }
 assert.equal(f.failures(), 1);
 assert.equal(f.child.kills, 1);
});

test('manual stop rejects readiness and requests without reporting a crash', async () => {
 const f = fixture();
 const ready = assert.rejects(f.transport.ready, /beendet/);
 const request = assert.rejects(f.transport.request(0, {type: 'pass'}), /beendet/);
 f.transport.stop(); f.transport.stop();
 f.reply({update: true, state});
 f.transport.initialize({decks: []});
 await Promise.all([ready, request]);
 assert.equal(f.child.kills, 1);
 assert.equal(f.failures(), 0);
 assert.deepEqual(f.updates, []);
 assert.equal(f.sent.length, 1);
});

for (const body of ['{broken json', 'null', '[]', '{"update":true}', '{"ready":true}', '{"ready":true,"state":[]}']) {
 test(`malformed protocol message ${body} terminates startup once`, async t => {
  const f = fixture(); t.after(() => f.transport.stop());
  const ready = assert.rejects(f.transport.ready);
  f.child.stdout.write('@@BATUSFORGE@@' + body + '\n');
  await ready;
  assert.equal(f.failures(), 1);
  assert.equal(f.child.kills, 1);
 });
}

test('specific startup rejection survives cleanup without a second failure signal', async t => {
 const error = new Error('unsupported Forge version');
 const f = fixture(undefined, () => { throw error; }); t.after(() => f.transport.stop());
 const ready = assert.rejects(f.transport.ready, actual => actual === error);
 f.reply({ready: true, error: 'startup rejected'});
 await ready;
 assert.equal(f.failures(), 0);
 assert.equal(f.child.kills, 1);
});

test('synchronous write error rejects the pending action and closes the bridge', async t => {
 const f = fixture(); t.after(() => f.transport.stop());
 f.reply({ready: true, state}); await f.transport.ready;
 const write = mock.method(f.child.stdin, 'write', () => { throw new Error('EPIPE'); });
 try {
  await assert.rejects(f.transport.request(0, {type: 'pass'}), /beendet/);
  assert.equal(f.failures(), 1);
 } finally { write.mock.restore(); }
});

test('asynchronous write callback error rejects initialization safely', async t => {
 const f = fixture(); t.after(() => f.transport.stop());
 const write = mock.method(f.child.stdin, 'write', (...args: any[]) => {
  const callback = args[args.length - 1] as (error: Error) => void;
  queueMicrotask(() => callback(new Error('EPIPE'))); return false;
 });
 try {
  const ready = assert.rejects(f.transport.ready, /beendet/);
  f.transport.initialize({decks: []});
  await ready;
  assert.equal(f.failures(), 1);
 } finally { write.mock.restore(); }
});

test('real child process exchanges messages and is reaped on stop', async t => {
 const child = spawn(process.execPath, ['-e', `
  const send = reply => require('node:fs').writeSync(1, '@@BATUSFORGE@@' + JSON.stringify(reply) + '\\n');
  send({ready: true, state: ${JSON.stringify(state)}});
  const buffer = Buffer.alloc(4096);
  let input = '';
  while (true) {
   const count = require('node:fs').readSync(0, buffer);
   if (!count) break;
   input += buffer.toString('utf8', 0, count);
   let newline;
   while ((newline = input.indexOf('\\n')) !== -1) {
    const request = JSON.parse(input.slice(0, newline));
    input = input.slice(newline + 1);
    send({id: request.id, ok: true});
   }
  }
 `]);
 let failures = 0;
 const transport = new ForgeTransport(child, {onReady: () => {}, onFailure: () => failures++, onUpdate: () => {}});
 t.after(() => transport.stop());
 await transport.ready;
 assert.equal((await transport.request(0, {type: 'pass'})).ok, true);
 const closed = once(child, 'close');
 transport.stop(); await closed;
 assert.equal(failures, 0);
});

test('missing executable rejects readiness without an unhandled process error', async t => {
 const child = spawn('/nonexistent-forge-java', []);
 let failures = 0;
 const transport = new ForgeTransport(child, {onReady: () => {}, onFailure: () => failures++, onUpdate: () => {}});
 t.after(() => transport.stop());
 await assert.rejects(transport.ready, /beendet/);
 assert.equal(failures, 1);
});
