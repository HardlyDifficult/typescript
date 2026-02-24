"use client";

import { type ReactNode, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely convert an unknown cell value to a display string. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) {return "";}
  if (typeof value === "string") {return value;}
  if (typeof value === "number" || typeof value === "boolean") {return String(value);}
  return JSON.stringify(value);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DataTableColumn {
  key: string;
  header: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  rowKey: string;
  selectable?: boolean;
  emptyMessage?: string;
  onSelectionChange?: (selectedKeys: string[]) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Borderless data table — faint row separators, ghostly hover. */
export function DataTable({
  columns,
  rows,
  rowKey,
  selectable = false,
  emptyMessage = "No data",
  onSelectionChange,
}: DataTableProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  function toggleKey(key: string) {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];
    setSelectedKeys(next);
    onSelectionChange?.(next);
  }

  function toggleAll() {
    if (selectedKeys.length === rows.length) {
      setSelectedKeys([]);
      onSelectionChange?.([]);
    } else {
      const all = rows.map((r) => String(r[rowKey]));
      setSelectedKeys(all);
      onSelectionChange?.(all);
    }
  }

  const totalColumns = selectable ? columns.length + 1 : columns.length;

  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse text-[length:var(--text-sm)] font-[family-name:var(--font-sans)]">
        <thead>
          <tr>
            {selectable && (
              <th className="px-3 py-2 text-left w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedKeys.length === rows.length}
                  onChange={toggleAll}
                  className="accent-[color:var(--color-accent)]"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left font-medium text-[color:var(--color-text-muted)] text-[length:var(--text-xs)] uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="px-3 py-6 text-center text-[color:var(--color-text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = String(row[rowKey]);
              const isLast = index === rows.length - 1;
              return (
                <tr
                  key={key}
                  className={`hover:bg-[color:rgba(255,255,255,0.02)] ${isLast ? "" : "border-b border-[color:var(--color-border)]"}`}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(key)}
                        onChange={() => { toggleKey(key); }}
                        className="accent-[color:var(--color-accent)]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-[color:var(--color-text)]">
                      {col.render !== undefined
                        ? col.render(row[col.key], row)
                        : cellToString(row[col.key])}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
