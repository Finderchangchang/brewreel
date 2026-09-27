// @ts-check
// Child-process wrapper: fixed argv (shell: false), whitelisted environment, hard timeout, process-tree
// termination, bounded output capture and a line callback for progress parsing.
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import {SECRET_ENV_RE} from './config.js';

const WIN = process.platform === 'win32';

const ENV_WHITELIST = [
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'LANG', 'LANGUAGE', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE',
  'HOMEDRIVE', 'HOMEPATH', 'SYSTEMDRIVE', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR', 'FONTCONFIG_PATH',
];
const PROXY_VARS = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy'];
/**
 * Voice-over (TTS) variables. Only the render process (make.mjs) gets them, and only these fixed names:
 * the MiniMax, Alibaba Cloud (DashScope) and Volcengine keys plus their optional ids / hosts, and the TTS
 * cache folder. Every other credential-looking variable is still dropped, and envPassthrough cannot add more.
 */
export const VOICE_ENV = Object.freeze([
  'MINIMAX_API_KEY', 'MINIMAX_GROUP_ID', 'MINIMAX_BASE_URL',
  'DASHSCOPE_API_KEY', 'DASHSCOPE_WORKSPACE_ID', 'DASHSCOPE_REGION', 'DASHSCOPE_TTS_URL',
  'VOLCENGINE_TTS_API_KEY', 'VOLCENGINE_TTS_APP_ID', 'VOLCENGINE_TTS_ACCESS_TOKEN', 'VOLCENGINE_TTS_BASE_URL',
  'BREWREEL_TTS_CACHE',
]);

/**
 * Build the environment for a child process from a whitelist. Credentials never pass: anything whose
 * name looks like a key / token / secret is dropped even if a whitelist or passthrough names it —
 * except the fixed VOICE_ENV names when `voice` is true (render process only).
 * @param {{extra?: Record<string, string | undefined>, passthrough?: string[], proxy?: boolean, voice?: boolean, source?: NodeJS.ProcessEnv}} [o]
 */
export function cleanEnv({extra = {}, passthrough = [], proxy = false, voice = false, source = process.env} = {}) {
  /** @type {Record<string, string>} */
  const env = {};
  const want = new Set([...ENV_WHITELIST, ...passthrough.map((x) => x.toUpperCase()), ...(proxy ? PROXY_VARS.map((x) => x.toUpperCase()) : [])]);
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined) continue;
    const K = k.toUpperCase();
    if (voice && VOICE_ENV.includes(K)) {
      env[K] = v;
      continue;
    }
    const ok = want.has(K) || K.startsWith('LC_');
    if (ok && !SECRET_ENV_RE.test(K)) env[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') env[k] = v;
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  env.NO_COLOR = '1';
  env.FORCE_COLOR = '0';
  return env;
}

/**
 * Terminate a process and all its descendants. Windows: `taskkill /PID <pid> /T /F` with fixed args;
 * elsewhere: the process group created by `detached: true`.
 * @param {import('node:child_process').ChildProcess} child
 */
export function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (WIN) {
    const sysroot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const taskkill = path.join(sysroot, 'System32', 'taskkill.exe');
    try {
      spawnSync(fs.existsSync(taskkill) ? taskkill : 'taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore', windowsHide: true, shell: false});
    } catch {}
    try {
      child.kill('SIGKILL');
    } catch {}
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  setTimeout(() => {
    try {
      if (child.exitCode === null && child.pid) process.kill(-child.pid, 'SIGKILL');
    } catch {}
  }, 3000).unref();
}

/** Keeps the last `limit` characters of a stream. */
class Tail {
  /** @param {number} limit */
  constructor(limit) {
    this.limit = limit;
    this.text = '';
    this.dropped = 0;
  }
  /** @param {string} s */
  push(s) {
    this.text += s;
    if (this.text.length > this.limit * 2) {
      const cut = this.text.length - this.limit;
      this.dropped += cut;
      this.text = this.text.slice(cut);
    }
  }
  value() {
    if (this.text.length <= this.limit) return this.text;
    return this.text.slice(this.text.length - this.limit);
  }
}

