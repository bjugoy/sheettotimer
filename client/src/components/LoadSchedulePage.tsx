import React, { useState, useCallback } from 'react';
import { Radio, ArrowLeft } from 'lucide-react';
import { cn } from '../utils/timeUtils';
import { FileUploader } from './FileUploader';
import { ColumnMapper } from './ColumnMapper';
import { useFileParser } from '../hooks/useFileParser';
import { useGoogleSheets } from '../hooks/useGoogleSheets';
import { useScheduleStore } from '../store/scheduleStore';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { getPlanFeatures } from '../lib/plans';
import type { ColumnMapping, ScheduleItem } from '@program-timer/shared';

interface Props {
  isGoogleAuthed: boolean;
  onGoogleAuth: () => void;
  canUseGoogleSheets?: boolean;
  onBack?: () => void;
  backLabel?: string;
  onScheduleLoaded?: (items: ScheduleItem[]) => void;
}

export function LoadSchedulePage({ isGoogleAuthed, onGoogleAuth, canUseGoogleSheets = false, onBack, backLabel = '← Back', onScheduleLoaded }: Props) {
  const {
    parseResult, error: parseError, loading,
    parseFile, parseFromData, reset,
    headerRowIdx, setHeaderRow, totalRows, rawPreview,
    sheetNames, currentSheet, switchSheet,
  } = useFileParser();
  const plan                = useAuthStore(s => s.plan);
  const { canUseCustomColumns } = getPlanFeatures(plan);

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
              {/* Sheet picker — only when the workbook has more than one sheet */}
              {sheetNames.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap mb-4 p-3
                  bg-warm-800/30 border border-warm-700/40 rounded-lg">
                  <span className="text-[10px] text-warm-500 uppercase tracking-wider shrink-0">
                    Sheet:
                  </span>
                  {sheetNames.map(name => (
                    <button
                      key={name}
                      onClick={() => switchSheet(name)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                        name === currentSheet
                          ? 'bg-crimson-800/60 border-crimson-700/50 text-warm-100'
                          : 'bg-warm-800/40 border-warm-700/40 text-warm-400 hover:text-warm-200 hover:border-warm-600/60',
                      )}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-warm-500 mb-4">
                {parseResult.rows.length} rows detected — confirm column assignments
              </p>
              <ColumnMapper
                key={headerRowIdx}
                parseResult={parseResult}
                onConfirm={handleConfirm}
                onBack={reset}
                canUseCustomColumns={canUseCustomColumns}
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
                canUseGoogleSheets={canUseGoogleSheets}
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
