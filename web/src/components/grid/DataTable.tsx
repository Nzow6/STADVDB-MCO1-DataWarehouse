import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Hash,
  Type,
  Calendar,
  Clock,
} from 'lucide-react';
import { ColumnDataType, QueryResult } from '../../types/olap';
import { PaginationBar } from './PaginationBar';

interface DataTableProps {
  result: QueryResult | null;
  loading: boolean;
}

type SortDirection = 'ASC' | 'DESC' | null;

export const DataTable: React.FC<DataTableProps> = ({ result, loading }) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      if (sortDirection === 'ASC') setSortDirection('DESC');
      else if (sortDirection === 'DESC') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(colName);
      setSortDirection('ASC');
    }
    setPage(1);
  };

  const sortedRows = useMemo(() => {
    if (!result?.rows) return [];
    if (!sortColumn || !sortDirection) return result.rows;

    return [...result.rows].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'ASC' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'ASC' ? -1 : 1;
      if (strA > strB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [result?.rows, sortColumn, sortDirection]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const copyCell = (val: any, cellKey: string) => {
    const textToCopy = val === null || val === undefined ? 'NULL' : String(val);
    navigator.clipboard.writeText(textToCopy);
    setCopiedCell(cellKey);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const getColIcon = (type: ColumnDataType) => {
    switch (type) {
      case 'INTEGER':
      case 'NUMERIC':
      case 'DOUBLE':
        return <Hash className="w-3 h-3 text-emerald-700" />;
      case 'TIMESTAMP':
        return <Calendar className="w-3 h-3 text-slate-600" />;
      case 'TIME':
        return <Clock className="w-3 h-3 text-slate-600" />;
      default:
        return <Type className="w-3 h-3 text-slate-500" />;
    }
  };

  const isNumeric = (type: ColumnDataType) => {
    return ['INTEGER', 'NUMERIC', 'DOUBLE'].includes(type);
  };

  const isNonGroupingColumn = (colName?: string): boolean => {
    if (!colName) return false;
    const col = colName.toLowerCase().replace(/[\s_-]+/g, '');

    // Year check: e.g. year, pickupdateyear, dropoffyear
    if (col.includes('year')) return true;

    // Calendar units
    if (
      col === 'month' ||
      col === 'day' ||
      col === 'quarter' ||
      col === 'hour' ||
      col === 'minute' ||
      col === 'second' ||
      col === 'week' ||
      col === 'dayofweek' ||
      col === 'daybracket'
    ) {
      return true;
    }

    // Boolean / binary flags
    if (col.startsWith('is') || col.startsWith('has') || col.includes('flag')) {
      return true;
    }

    // IDs, keys, codes (e.g. date_id, location_id, trip_id, vendor_id, payment_type_id, zip_code)
    if (col.endsWith('id') || col === 'id' || col.endsWith('key') || col.includes('code')) {
      return true;
    }

    // Ranks, row numbers, positions (e.g. revenue_rank, borough_tip_rank, rank, rownum)
    if (col.includes('rank') || col.includes('rownum') || col === 'row' || col === 'step') {
      return true;
    }

    return false;
  };

  const formatCellValue = (val: any, type: ColumnDataType, colName?: string) => {
    if (val === null || val === undefined) {
      return (
        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
          NULL
        </span>
      );
    }

    // Check if value is numeric (number, bigint, or valid numeric string for numeric columns)
    let numVal: number | null = null;
    if (typeof val === 'number') {
      numVal = val;
    } else if (typeof val === 'bigint') {
      numVal = Number(val);
    } else if (typeof val === 'string' && isNumeric(type) && !isNaN(Number(val)) && val.trim() !== '') {
      numVal = Number(val);
    }

    if (numVal !== null) {
      // Inappropriate for thousands separators: year, month, day, quarter, ids, ranks, flags
      if (isNonGroupingColumn(colName)) {
        return String(numVal);
      }

      // Appropriate for comma separation:
      // 1. Rates / Ratios (e.g. avg_tip_rate) - check before currency to prevent 'tip' matching 'avg_tip_rate'
      const isRate = /rate|ratio|pct|percent/i.test(colName || '');
      if (isRate) {
        return numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      }

      // 2. Currency, revenue, cost, fare, tip amounts, surcharge, earnings
      const isCurrencyOrAmount = /revenue|cost|fare|amount|tip|earning|surcharge|tolls|fee|tax|price/i.test(colName || '');
      if (isCurrencyOrAmount) {
        return numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      // 3. Other floating point / double values (e.g. avg_dist)
      if (type === 'NUMERIC' || type === 'DOUBLE' || !Number.isInteger(numVal)) {
        return numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      }

      // 4. Integer counts/volumes/trips
      return numVal.toLocaleString();
    }

    return String(val);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-500 select-none">
        <div className="w-6 h-6 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mb-2" />
        <span className="font-mono text-xs text-slate-700">Executing OLAP query in DuckDB-Wasm worker...</span>
      </div>
    );
  }

  if (!result || !result.rows || result.rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-400 select-none font-mono text-xs">
        <div className="p-3 rounded-full bg-slate-100 border border-slate-200 mb-2">
          <Hash className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-slate-700 font-semibold mb-1">No Results to Display</p>
        <p className="text-slate-500 text-[11px]">Select parameters and click "Run Query" or adjust filters</p>
      </div>
    );
  }

  const columns = result.columns;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden select-none">
      {/* Scrollable Grid Table */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-left font-mono text-xs">
          {/* Sticky Header */}
          <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 shadow-xs">
            <tr>
              {/* Row Number Header */}
              <th className="w-12 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500 uppercase border-r border-slate-200 bg-slate-100">
                #
              </th>

              {columns.map((col) => {
                const numeric = isNumeric(col.type);
                const isSorted = sortColumn === col.name;

                return (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className={`px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-800 border-r border-slate-200 hover:bg-slate-200/80 cursor-pointer select-none transition ${
                      numeric ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        numeric ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span className="opacity-80 flex-shrink-0">{getColIcon(col.type)}</span>
                      <span className="truncate">{col.name}</span>

                      {/* Sort indicator */}
                      <span className="ml-1 text-slate-500">
                        {isSorted ? (
                          sortDirection === 'ASC' ? (
                            <ArrowUp className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-emerald-700" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30 hover:opacity-100" />
                        )}
                      </span>

                      {/* Column type badge */}
                      <span className="text-[9px] font-mono text-slate-500 font-normal ml-0.5 opacity-70">
                        {col.type}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200">
            {paginatedRows.map((row, rowIdx) => {
              const actualRowIndex = (page - 1) * pageSize + rowIdx + 1;
              const isEven = rowIdx % 2 === 0;

              return (
                <tr
                  key={rowIdx}
                  className={`hover:bg-emerald-50/50 transition-colors ${
                    isEven ? 'bg-white' : 'bg-slate-50/60'
                  }`}
                >
                  {/* Row Index */}
                  <td className="w-12 px-2 py-1 text-center text-[10px] text-slate-400 font-mono border-r border-slate-200 select-none">
                    {actualRowIndex}
                  </td>

                  {columns.map((col) => {
                    const val = row[col.name];
                    const numeric = isNumeric(col.type);
                    const cellKey = `${rowIdx}-${col.name}`;
                    const wasCopied = copiedCell === cellKey;

                    return (
                      <td
                        key={col.name}
                        onClick={() => copyCell(val, cellKey)}
                        className={`px-3 py-1.5 border-r border-slate-200 truncate cursor-pointer hover:bg-slate-100/60 transition select-text ${
                          numeric
                            ? 'text-right font-mono tabular-nums text-slate-900 font-medium'
                            : 'text-left text-slate-800'
                        }`}
                        title="Click to copy cell value"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`w-full ${numeric ? 'text-right' : 'text-left'}`}>
                            {formatCellValue(val, col.type, col.name)}
                          </span>
                          {wasCopied && (
                            <span className="text-[9px] text-emerald-700 font-mono flex-shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grid Footer Pagination */}
      <PaginationBar
        totalRows={sortedRows.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />
    </div>
  );
};
