// Process lifecycle helpers for the offline renderer: watch children, wait for pipe drain, stop worker trees.
import { spawn, type ChildProcess } from 'node:child_process';

export interface RenderProcess {
  child: ChildProcess;
  done: Promise<void>;
  failure?: Error;
  closed: boolean;
  label: string;
}

export function watchProcess(child: ChildProcess, label: string): RenderProcess {
  const state = { child, label, closed: false } as RenderProcess;
  state.done = new Promise<void>((resolve, reject) => {
    const fail = (error: Error) => {
      state.failure ??= error;
      reject(state.failure);
    };
    child.once('error', error => fail(new Error(`${label} failed to start: ${error.message}`, { cause: error })));
    child.stdin?.on('error', error => fail(new Error(`${label} input failed: ${error.message}`, { cause: error })));
    child.once('close', (code, signal) => {
      state.closed = true;
      if (code === 0) resolve();
      else fail(new Error(`${label} exited ${code ?? `with signal ${signal}`}`));
    });
  });
  // Frames may be drawing when a child fails. Retain the rejection for the caller
  // without an unhandled-rejection window before it reaches its next await.
  void state.done.catch(() => {});
  return state;
}

export function waitForDrain(state: RenderProcess): Promise<void> {
  if (state.failure) return Promise.reject(state.failure);
  if (state.closed) return Promise.reject(new Error(`${state.label} closed before input finished`));
  const input = state.child.stdin;
  if (!input) return Promise.reject(new Error(`${state.label} has no input pipe`));
  if (input.destroyed || input.writableEnded) return Promise.reject(new Error(`${state.label} input pipe is closed`));
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      input.off('drain', drained);
      input.off('error', failed);
      input.off('close', failed);
      state.child.off('error', failed);
      state.child.off('close', failed);
    };
    const drained = () => { cleanup(); resolve(); };
    const failed = () => {
      cleanup();
      reject(state.failure ?? new Error(`${state.label} closed before input drained`));
    };
    input.once('drain', drained);
    input.once('error', failed);
    input.once('close', failed);
    state.child.once('error', failed);
    state.child.once('close', failed);
  });
}

const running = (child: ChildProcess) => child.pid !== undefined && child.exitCode === null && child.signalCode === null;

export async function stopWorkerTree(
  child: ChildProcess,
  platform = process.platform,
  spawnProcess = spawn,
  signalProcess = process.kill,
): Promise<void> {
  if (!running(child)) return;
  try {
    if (platform === 'win32') {
      // Node's child.kill() on Windows leaves the worker's FFmpeg behind.
      const killer = spawnProcess('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      await watchProcess(killer, `stop worker ${child.pid}`).done;
    } else {
      // Workers are launched as separate process groups on Unix.
      signalProcess(-child.pid!, 'SIGTERM');
    }
  } catch (error) {
    // it may have finished between the failure and the cleanup
    if (!running(child)) return;
    child.kill();
    throw error;
  }
}

export async function cancelWorkers(children: ChildProcess[], stop = stopWorkerTree): Promise<void> {
  const results = await Promise.allSettled(children.map(child => stop(child)));
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Could not stop every render worker tree');
}
