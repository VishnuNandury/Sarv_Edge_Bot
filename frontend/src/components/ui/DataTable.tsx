'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  onRowClick,
  keyExtractor,
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === undefined || bv === undefined) return 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (sortDir === 'asc') return as < bs ? -1 : as > bs ? 1 : 0;
    return as > bs ? -1 : as < bs ? 1 : 0;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2d38]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider',
                  col.sortable && 'cursor-pointer select-none hover:text-[#94a3b8]',
                  col.className
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <span className="ml-1">
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-[#2a2d38]" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2028]">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[#475569]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-[#1a1d24]'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-[#94a3b8]', col.className)}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
