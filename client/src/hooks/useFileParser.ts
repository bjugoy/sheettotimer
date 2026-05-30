import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { ParseResult, RawRow } from '@program-timer/shared';
import { detectColumnMapping, detectHeaderRow } from '@program-timer/shared';

// How many raw rows to surface for the row-picker preview
const PREVIEW_ROWS = 20;

export function useFileParser() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);

  // Raw AOA stored so we can re-derive without re-reading the file
  const aoaRef = useRef<(string | number | null)[][]>([]);

  // ── derive headers + rows + mapping from a given header row index ──────────
  const deriveFromAoa = useCallback((
    aoa: (string | number | null)[][],
    rowIdx: number,
  ) => {
    const rawHeaders = aoa[rowIdx] as (string | null)[];
    const headers = rawHeaders.map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));

    const rows: RawRow[] = aoa
      .slice(rowIdx + 1)
      .filter(row => row.some(c => c !== null && c !== ''))
      .map(row => {
        const obj: RawRow = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? null; });
        return obj;
      });

    const suggestedMapping = detectColumnMapping(headers, rows);
    const warnings: string[] = [];
    if (suggestedMapping.filter(m => m.role !== 'ignore').length < 2) {
      warnings.push('Could not auto-detect columns — please assign them manually below.');
    }

    setParseResult({ rows, suggestedMapping, headers, warnings });
  }, []);

  // ── parse a file for the first time ───────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const aoa: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: true,
      });

      if (aoa.length < 2) throw new Error('Sheet appears to be empty or has no data rows');

      aoaRef.current = aoa;

      const detected = detectHeaderRow(aoa);
      setHeaderRowIdx(detected);
      deriveFromAoa(aoa, detected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, [deriveFromAoa]);

  // ── change the header row (user override) ─────────────────────────────────
  const setHeaderRow = useCallback((idx: number) => {
    const aoa = aoaRef.current;
    if (!aoa.length) return;
    const clamped = Math.max(0, Math.min(idx, aoa.length - 2));
    setHeaderRowIdx(clamped);
    deriveFromAoa(aoa, clamped);
  }, [deriveFromAoa]);

  // ── direct data path (Google Sheets) ──────────────────────────────────────
  const parseFromData = useCallback((headers: string[], rows: RawRow[]) => {
    aoaRef.current = [];
    setHeaderRowIdx(0);
    const suggestedMapping = detectColumnMapping(headers, rows);
    setParseResult({ rows, suggestedMapping, headers, warnings: [] });
  }, []);

  const reset = useCallback(() => {
    setParseResult(null);
    setError(null);
    aoaRef.current = [];
    setHeaderRowIdx(0);
  }, []);

  return {
    parseResult,
    error,
    loading,
    parseFile,
    parseFromData,
    reset,
    // Row picker support
    headerRowIdx,
    setHeaderRow,
    totalRows:  aoaRef.current.length,
    rawPreview: aoaRef.current.slice(0, PREVIEW_ROWS) as (string | number | null)[][],
  };
}
