import React, { useCallback, useRef, useState } from 'react';
import { Upload, Link, FileSpreadsheet, Clock, AlignLeft, Timer, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { extractSheetId } from '../utils/timeUtils';
import { cn } from '../utils/timeUtils';

interface Props {
  onFile: (file: File) => void;
  onSheetUrl: (spreadsheetId: string) => void;
  isGoogleAuthed: boolean;
  onGoogleAuth: () => void;
  loading?: boolean;
}

const REQUIRED = [
  { icon: <Clock className="w-3.5 h-3.5" />, label: 'Start time', detail: '9:00 · 9:00 AM · 09:00', color: 'text-crimson-400' },
  { icon: <AlignLeft className="w-3.5 h-3.5" />, label: 'Item / title', detail: 'Any text column', color: 'text-amber-400' },
];

const OPTIONAL = [
  { icon: <Clock className="w-3.5 h-3.5" />, label: 'End time', detail: '10:30 · 10:30 AM', color: 'text-warm-500' },
  { icon: <Timer className="w-3.5 h-3.5" />, label: 'Duration', detail: '30 · 30 min · 1:30', color: 'text-warm-500' },
  { icon: <FileText className="w-3.5 h-3.5" />, label: 'Notes / script', detail: 'Speaker copy, cues', color: 'text-warm-500' },
];

export function FileUploader({ onFile, onSheetUrl, isGoogleAuthed, onGoogleAuth, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [tipsOpen, setTipsOpen] = useState(true);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleUrlSubmit = () => {
    const id = extractSheetId(urlInput.trim());
    if (!id) { setUrlError("Couldn't find a spreadsheet ID — paste the full Google Sheets URL."); return; }
    setUrlError('');
    onSheetUrl(id);
  };

  return (
    <div className="space-y-5">

      {/* ── Sheet format guide ─────────────────────────────────────────────── */}
      <div className="border border-warm-800/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setTipsOpen(t => !t)}
          className="w-full flex items-center justify-between px-4 py-3
            bg-warm-800/40 hover:bg-warm-800/60 transition-colors text-left">
          <span className="text-xs font-semibold text-warm-400 uppercase tracking-wider">
            How to format your spreadsheet
          </span>
          {tipsOpen
            ? <ChevronUp className="w-4 h-4 text-warm-600" />
            : <ChevronDown className="w-4 h-4 text-warm-600" />}
        </button>

        {tipsOpen && (
          <div className="px-4 py-4 bg-warm-900/40 space-y-4">

            {/* Required */}
            <div>
              <p className="text-[10px] text-warm-600 uppercase tracking-wider mb-2">Required columns</p>
              <div className="grid grid-cols-2 gap-2">
                {REQUIRED.map(r => (
                  <div key={r.label} className="flex items-start gap-2.5 bg-warm-800/40
                    border border-warm-700/40 rounded-lg px-3 py-2.5">
                    <span className={cn('mt-0.5', r.color)}>{r.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-warm-200">{r.label}</p>
                      <p className="text-[10px] text-warm-600 mt-0.5">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional */}
            <div>
              <p className="text-[10px] text-warm-600 uppercase tracking-wider mb-2">Optional columns</p>
              <div className="grid grid-cols-3 gap-2">
                {OPTIONAL.map(r => (
                  <div key={r.label} className="flex items-start gap-2 bg-warm-800/20
                    border border-warm-800/40 rounded-lg px-3 py-2.5">
                    <span className={cn('mt-0.5', r.color)}>{r.icon}</span>
                    <div>
                      <p className="text-xs text-warm-400">{r.label}</p>
                      <p className="text-[10px] text-warm-700 mt-0.5">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="text-[11px] text-warm-600 space-y-1 border-t border-warm-800/40 pt-3">
              <p>• First row must be <span className="text-warm-400">column headers</span></p>
              <p>• Time ranges in one cell work: <span className="text-warm-400">9:00–10:00</span> or <span className="text-warm-400">9:00 AM–10:00 AM</span></p>
              <p>• Rows without a time value (section headers, blank rows) are skipped automatically</p>
              <p>• Supported formats: <span className="text-warm-400">.xlsx · .ods · .csv · Google Sheets</span></p>
            </div>
          </div>
        )}
      </div>

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          dragging
            ? 'border-crimson-600/70 bg-crimson-950/30'
            : 'border-warm-700/50 hover:border-warm-600/70 bg-warm-900/30 hover:bg-warm-900/50',
          loading && 'pointer-events-none opacity-50'
        )}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.ods,.csv" onChange={handleFile} className="sr-only" />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <div className="w-9 h-9 border-2 border-crimson-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet className={cn('w-9 h-9', dragging ? 'text-crimson-400' : 'text-warm-600')} />
          )}
          <div>
            <p className="text-base font-semibold text-warm-200">
              {loading ? 'Parsing…' : 'Drop your spreadsheet here'}
            </p>
            <p className="text-xs text-warm-600 mt-1">
              .xlsx · .ods · .csv — or <span className="text-warm-400 underline underline-offset-2">click to browse</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-warm-800/60" />
        <span className="text-warm-700 text-xs">or</span>
        <div className="flex-1 h-px bg-warm-800/60" />
      </div>

      {/* ── Google Sheets ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <p className="text-xs text-warm-500 flex items-center gap-2">
          <Link className="w-3.5 h-3.5" /> Connect a Google Sheet
        </p>

        {isGoogleAuthed ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="flex-1 bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2
                text-sm text-warm-200 placeholder-warm-700 focus:outline-none
                focus:border-crimson-700/60 transition-colors"
              onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            />
            <button onClick={handleUrlSubmit} disabled={!urlInput.trim()}
              className="px-4 py-2 bg-crimson-800/60 hover:bg-crimson-700/60
                disabled:opacity-40 disabled:cursor-not-allowed border border-crimson-700/50
                rounded-lg text-sm font-medium text-warm-100 transition-colors">
              Load
            </button>
          </div>
        ) : (
          <button onClick={onGoogleAuth}
            className="flex items-center gap-2 px-4 py-2 bg-warm-800/60 hover:bg-warm-700/60
              border border-warm-700/50 hover:border-warm-600/60 rounded-lg text-sm
              font-medium text-warm-300 transition-colors">
            <GoogleIcon />
            Sign in with Google
          </button>
        )}

        {urlError && <p className="text-xs text-crimson-300">{urlError}</p>}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
