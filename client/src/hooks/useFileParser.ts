import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { ParseResult, RawRow } from '@program-timer/shared';
import { detectColumnMapping } from '@program-timer/shared';

export function useFileParser() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parseFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: 'array',
        // raw: true preserves numeric serials for time/date cells so the parser
        // can distinguish a time serial (0–1) from a date serial (≥1).
        // User-typed strings like "9:00" still come through as strings.
        cellDates: false,
        raw: true,
      });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to array of arrays first to handle merged cells
      const aoa: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: true,
      });

      if (aoa.length < 2) {
        throw new Error('Sheet appears to be empty or has no data rows');
      }

      // Find the first non-empty row as headers
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(5, aoa.length); i++) {
        if (aoa[i].some(cell => cell !== null && cell !== '')) {
          headerRowIdx = i;
          break;
        }
      }

      const rawHeaders = aoa[headerRowIdx] as (string | null)[];
      const headers = rawHeaders.map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));

      const rows: RawRow[] = aoa
        .slice(headerRowIdx + 1)
        .filter(row => row.some(c => c !== null && c !== ''))
        .map(row => {
          const obj: RawRow = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] ?? null;
          });
          return obj;
        });

      const suggestedMapping = detectColumnMapping(headers, rows);
      const warnings: string[] = [];
      if (suggestedMapping.filter(m => m.role !== 'ignore').length < 2) {
        warnings.push('Could not auto-detect columns — please assign them manually below.');
      }

      setParseResult({ rows, suggestedMapping, headers, warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, []);

  const parseFromData = useCallback((
    headers: string[],
    rows: RawRow[]
  ) => {
    const suggestedMapping = detectColumnMapping(headers, rows);
    setParseResult({ rows, suggestedMapping, headers, warnings: [] });
  }, []);

  const reset = useCallback(() => {
    setParseResult(null);
    setError(null);
  }, []);

  return { parseResult, error, loading, parseFile, parseFromData, reset };
}
