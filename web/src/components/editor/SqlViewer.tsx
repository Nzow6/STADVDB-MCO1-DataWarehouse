import React, { useState } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';

interface SqlViewerProps {
  sql: string;
  compiledSql?: string;
  onChange?: (newSql: string) => void;
  isEditable?: boolean;
}

export const SqlViewer: React.FC<SqlViewerProps> = ({
  sql,
  compiledSql,
  onChange,
  isEditable = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (compiledSql && onChange) {
      onChange(compiledSql);
    }
  };

  const lineCount = (sql || '').split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 6) }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-mono text-xs select-text">
      {/* Editor Toolbar */}
      <div className="h-8 bg-slate-100 border-b border-slate-200 px-3 flex items-center justify-between text-slate-600 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
            {isEditable ? 'SQL Workbench Editor' : 'Compiled OLAP Query'}
          </span>
          <span className="text-[10px] text-emerald-700 font-mono font-medium">
            (DuckDB / ANSI SQL)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {compiledSql && onChange && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] transition"
              title="Reset to automatically compiled SQL"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] transition"
            title="Copy SQL statement to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Copy SQL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Area with Monospace Gutter and Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers Gutter */}
        <div className="w-10 bg-slate-50 border-r border-slate-200 py-2.5 px-1 text-right text-slate-400 select-none font-mono text-[11px] leading-5">
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Text Area / Code Content */}
        <div className="flex-1 overflow-auto p-2.5">
          {isEditable && onChange ? (
            <textarea
              value={sql}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full bg-transparent text-slate-900 font-mono text-[12px] leading-5 resize-none focus:outline-none placeholder-slate-400"
              placeholder="-- Type or execute arbitrary SQL queries against DuckDB-Wasm tables"
            />
          ) : (
            <pre className="text-slate-900 font-mono text-[12px] leading-5 whitespace-pre">
              {sql}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
