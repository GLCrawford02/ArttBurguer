export type LogLevel = 'info' | 'warn' | 'error';

export interface LogTiming {
  startedAt: Date;
  durationMs: number;
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: string;
  timestamp: Date;
  startedAt?: Date;
  durationMs?: number;
}

const MAX_ENTRIES = 300;
const STORAGE_KEY = 'arttburger_sys_logs';

type Listener = (entries: LogEntry[]) => void;
const listeners = new Set<Listener>();

function getStored(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[]).map((e) => {
      const entry = e as Record<string, unknown>;
      return {
        ...entry,
        timestamp: new Date(entry.timestamp as string),
        startedAt: entry.startedAt ? new Date(entry.startedAt as string) : undefined,
      } as LogEntry;
    });
  } catch {
    return [];
  }
}

let entries: LogEntry[] = getStored();

function notify() {
  listeners.forEach((fn) => fn([...entries]));
}

export function subscribeLog(fn: Listener): () => void {
  listeners.add(fn);
  fn([...entries]);
  return () => { listeners.delete(fn); };
}

export function startTimer(): () => LogTiming {
  const t0 = new Date();
  return () => ({ startedAt: t0, durationMs: Date.now() - t0.getTime() });
}

export function addLog(
  level: LogLevel,
  component: string,
  message: string,
  data?: unknown,
  timing?: LogTiming,
): void {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    component,
    message,
    data: data !== undefined
      ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2))
      : undefined,
    timestamp: new Date(),
    startedAt: timing?.startedAt,
    durationMs: timing?.durationMs,
  };

  entries = [entry, ...entries].slice(0, MAX_ENTRIES);

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* quota exceeded */ }

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const timingStr = timing ? ` [${(timing.durationMs / 1000).toFixed(2)}s]` : '';
  consoleFn(`[${component}]${timingStr} ${message}`, data ?? '');

  notify();
}

export const logInfo  = (component: string, message: string, data?: unknown, timing?: LogTiming) => addLog('info',  component, message, data, timing);
export const logWarn  = (component: string, message: string, data?: unknown, timing?: LogTiming) => addLog('warn',  component, message, data, timing);
export const logError = (component: string, message: string, data?: unknown, timing?: LogTiming) => addLog('error', component, message, data, timing);

export function clearLogs(): void {
  entries = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* quota */ }
  notify();
}

export function exportLogsAsText(): string {
  return entries
    .map((e) => {
      const ts = e.timestamp.toLocaleTimeString('pt-BR');
      const req = e.startedAt ? e.startedAt.toLocaleTimeString('pt-BR') : null;
      const dur = e.durationMs !== undefined ? `${(e.durationMs / 1000).toFixed(2)}s` : null;
      const timingStr = req && dur ? ` | req: ${req} → ret: ${ts} (${dur})` : dur ? ` | duração: ${dur}` : '';
      const line = `[${ts}] [${e.level.toUpperCase()}] [${e.component}] ${e.message}${timingStr}`;
      return e.data ? `${line}\n  ${e.data.replace(/\n/g, '\n  ')}` : line;
    })
    .join('\n');
}
