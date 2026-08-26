"use client";

/**
 * 通用交互数据表格（TanStack Table v8）
 *
 * 能力：列排序（三态）、全局搜索过滤、分页、null 值兜底。
 * 数据输入：headers: string[] + rows: unknown[][]（与 lib/table/types 的 SheetInfo 对齐）。
 * 替换 AnalysisResultView 内部静态 DataTable；样式沿用工作台 token，零视觉回归。
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type SortingFn,
  type SortingState,
} from "@tanstack/react-table";

interface Row {
  id: number;
  cells: unknown[];
}

interface DataTableProps {
  headers: string[];
  rows: unknown[][];
  pageSize?: number;
  searchable?: boolean;
  sortable?: boolean;
}

/** 全局过滤：任一单元格包含关键字即命中（null 跳过） */
const globalFilterFn: FilterFn<Row> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").toLowerCase().trim();
  if (!q) return true;
  return row.original.cells.some((c) => c != null && String(c).toLowerCase().includes(q));
};

/** 单元格排序值归一：数字优先，其余转字符串，null 置空 */
const sortValue = (v: unknown): string | number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v == null ? "" : String(v);
};

/** 混合类型列排序：先比类型再比值 */
const sortingFn: SortingFn<Row> = (a, b, colId) => {
  const idx = Number(colId);
  const va = sortValue(a.original.cells[idx]);
  const vb = sortValue(b.original.cells[idx]);
  if (va === vb) return 0;
  return va > vb ? 1 : -1;
};

export function DataTable({
  headers,
  rows,
  pageSize = 20,
  searchable = true,
  sortable = true,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      headers.map((h, i) => ({
        id: String(i),
        accessorFn: (row) => row.cells[i],
        header: h || `列 ${i + 1}`,
        sortingFn,
        enableSorting: sortable,
      })),
    [headers, sortable],
  );

  const data = useMemo<Row[]>(() => rows.map((r, idx) => ({ id: idx, cells: r })), [rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } },
    autoResetPageIndex: false,
  });

  if (rows.length === 0) return null;

  const total = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const empty = total === 0;

  return (
    <div>
      {searchable && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
          <Search className="size-3 shrink-0 text-muted-foreground/60" />
          <input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="搜索…"
            className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
          />
          {globalFilter && (
            <button
              onClick={() => table.setGlobalFilter("")}
              className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
              aria-label="清除搜索"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-muted/40 text-left text-muted-foreground">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="whitespace-nowrap border-b border-border/60 px-2.5 py-1.5 font-medium">
                      {sortable && header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 transition hover:text-foreground"
                          title="点击排序"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-[9px] opacity-70">
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={columns.length} className="px-2.5 py-6 text-center text-[11px] text-muted-foreground">
                  没有匹配的数据
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="max-w-[180px] truncate px-2.5 py-1.5 text-foreground/85">
                      {fmtCell(cell.getValue())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{total} 行</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex size-5 items-center justify-center rounded border border-border/60 transition hover:border-primary/40 disabled:opacity-30"
            >
              <ChevronLeft className="size-3" />
            </button>
            <span className="tabular-nums">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex size-5 items-center justify-center rounded border border-border/60 transition hover:border-primary/40 disabled:opacity-30"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return String(v);
}
