import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Copy, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { subscribeLog, clearLogs, exportLogsAsText, LogEntry, LogLevel } from '../utils/logger';

function fmtTime(d: Date) { return d.toLocaleTimeString('pt-BR'); }
function fmtDur(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface Props { isTI: boolean; }

const BORDER: Record<LogLevel, string> = {
  error: 'border-l-red-500',
  warn:  'border-l-yellow-400',
  info:  'border-l-gray-600',
};

const ROW_BG: Record<LogLevel, string> = {
  error: 'bg-red-950/40',
  warn:  'bg-yellow-950/30',
  info:  'bg-transparent',
};

const BADGE: Record<LogLevel, string> = {
  error: 'bg-red-600 text-white',
  warn:  'bg-yellow-400 text-yellow-900',
  info:  'bg-gray-600 text-gray-200',
};

export default function LogViewer({ isTI }: Props) {
  const [open, setOpen]       = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter]   = useState<LogLevel | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied]   = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeLog(setEntries), []);

  useEffect(() => {
    if (!isTI) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTI]);

  const errorCount = entries.filter((e) => e.level === 'error').length;
  const warnCount  = entries.filter((e) => e.level === 'warn').length;
  const infoCount  = entries.filter((e) => e.level === 'info').length;
  const alertCount = errorCount + warnCount;

  const visible = filter === 'all' ? entries : entries.filter((e) => e.level === filter);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportLogsAsText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* Botão flutuante — visível apenas para TI */}
      {isTI && <button
        onClick={() => setOpen((o) => !o)}
        title="Log do Sistema (Ctrl+Shift+L)"
        className="fixed bottom-4 right-4 z-[9998] w-10 h-10 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
        style={{ opacity: open ? 1 : 0.65 }}
      >
        <Terminal size={17} />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </button>}

      {/* Painel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[9999] w-[640px] max-w-[96vw] h-[72vh] bg-gray-950 text-gray-100 rounded-xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-gray-400" />
              <span className="font-bold text-sm">Log do Sistema</span>
              <span className="text-[11px] text-gray-500 font-mono">{entries.length} entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                <Copy size={11} /> {copied ? 'Copiado!' : 'Copiar tudo'}
              </button>
              <button
                onClick={clearLogs}
                className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-red-800 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} /> Limpar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white ml-1 p-0.5 rounded transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
            {([
              ['all',   `Todos (${entries.length})`],
              ['error', `Erros (${errorCount})`],
              ['warn',  `Avisos (${warnCount})`],
              ['info',  `Info (${infoCount})`],
            ] as const).map(([lvl, label]) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                  filter === lvl
                    ? lvl === 'error' ? 'bg-red-700 text-white'
                    : lvl === 'warn'  ? 'bg-yellow-500 text-black'
                    : 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div ref={listRef} className="flex-1 overflow-y-auto font-mono text-[11px]">
            {visible.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-600">
                Nenhum log encontrado
              </div>
            ) : (
              visible.map((entry) => (
                <div
                  key={entry.id}
                  className={`border-l-4 ${BORDER[entry.level]} ${ROW_BG[entry.level]} px-3 py-1.5 border-b border-gray-800/60`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${BADGE[entry.level]}`}>
                      {entry.level}
                    </span>
                    <span className="shrink-0 text-gray-500">
                      {fmtTime(entry.timestamp)}
                    </span>
                    <span className="shrink-0 text-blue-400">[{entry.component}]</span>
                    <span className="flex-1 break-all text-gray-200">{entry.message}</span>
                    {entry.data && (
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="shrink-0 text-gray-500 hover:text-gray-300 mt-0.5"
                      >
                        {expanded.has(entry.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                  {(entry.startedAt || entry.durationMs !== undefined) && (
                    <div className="flex items-center gap-2 ml-[3.5rem] mt-0.5 text-[10px]">
                      {entry.startedAt && (
                        <span className="text-gray-500">
                          req: <span className="text-cyan-400">{fmtTime(entry.startedAt)}</span>
                          {' → '}
                          ret: <span className="text-cyan-400">{fmtTime(entry.timestamp)}</span>
                        </span>
                      )}
                      {entry.durationMs !== undefined && (
                        <span className={`font-bold ${entry.durationMs > 5000 ? 'text-yellow-400' : entry.durationMs > 10000 ? 'text-red-400' : 'text-green-400'}`}>
                          ⏱ {fmtDur(entry.durationMs)}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.data && expanded.has(entry.id) && (
                    <pre className="mt-1 ml-6 text-yellow-300 whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                      {entry.data}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          <div className="px-4 py-1.5 bg-gray-900 border-t border-gray-800 flex-shrink-0 text-[10px] text-gray-600">
            Ctrl+Shift+L para abrir/fechar · Máximo 300 entradas · Persiste no localStorage
          </div>
        </div>
      )}
    </>
  );
}
