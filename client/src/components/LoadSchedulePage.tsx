import React, { useState, useCallback } from 'react';
import { Radio, ArrowLeft } from 'lucide-react';
import { FileUploader } from './FileUploader';
import { ColumnMapper } from './ColumnMapper';
import { useFileParser } from '../hooks/useFileParser';
import { useGoogleSheets } from '../hooks/useGoogleSheets';
import { useScheduleStore } from '../store/scheduleStore';
import { useSocket } from '../hooks/useSocket';
import type { ColumnMapping, ScheduleItem } from '@program-timer/shared';

interface Props {
  isGoogleAuthed: boolean;
  onGoogleAuth: () => void;
  onBack?: () => void;
  backLabel?: string;
  onScheduleLoaded?: (items: ScheduleItem[]) => void;
}

export function LoadSchedulePage({ isGoogleAuthed, onGoogleAuth, onBack, backLabel = '← Back', onScheduleLoaded }: Props) {
  const {
    parseResult, error: parseError, loading,
    parseFile, parseFromData, reset,
    headerRowIdx, setHeaderRow, totalRows, rawPreview,
  } = useFileParser();
  const { fetchSheet, syncError } = useGoogleSheets();
  const setItems        = useScheduleStore(s => s.setItems);
  const setColumnMapping = useScheduleStore(s => s.setColumnMapping);
  const setSpreadsheetId = useScheduleStore(s => s.setSpreadsheetId);
  const { sendSchedule } = useSocket();
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError]     = useState<string | null>(null);

  const handleSheetUrl = useCallback(async (spreadsheetId: string) => {
    setSheetLoading(true); setSheetError(null);
    try {
      const data = await fetchSheet(spreadsheetId);
      parseFromData(data.headers, data.rows as Record<string, string | number | null>[]);
      setSpreadsheetId(spreadsheetId);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : String(e));
    } finally { setSheetLoading(false); }
  }, [fetchSheet, parseFromData, setSpreadsheetId]);

  const handleConfirm = useCallback((mapping: ColumnMapping[], items: ScheduleItem[]) => {
    setColumnMapping(mapping);
    setItems(items);
    sendSchedule(items);
    onScheduleLoaded?.(items);
  }, [setColumnMapping, setItems, sendSchedule, onScheduleLoaded]);

  return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-warm-600 hover:text-warm-400
              transition-colors mb-5">
            <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
          </button>
        )}

        <div className="text-center mb-7">
          <Radio className="w-6 h-6 text-crimson-400 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-warm-100">Load Schedule</h1>
          <p className="text-xs text-warm-600 mt-1">Upload or connect your run-of-show spreadsheet</p>
        </div>

        <div className="bg-warm-900/70 border border-warm-800/60 rounded-xl p-6">
          {parseResult ? (
            <>
              <p className="text-xs text-warm-500 mb-4">
                {parseResult.rows.length} rows detected — confirm column assignments
              </p>
              <ColumnMapper
                key={headerRowIdx}
                parseResult={parseResult}
                onConfirm={handleConfirm}
                onBack={reset}
                headerRowIdx={headerRowIdx}
                totalRows={totalRows}
                rawPreview={rawPreview}
                onHeaderRowChange={setHeaderRow}
              />
            </>
          ) : (
            <>
              <FileUploader
                onFile={parseFile}
                onSheetUrl={handleSheetUrl}
                isGoogleAuthed={isGoogleAuthed}
                onGoogleAuth={onGoogleAuth}
                loading={loading || sheetLoading}
              />
              {(parseError || sheetError) && (
                <p className="mt-4 text-xs text-crimson-300">{parseError ?? sheetError}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
