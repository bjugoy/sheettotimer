import React, { useCallback, useRef, useState } from 'react';
import { Upload, Link, FileSpreadsheet } from 'lucide-react';
import { extractSheetId } from '../utils/timeUtils';

interface Props {
  onFile: (file: File) => void;
  onSheetUrl: (spreadsheetId: string) => void;
  isGoogleAuthed: boolean;
  onGoogleAuth: () => void;
  loading?: boolean;
}

export function FileUploader({ onFile, onSheetUrl, isGoogleAuthed, onGoogleAuth, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleUrlSubmit = () => {
    const id = extractSheetId(urlInput.trim());
    if (!id) {
      setUrlError('Could not find a spreadsheet ID in that URL. Make sure it\'s a Google Sheets link.');
      return;
    }
    setUrlError('');
    onSheetUrl(id);
  };

  return (
    <div className="space-y-6">
      {/* Drag-and-drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${dragging
            ? 'border-blue-400 bg-blue-950/40'
            : 'border-gray-600 hover:border-gray-400 bg-gray-900/40 hover:bg-gray-900/60'
          }
          ${loading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.ods,.csv"
          onChange={handleFile}
          className="sr-only"
        />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet className="w-10 h-10 text-gray-400" />
          )}
          <div>
            <p className="text-lg font-semibold text-gray-200">
              {loading ? 'Parsing...' : 'Drop your spreadsheet here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Supports .xlsx and .ods — or click to browse
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-gray-500 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* Google Sheets URL */}
      <div className="space-y-3">
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <Link className="w-4 h-4" />
          Connect a Google Sheet
        </p>

        {isGoogleAuthed ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200
                placeholder-gray-600 focus:outline-none focus:border-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Load
            </button>
          </div>
        ) : (
          <button
            onClick={onGoogleAuth}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700
              border border-gray-600 hover:border-gray-400 rounded-lg text-sm font-medium transition-colors"
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        )}

        {urlError && (
          <p className="text-sm text-red-400">{urlError}</p>
        )}
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
