"use client";

import { type ReactNode, useState } from "react";

/** Safely convert an unknown cell value to a display string. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function humanizeColumnKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface DataTableRow {
  id: string | number;
  [key: string]: unknown;
}

export type DataTableColumnKey<Row extends DataTableRow> = Extract<
  keyof Row,
  string
>;

export interface DataTableColumn<Row extends DataTableRow> {
  key: DataTableColumnKey<Row>;
  label?: ReactNode;
  cell?: (row: Row) => ReactNode;
}

export interface DataTableProps<Row extends DataTableRow> {
  columns?: Array<DataTableColumnKey<Row> | DataTableColumn<Row>>;
  rows: Row[];
  selectable?: boolean;
  empty?: ReactNode;
  onSelectionChange?: (selectedRows: Row[]) => void;
}

interface NormalizedDataTableColumn<Row extends DataTableRow> {
  key: DataTableColumnKey<Row>;
  label: ReactNode;
  cell?: (row: Row) => ReactNode;
}

function inferColumns<Row extends DataTableRow>(
  rows: Row[]
): DataTableColumnKey<Row>[] {
  const firstRow = rows[0];
  if (firstRow === undefined) {
    return [];
  }

  return Object.keys(firstRow).filter(
    (key) => key !== "id"
  ) as DataTableColumnKey<Row>[];
}

function normalizeColumns<Row extends DataTableRow>(
  columns: Array<DataTableColumnKey<Row> | DataTableColumn<Row>> | undefined,
  rows: Row[]
): NormalizedDataTableColumn<Row>[] {
  const resolvedColumns = columns ?? inferColumns(rows);

  return resolvedColumns.map((column) => {
    if (typeof column === "string") {
      return { key: column, label: humanizeColumnKey(column) };
    }

    return {
      key: column.key,
      label: column.label ?? humanizeColumnKey(column.key),
      cell: column.cell,
    };
  });
}

/** Borderless data table — faint row separators, ghostly hover. */
export function DataTable<Row extends DataTableRow>({
  columns,
  rows,
  selectable = false,
  empty = "No data",
  onSelectionChange,
}: DataTableProps<Row>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const normalizedColumns = normalizeColumns(columns, rows);

  function getSelectedRows(nextSelectedIds: string[]): Row[] {
    const selectedLookup = new Set(nextSelectedIds);
    return rows.filter((row) => selectedLookup.has(String(row.id)));
  }

  function toggleRow(rowId: string) {
    const nextSelectedIds = selectedIds.includes(rowId)
      ? selectedIds.filter((id) => id !== rowId)
      : [...selectedIds, rowId];
    setSelectedIds(nextSelectedIds);
    onSelectionChange?.(getSelectedRows(nextSelectedIds));
  }

  function toggleAll() {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
      onSelectionChange?.([]);
    } else {
      const allIds = rows.map((row) => String(row.id));
      setSelectedIds(allIds);
      onSelectionChange?.(rows);
    }
  }

  const totalColumns = Math.max(
    normalizedColumns.length + (selectable ? 1 : 0),
    1
  );

  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse text-[length:var(--text-sm)] font-[family-name:var(--font-sans)]">
        {normalizedColumns.length > 0 && (
          <thead>
            <tr>
              {selectable && (
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={
                      rows.length > 0 && selectedIds.length === rows.length
                    }
                    onChange={toggleAll}
                    className="accent-[color:var(--color-accent)]"
                  />
                </th>
              )}
              {normalizedColumns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2 text-left font-medium text-[color:var(--color-text-muted)] text-[length:var(--text-xs)] uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="px-3 py-6 text-center text-[color:var(--color-text-muted)]"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const rowId = String(row.id);
              const isLast = index === rows.length - 1;

              return (
                <tr
                  key={rowId}
                  className={`hover:bg-[color:rgba(255,255,255,0.02)] ${isLast ? "" : "border-b border-[color:var(--color-border)]"}`}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rowId)}
                        onChange={() => {
                          toggleRow(rowId);
                        }}
                        className="accent-[color:var(--color-accent)]"
                      />
                    </td>
                  )}
                  {normalizedColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-3 py-2.5 text-[color:var(--color-text)]"
                    >
                      {column.cell !== undefined
                        ? column.cell(row)
                        : cellToString(row[column.key])}
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
