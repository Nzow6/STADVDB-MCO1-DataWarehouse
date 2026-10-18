import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  Layers,
} from 'lucide-react';
import { STAR_SCHEMA_TABLES } from '../../engine/schemaData';
import { SchemaField } from '../../types/olap';
import { FieldBadge } from './FieldBadge';
import { SearchBar } from './SearchBar';

interface SchemaNavigatorProps {
  onAddMeasure: (field: SchemaField) => void;
  onAddDimension: (field: SchemaField) => void;
}

export const SchemaNavigator: React.FC<SchemaNavigatorProps> = ({
  onAddMeasure,
  onAddDimension,
}) => {
  const [search, setSearch] = useState('');
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({
    dim_rate_code: true,
    dim_trip_type: true,
  });

  const toggleTable = (tableId: string) => {
    setCollapsedTables((prev) => ({
      ...prev,
      [tableId]: !prev[tableId],
    }));
  };

  const filteredTables = useMemo(() => {
    if (!search.trim()) return STAR_SCHEMA_TABLES;
    const term = search.toLowerCase();

    return STAR_SCHEMA_TABLES.map((table) => {
      const matchingFields = table.fields.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.displayName.toLowerCase().includes(term) ||
          f.dataType.toLowerCase().includes(term)
      );

      const tableMatches =
        table.name.toLowerCase().includes(term) ||
        table.displayName.toLowerCase().includes(term);

      if (tableMatches) {
        return table;
      }

      return {
        ...table,
        fields: matchingFields,
      };
    }).filter((t) => t.fields.length > 0);
  }, [search]);

  const totalFields = useMemo(() => {
    return filteredTables.reduce((acc, t) => acc + t.fields.length, 0);
  }, [filteredTables]);

  return (
    <div className="h-full flex flex-col text-xs select-none bg-slate-50">
      {/* Navigator Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 tracking-wider text-[11px] uppercase">
          <Layers className="w-3.5 h-3.5 text-emerald-700" />
          <span>Schema & Cubes</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          {STAR_SCHEMA_TABLES.length} Tables
        </span>
      </div>

      {/* Quick Search */}
      <SearchBar
        value={search}
        onChange={setSearch}
        matchCount={totalFields}
        placeholder="Filter dimensions & metrics..."
      />

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-1">
        <div className="px-1.5 py-1 text-[10px] font-semibold text-slate-500 tracking-wider uppercase flex items-center justify-between">
          <span>NYC Green Taxi DW</span>
          <span className="text-[9px] text-emerald-700 font-mono font-medium">STAR SCHEMA</span>
        </div>

        {filteredTables.map((table) => {
          const isCollapsed = Boolean(collapsedTables[table.id]) && !search;
          const isFact = table.type === 'fact';

          return (
            <div key={table.id} className="rounded border border-slate-200 overflow-hidden bg-white shadow-2xs">
              {/* Table Node Header */}
              <button
                onClick={() => toggleTable(table.id)}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 text-left transition"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                  )}
                  <TableIcon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isFact ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  />
                  <span className="text-[11px] font-medium text-slate-800 truncate">
                    {table.displayName || table.name}
                  </span>
                </div>

                <span
                  className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                    isFact
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isFact ? 'FACT' : 'DIM'}
                </span>
              </button>

              {/* Field List */}
              {!isCollapsed && (
                <div className="px-1 py-1 pl-3 bg-white border-t border-slate-100">
                  {table.fields.map((field) => (
                    <FieldBadge
                      key={field.id}
                      field={field}
                      onAddMeasure={onAddMeasure}
                      onAddDimension={onAddDimension}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono flex items-center justify-between bg-white">
        <span>Click field to add to builder</span>
        <span className="text-emerald-700 font-medium">v2021.1</span>
      </div>
    </div>
  );
};
