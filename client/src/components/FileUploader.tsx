import React, { useCallback, useRef, useState } from 'react';
import { Link, FileSpreadsheet, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { extractSheetId, cn } from '../utils/timeUtils';

interface Props {
  onFile: (file: File) => void;
  onSheetUrl: (spreadsheetId: string) => void;
  isGoogleAuthed: boolean;
  onGoogleAuth: () => void;
  onGoogleDisconnect: () => void;
  canUseGoogleSheets?: boolean;
  loading?: boolean;
}

export function FileUploader({ onFile, onSheetUrl, isGoogleAuthed, onGoogleAuth, onGoogleDisconnect, canUseGoogleSheets = false, loading }: Props) {
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

      {/* ── Format guide ──────────────────────────────────────────────────── */}
      <div className="border border-warm-800/60 rounded-xl overflow-hidden">
        <button onClick={() => setTipsOpen(t => !t)}
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
              <p className="text-[10px] font-bold text-crimson-400 uppercase tracking-wider mb-3">
                Required — pick one of these layouts
              </p>

              <div className="space-y-3">

                {/* Option A — range in one cell */}
                <div className="rounded-lg border border-warm-700/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-crimson-950/60 border-b border-warm-700/50">
                    <span className="text-[10px] font-bold text-crimson-300 uppercase tracking-wider">Option A</span>
                    <span className="text-[11px] text-warm-400">— time range in one cell</span>
                  </div>
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="bg-warm-800/60">
                        <th className="text-left px-3 py-1.5 text-warm-400 font-semibold border-r border-warm-700/40">Item</th>
                        <th className="text-left px-3 py-1.5 text-crimson-300 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-warm-900/40">
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Opening remarks</td>
                        <td className="px-3 py-1.5 text-warm-200">9:00 – 9:15</td>
                      </tr>
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Keynote</td>
                        <td className="px-3 py-1.5 text-warm-200">9:15 – 10:00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Option B — start + end */}
                <div className="rounded-lg border border-warm-700/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border-b border-warm-700/50">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Option B</span>
                    <span className="text-[11px] text-warm-400">— separate start and end columns</span>
                  </div>
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="bg-warm-800/60">
                        <th className="text-left px-3 py-1.5 text-warm-400 font-semibold border-r border-warm-700/40">Item</th>
                        <th className="text-left px-3 py-1.5 text-amber-300 font-semibold border-r border-warm-700/40">Start</th>
                        <th className="text-left px-3 py-1.5 text-amber-300 font-semibold">End</th>
                      </tr>
                    </thead>
                    <tbody className="bg-warm-900/40">
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Opening remarks</td>
                        <td className="px-3 py-1.5 text-warm-200 border-r border-warm-700/40">9:00</td>
                        <td className="px-3 py-1.5 text-warm-200">9:15</td>
                      </tr>
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Keynote</td>
                        <td className="px-3 py-1.5 text-warm-200 border-r border-warm-700/40">9:15</td>
                        <td className="px-3 py-1.5 text-warm-200">10:00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Option C — start + duration */}
                <div className="rounded-lg border border-warm-700/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-moss-950/40 border-b border-warm-700/50">
                    <span className="text-[10px] font-bold text-moss-300 uppercase tracking-wider">Option C</span>
                    <span className="text-[11px] text-warm-400">— start time + duration</span>
                  </div>
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="bg-warm-800/60">
                        <th className="text-left px-3 py-1.5 text-warm-400 font-semibold border-r border-warm-700/40">Item</th>
                        <th className="text-left px-3 py-1.5 text-moss-300 font-semibold border-r border-warm-700/40">Start</th>
                        <th className="text-left px-3 py-1.5 text-moss-300 font-semibold">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="bg-warm-900/40">
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Opening remarks</td>
                        <td className="px-3 py-1.5 text-warm-200 border-r border-warm-700/40">9:00</td>
                        <td className="px-3 py-1.5 text-warm-200">15min</td>
                      </tr>
                      <tr className="border-t border-warm-800/40">
                        <td className="px-3 py-1.5 text-warm-300 border-r border-warm-700/40">Keynote</td>
                        <td className="px-3 py-1.5 text-warm-200 border-r border-warm-700/40">9:15</td>
                        <td className="px-3 py-1.5 text-warm-200">45min</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="px-3 py-1.5 text-[10px] text-warm-600 bg-warm-900/60 border-t border-warm-800/40">
                    Duration accepts: <span className="text-warm-500">45 · 45min · 1h · 1:30 · 1h 30m</span>
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-warm-600 mt-2">
                The <span className="text-warm-400">column header names don't matter</span> — you'll map them on the next step.
              </p>
            </div>

            {/* Optional */}
            <div>
              <p className="text-[10px] text-warm-600 uppercase tracking-wider mb-2">Optional</p>
              <div className="flex items-center gap-2 bg-warm-800/20 border border-warm-800/40
                rounded-lg px-3 py-2">
                <FileText className="w-3.5 h-3.5 text-warm-600 flex-shrink-0" />
                <p className="text-xs text-warm-500">
                  <span className="text-warm-400">Notes / speaker script</span>
                  <span className="text-warm-700"> — shown in presenter screen</span>
                </p>
              </div>
            </div>

            {/* Tips */}
            <div className="text-[11px] text-warm-600 space-y-1 border-t border-warm-800/40 pt-3">
              <p>• First row must be <span className="text-warm-400">column headers</span></p>
              <p>• Rows without a time value (date headers, blank rows) are skipped automatically</p>
              <p>• Formats: <span className="text-warm-400">.xlsx · .ods · .csv · Google Sheets</span></p>
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
          'relative border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-all',
          dragging
            ? 'border-crimson-500 bg-crimson-950/40 scale-[1.01]'
            : 'border-warm-500/40 hover:border-warm-400/60 bg-warm-800/25 hover:bg-warm-800/40',
          loading && 'pointer-events-none opacity-50'
        )}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.ods,.csv" onChange={handleFile} className="sr-only" />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <div className="w-10 h-10 border-2 border-crimson-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet className={cn('w-10 h-10', dragging ? 'text-crimson-400' : 'text-warm-300')} />
          )}
          <div>
            <p className="text-base font-semibold text-warm-100">
              {loading ? 'Parsing…' : 'Drop your spreadsheet here'}
            </p>
            <p className="text-sm text-warm-400 mt-1">
              or{' '}
              <span className="text-crimson-400 font-medium underline underline-offset-2 hover:text-crimson-300">
                click to browse
              </span>
            </p>
            {!loading && (
              <p className="text-xs text-warm-600 mt-2">.xlsx · .ods · .csv</p>
            )}
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

        {!canUseGoogleSheets ? (
          <p className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/30
            px-3 py-2 rounded-lg">
            Requires Pro or higher — upgrade to connect Google Sheets directly.
          </p>
        ) : isGoogleAuthed ? (
          <div className="space-y-2">
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
            <button
              onClick={onGoogleDisconnect}
              className="text-[11px] text-warm-600 hover:text-warm-400 transition-colors">
              Disconnect Google account
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
