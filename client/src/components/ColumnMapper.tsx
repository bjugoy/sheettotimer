import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ParseResult, ColumnMapping, ColumnRole } from '@program-timer/shared';
import { rowsToSchedule } from '@program-timer/shared';

interface Props {
  parseResult: ParseResult;
  onConfirm: (mapping: ColumnMapping[], items: ReturnType<typeof rowsToSchedule>['items']) => void;
  onBack: () => void;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  startTime: 'Start Time',
  endTime: 'End Time',
  duration: 'Duration',
  title: 'Title / Item Name',
  notes: 'Speaker Notes',
  ignore: 'Ignore',
};

const ROLE_OPTIONS: ColumnRole[] = ['startTime', 'endTime', 'duration', 'title', 'notes', 'ignore'];

const ROLE_COLORS: Partial<Record<ColumnRole, string>> = {
  startTime: 'text-green-400',
  endTime: 'text-blue-400',
  duration: 'text-purple-400',
  title: 'text-yellow-400',
  notes: 'text-orange-400',
};

export function ColumnMapper({ parseResult, onConfirm, onBack }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping[]>(parseResult.suggestedMapping);

  const setRole = (sourceKey: string, role: ColumnRole) => {
    setMapping(prev => prev.map(m => m.sourceKey === sourceKey ? { ...m, role } : m));
  };

  const preview = parseResult.rows.slice(0, 5);

  const handleConfirm = () => {
    const { items, warnings } = rowsToSchedule(parseResult.rows, mapping);
    if (items.length === 0) {
      alert('No valid schedule items could be parsed with this mapping. Check your column assignments.');
      return;
    }
    onConfirm(mapping, items);
  };

  const hasTitle = mapping.some(m => m.role === 'title');
  const hasStart = mapping.some(m => m.role === 'startTime');
  const canConfirm = hasTitle && hasStart;

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {parseResult.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-yellow-400 bg-yellow-950/30 border border-yellow-800 rounded-lg p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {w}
        </div>
      ))}

      <p className="text-gray-400 text-sm">
        Review the detected column assignments below. At minimum, assign a <span className="text-yellow-400">Title</span> and a <span className="text-green-400">Start Time</span>.
      </p>

      {/* Column assignment table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-400 font-medium">Column</th>
              <th className="text-left py-2 pr-4 text-gray-400 font-medium">Assign as</th>
              <th className="text-left py-2 text-gray-400 font-medium">Sample values</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map(({ sourceKey, role }) => (
              <tr key={sourceKey} className="border-b border-gray-800">
                <td className="py-2 pr-4 text-gray-300 font-medium whitespace-nowrap">
                  {sourceKey}
                </td>
                <td className="py-2 pr-4">
                  <select
                    value={role}
                    onChange={e => setRole(sourceKey, e.target.value as ColumnRole)}
                    className={`bg-gray-800 border border-gray-600 rounded px-2 py-1
                      focus:outline-none focus:border-blue-500 text-sm
                      ${ROLE_COLORS[role] ?? 'text-gray-400'}`}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r} className="text-gray-200 bg-gray-800">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-gray-500 text-xs">
                  {preview
                    .map(r => r[sourceKey])
                    .filter(v => v !== null && v !== undefined && v !== '')
                    .slice(0, 3)
                    .join('  ·  ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validation feedback */}
      {!canConfirm && (
        <p className="text-sm text-red-400">
          {!hasTitle ? '⚠ Assign at least one column as "Title / Item Name"' : ''}
          {!hasStart ? '  ⚠ Assign at least one column as "Start Time"' : ''}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500
            disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Confirm & Load Schedule
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
