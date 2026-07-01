"use client";

import React, { ReactNode, isValidElement, useEffect, useMemo, useState } from "react";

type TableColumn = {
  id: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  className?: string;
};

type TableRow = ReactNode[];

export type AnalyticsDataTableProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  columns: TableColumn[];
  rows: TableRow[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (rowIndex: number) => void;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  searchPlaceholder?: string;
  rowsPerPageOptions?: number[];
  initialRowsPerPage?: number;
  totalRows?: number;
  countLabel?: string;
  sourceLabel?: string;
  truncatedLabel?: string;
  className?: string;
};

function valueToText(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return `${value}`;
  }

  if (Array.isArray(value)) {
    return value.map(valueToText).filter(Boolean).join(" ");
  }

  if (isValidElement(value)) {
    const props = value.props as Record<string, any>;
    if (typeof props.amount === "number" || typeof props.amount === "string") {
      return `${props.amount}`;
    }
    if (typeof props.value === "number" || typeof props.value === "string") {
      return `${props.value}`;
    }
    if (typeof props.text === "string" || typeof props.text === "number") {
      return `${props.text}`;
    }
    if (typeof props.label === "string" || typeof props.label === "number") {
      return `${props.label}`;
    }
    return valueToText(props.children);
  }

  return `${value}`;
}

function normalizeComparable(value: ReactNode): string | number {
  const text = valueToText(value).trim();
  if (!text) return "";

  const numericText = text.replace(/[^0-9.-]+/g, "");
  if (numericText && !Number.isNaN(Number(numericText)) && /^[0-9.-]+$/.test(numericText)) {
    return Number(numericText);
  }

  return text.toLowerCase();
}

function compareValues(left: ReactNode, right: ReactNode): number {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  const aText = `${a}`;
  const bText = `${b}`;
  return aText.localeCompare(bText, undefined, { numeric: true, sensitivity: "base" });
}

function getRowSearchText(row: TableRow): string {
  return row.map((cell) => valueToText(cell)).join(" ").toLowerCase();
}

function EmptyState({
  title,
  description,
}: {
  title?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-gray-900">{title || "No rows found."}</p>
      {description ? <p className="mt-2 text-sm text-gray-600">{description}</p> : null}
    </div>
  );
}

export function AnalyticsDataTable({
  title,
  subtitle,
  columns,
  rows,
  loading = false,
  error = null,
  onRowClick,
  emptyTitle,
  emptyDescription,
  searchPlaceholder = "Search this table",
  rowsPerPageOptions = [10, 20, 50, 100],
  initialRowsPerPage = 10,
  totalRows,
  countLabel,
  sourceLabel,
  truncatedLabel,
  className = "",
}: AnalyticsDataTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [sortColumnIndex, setSortColumnIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const searchableRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseRows = rows.map((row, index) => ({
      row,
      rowIndex: index,
      searchText: getRowSearchText(row),
    }));

    if (!query) {
      return baseRows;
    }

    return baseRows.filter((entry) => entry.searchText.includes(query));
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (sortColumnIndex === null || !columns[sortColumnIndex]) {
      return searchableRows;
    }

    const column = columns[sortColumnIndex];
    if (column.sortable === false) {
      return searchableRows;
    }

    const clone = [...searchableRows];
    clone.sort((left, right) => {
      const leftCell = left.row[sortColumnIndex];
      const rightCell = right.row[sortColumnIndex];
      const comparison = compareValues(leftCell, rightCell);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return clone;
  }, [columns, searchColumnIndexKey(sortColumnIndex), searchableRows, sortDirection]);

  const totalFilteredRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalFilteredRows / rowsPerPage));
  const safePage = Math.min(page, pageCount);
  const start = totalFilteredRows === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const end = Math.min(safePage * rowsPerPage, totalFilteredRows);

  const pagedRows = useMemo(() => {
    const offset = (safePage - 1) * rowsPerPage;
    return sortedRows.slice(offset, offset + rowsPerPage);
  }, [rowsPerPage, safePage, sortedRows]);

  useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage, rows]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const countText = useMemo(() => {
    const availableRows = typeof totalRows === "number" ? totalRows : rows.length;
    const label = sourceLabel || "rows";

    if (search.trim()) {
      return `Showing ${start}-${end} of ${totalFilteredRows} matching ${label}`;
    }

    if (countLabel) {
      return countLabel;
    }

    if (typeof totalRows === "number" && totalRows > rows.length) {
      if (truncatedLabel) {
        return truncatedLabel;
      }
      return `Showing ${start}-${end} of ${totalRows} ${label}`;
    }

    return `Showing ${start}-${end} of ${availableRows} ${label}`;
  }, [countLabel, end, rows.length, search, sourceLabel, start, totalFilteredRows, totalRows, truncatedLabel]);

  const handleSort = (index: number) => {
    if (columns[index]?.sortable === false) {
      return;
    }

    setPage(1);
    if (sortColumnIndex === index) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumnIndex(index);
    setSortDirection("asc");
  };

  const canPrevious = safePage > 1;
  const canNext = safePage < pageCount;

  return (
    <div className={`rounded-3xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || subtitle || rows.length > 0) && (
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            {title ? <h3 className="text-base font-semibold text-gray-900">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="whitespace-nowrap">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {rowsPerPageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-72"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="font-medium text-gray-700">{countText}</div>
        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
          {typeof totalRows === "number" && totalRows > rows.length ? "Dataset may be truncated" : "Full current dataset"}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 sm:px-5">
          <EmptyState title="Loading..." description="Please wait while the table data is loaded." />
        </div>
      ) : error ? (
        <div className="px-4 py-8 sm:px-5">
          <EmptyState title="Failed to load table" description={error} />
        </div>
      ) : totalFilteredRows === 0 ? (
        <div className="px-4 py-8 sm:px-5">
          <EmptyState title={emptyTitle || "No data"} description={emptyDescription || "No rows match the current filters."} />
        </div>
      ) : (
        <>
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  {columns.map((column, index) => {
                    const isSorted = sortColumnIndex === index;
                    const alignClass =
                      column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left";

                    return (
                      <th
                        key={column.id}
                        onClick={() => handleSort(index)}
                        className={`cursor-pointer border-b border-gray-200 px-4 py-3 font-semibold text-gray-600 ${alignClass} ${column.className || ""}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{column.header}</span>
                          {column.sortable === false ? null : (
                            <span className="text-[10px] font-bold text-gray-400">
                              {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pagedRows.map((entry, rowIndex) => (
                  <tr
                    key={`${entry.rowIndex}-${rowIndex}`}
                    onClick={onRowClick ? () => onRowClick(entry.rowIndex) : undefined}
                    className={`transition ${onRowClick ? "cursor-pointer hover:bg-gray-50/70" : "hover:bg-gray-50/70"}`}
                  >
                    {entry.row.map((cell, cellIndex) => {
                      const alignClass =
                        columns[cellIndex]?.align === "right"
                          ? "text-right"
                          : columns[cellIndex]?.align === "center"
                            ? "text-center"
                            : "text-left";

                      return (
                        <td
                          key={`${entry.rowIndex}-${cellIndex}`}
                          className={`px-4 py-3 align-top text-gray-800 ${cellIndex === 0 && columns[cellIndex]?.align !== "right" ? "font-medium" : ""} ${alignClass}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold text-gray-900">{safePage}</span> of{" "}
              <span className="font-semibold text-gray-900">{pageCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={!canPrevious}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
                disabled={!canNext}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function searchColumnIndexKey(index: number | null) {
  return index === null ? -1 : index;
}