/**
 * @typedef {object} RunOptions
 * @property {string} cmd absolute executable (normally process.execPath)
 * @property {string[]} args fixed argv
 * @property {string} cwd
 * @property {Record<string, string>} env
 * @property {number} timeoutMs hard deadline; the process tree is killed after it
 * @property {AbortSignal} [signal] cancellation
 * @property {(line: string, stream: 'stdout' | 'stderr') => void} [onLine]
 * @property {number} [maxCaptureChars] per stream, default 1M characters
 * @property {(child: import('node:child_process').ChildProcess) => void} [onSpawn]
 */

/**
 * @typedef {object} RunResult
 * @property {number | null} code
 * @property {string | null} signal
 * @property {string} stdout
 * @property {string} stderr
 * @property {boolean} timedOut
 * @property {boolean} aborted
 * @property {string | null} spawnError
 * @property {number} durationMs
 * @property {number | undefined} pid
 */

/**
 * Run one process to completion. Never rejects; spawn failures come back as `spawnError`.
 * @param {RunOptions} o
 * @returns {Promise<RunResult>}
 */
export function runProcess(o) {
  const t0 = Date.now();
  const cap = o.maxCaptureChars ?? 1_000_000;
  const out = new Tail(cap);
  const err = new Tail(cap);
  return new Promise((resolve) => {
    let timedOut = false;
    let aborted = false;
    /** @type {string | null} */
    let spawnError = null;
    /** @type {import('node:child_process').ChildProcess} */
    let child;
    try {
      child = spawn(o.cmd, o.args, {
        cwd: o.cwd,
        env: o.env,
        shell: false,
        windowsHide: true,
        detached: !WIN,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({code: null, signal: null, stdout: '', stderr: '', timedOut: false, aborted: false, spawnError: String(/** @type {any} */ (e)?.message ?? e), durationMs: 0, pid: undefined});
      return;
    }
    o.onSpawn?.(child);
    /** @param {'stdout' | 'stderr'} name @param {Tail} tail */
    const reader = (name, tail) => {
      const dec = new StringDecoder('utf8');
      let pending = '';
      /** @param {string} s */
      const feed = (s) => {
        tail.push(s);
        if (!o.onLine) return;
        pending += s;
        const parts = pending.split(/\r?\n|\r(?!\n)/);
        pending = parts.pop() ?? '';
        for (const line of parts) {
          try {
            o.onLine(line, name);
          } catch {}
        }
      };
      const stream = child[name];
      stream?.on('data', (b) => feed(dec.write(b)));
      stream?.on('end', () => {
        feed(dec.end());
        if (pending && o.onLine) {
          try {
            o.onLine(pending, name);
          } catch {}
        }
        pending = '';
      });
    };
    reader('stdout', out);
    reader('stderr', err);
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, Math.max(1, o.timeoutMs));
    const onAbort = () => {
      aborted = true;
      killTree(child);
    };
    if (o.signal) {
      if (o.signal.aborted) onAbort();
      else o.signal.addEventListener('abort', onAbort, {once: true});
    }
    child.on('error', (e) => {
      spawnError = e.message;
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
      resolve({code, signal, stdout: out.value(), stderr: err.value(), timedOut, aborted, spawnError, durationMs: Date.now() - t0, pid: child.pid});
    });
  });
}

/** Simple counting semaphore for render concurrency. */
export class Semaphore {
  /** @param {number} n */
  constructor(n) {
    this.n = n;
    this.active = 0;
    /** @type {(() => void)[]} */
    this.queue = [];
  }
  /** @param {AbortSignal} [signal] @returns {Promise<() => void>} */
  acquire(signal) {
    return new Promise((resolve, reject) => {
      const grant = () => {
        this.active += 1;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active -= 1;
          this.queue.shift()?.();
        });
      };
      if (this.active < this.n) return grant();
      const entry = () => {
        signal?.removeEventListener('abort', onAbort);
        grant();
      };
      const onAbort = () => {
        const i = this.queue.indexOf(entry);
        if (i >= 0) this.queue.splice(i, 1);
        reject(new Error('cancelled while waiting for a render slot'));
      };
      signal?.addEventListener('abort', onAbort, {once: true});
      this.queue.push(entry);
    });
  }
}
