import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface, type Interface} from 'node:readline';
import type {ForgeState} from '../shared/forge-protocol.ts';

export interface ForgeReply {
 ready?: boolean;
 id?: string;
 update?: boolean;
 state?: ForgeState;
 error?: string;
 mode?: string;
 features?: string[];
 issues?: {seat: number; cards: string[]}[];
 ok?: boolean;
 paused?: boolean;
 accepted?: boolean;
}

interface Callbacks {
 onFailure: () => void;
 onReady: (reply: ForgeReply) => void;
 onUpdate: (state: ForgeState, error?: string) => void;
}
interface Pending {
 resolve: (reply: ForgeReply) => void;
 reject: (error: Error) => void;
 timer: ReturnType<typeof setTimeout>;
}
const prefix = '@@BATUSFORGE@@';
const stopped = () => new Error('Forge-Testtisch wurde beendet');

/** Owns process I/O and settles every outstanding request before reporting failure. */
export class ForgeTransport {
 private readonly pending = new Map<string, Pending>();
 private readonly lines: Interface;
 private closed = false;
 private sequence = 0;
 private readonly process: ChildProcessWithoutNullStreams;
 private readonly callbacks: Callbacks;
 private readonly timeouts: {ready: number; action: number};
 readonly ready: Promise<ForgeState>;

 constructor(
  process: ChildProcessWithoutNullStreams,
  callbacks: Callbacks,
  timeouts = {ready: 60000, action: 15000},
 ) {
  this.process = process;
  this.callbacks = callbacks;
  this.timeouts = timeouts;
  this.ready = this.wait('ready', timeouts.ready).then(reply => reply.state!);
  const failed = () => this.fail(stopped());
  process.on('error', failed);
  process.on('exit', failed);
  process.on('close', failed);
  process.stdin.on('error', failed);
  process.stdout.on('error', failed);
  process.stderr.on('error', failed);
  process.stderr.on('data', () => {});
  this.lines = createInterface({input: process.stdout});
  this.lines.on('error', failed);
  this.lines.on('line', line => this.receive(line));
  this.lines.on('close', failed);
 }

 private wait(key: string, ms: number): Promise<ForgeReply> {
  return new Promise((resolve, reject) => {
   const timer = setTimeout(() => {
    this.fail(new Error('Forge antwortet nicht. Testtisch neu starten.'));
   }, ms);
   this.pending.set(key, {resolve, reject, timer});
  });
 }

 private receive(line: string) {
  if (this.closed || !line.startsWith(prefix)) return;
  try {
   const reply: ForgeReply = JSON.parse(line.slice(prefix.length));
   if (!reply || typeof reply !== 'object' || Array.isArray(reply)) throw stopped();
   if ((reply.ready || reply.update) && (!reply.state || typeof reply.state !== 'object' || Array.isArray(reply.state))) {
    // Startup errors deliberately have no state; preserve their specific error below.
    if (!reply.ready || (!reply.issues && !reply.error)) throw stopped();
   }
   if (reply.update) {
    this.callbacks.onUpdate(reply.state!, reply.error);
    return;
   }
   const key = reply.ready ? 'ready' : reply.id;
   const pending = key ? this.pending.get(key) : undefined;
   if (!pending) return; // Late or duplicate replies cannot settle another request.
   if (reply.ready) {
    try { this.callbacks.onReady(reply); }
    catch (error) {
     this.stop(error instanceof Error ? error : stopped());
     return;
    }
   }
   clearTimeout(pending.timer);
   this.pending.delete(key!);
   pending.resolve(reply);
  } catch {
   // JSON/parser diagnostics may contain private card data. Only expose a generic error.
   this.fail(stopped());
  }
 }

 private write(payload: unknown) {
  try {
   this.process.stdin.write(JSON.stringify(payload) + '\n', error => {
    if (error) this.fail(stopped());
   });
  } catch {
   this.fail(stopped());
  }
 }

 initialize(payload: unknown) {
  if (!this.closed) this.write(payload);
 }

 async request(seat: number, action: unknown): Promise<ForgeReply> {
  if (this.closed) throw stopped();
  const id = String(++this.sequence);
  const reply = this.wait(id, this.timeouts.action);
  this.write({id, seat, action});
  return reply;
 }

 private fail(error: Error) {
  if (this.closed) return;
  this.stop(error);
  this.callbacks.onFailure();
 }

 stop(error = stopped()) {
  if (this.closed) return;
  this.closed = true;
  for (const pending of this.pending.values()) {
   clearTimeout(pending.timer);
   pending.reject(error);
  }
  this.pending.clear();
  this.lines.close();
  this.process.kill();
 }
}
