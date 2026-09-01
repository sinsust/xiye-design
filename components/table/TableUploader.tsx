"use client";

/**
 * 数据引擎 —— 上传组件
 * 拖拽/点击上传 .xlsx/.xls/.csv/.tsv/.json，XMLHttpRequest 真实进度条，成功后回调解析结果。
 */

import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import type { HeaderCandidate, SheetRecommendation } from "@/lib/table/types";
import type { JoinSuggestion } from "@/lib/table/combine/detect-join-keys";

const ACCEPT = ".xlsx,.xls,.csv,.tsv,.json";
const MAX_MB = 100;

export interface UploadResult {
  tableId?: string;
  truncated?: string[];
  /** 单文件上传（/api/brain/table/upload）返回；多文件上传时缺省 */
  parsedInfo?: {
    fileName: string;
    encoding: string;
    sheets: { name: string; headers: string[]; rows: unknown[][]; rowCount: number; colCount: number }[];
  };
  /** 单文件上传返回；多文件上传时缺省 */
  structure?: {
    sameStructureGroups: string[][];
    differentSheets: string[];
  };
  /** 多文件上传（/api/brain/table/upload-multi）返回：跨表可组合连接键建议 */
  joinSuggestions?: JoinSuggestion[];
  results: Array<{
    sheetName: string;
    headers: string[];
    rows: unknown[][];
    columnTypes: string[];
    profile: unknown;
    tableId: string;
    /** T1-D1：Sheet 推荐结果（角色 / 推荐标记 / 需确认表头 / 理由） */
    recommendation?: SheetRecommendation;
    /** T1-D2：可选表头候选（供确认面板切换预览） */
    headerCandidates?: HeaderCandidate[];
    /** 以下字段由服务端返回，供确认流展示与重新画像（均可选，向后兼容） */
    detectedHeaderRow?: number;
    effectiveRowCount?: number;
    effectiveColumnCount?: number;
    excludedRows?: unknown[];
    excludedColumns?: unknown[];
    qualityIssues?: unknown[];
    /** T1-D3：字段级覆盖（展示名 / 类型），由 confirm-columns 回写，向后兼容可选 */
    columnOverrides?: Record<number, { displayName?: string; type?: string }>;
    /** T1-D3：用户确认纳入分析的列下标集合（undefined=全部） */
    confirmedColumns?: number[];
    /** 由组合引擎生成（/api/brain/table/combine）的宽表结果 */
    combined?: boolean;
    /** 组合产生的非阻断警告（如一对多） */
    joinWarnings?: string[];
  }>;
}

export function TableUploader({
  onUploaded,
  onError,
}: {
  onUploaded: (data: UploadResult) => void;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const uploadFiles = useCallback(
    (files: File[]) => {
      setError("");
      const valid = files.filter((f) => /\.(xlsx|xls|csv|tsv|json)$/i.test(f.name));
      if (valid.length === 0) {
        setError("仅支持 .xlsx / .xls / .csv / .tsv / .json");
        return;
      }
      const oversize = valid.find((f) => f.size > MAX_MB * 1024 * 1024);
      if (oversize) {
        setError(`文件「${oversize.name}」超过 ${MAX_MB}MB 上限`);
        return;
      }
      setFileName(valid.map((f) => f.name).join("、"));
      setUploading(true);
      setProgress(0);

      // ≥2 个文件 → 走多文件上传（自动检测可组合连接键）；单文件 → 走单文件上传
      const isMulti = valid.length > 1;
      const form = new FormData();
      if (isMulti) valid.forEach((f) => form.append("files", f));
      else form.append("file", valid[0]);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", isMulti ? "/api/brain/table/upload-multi" : "/api/brain/table/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 90)); // 上传占 0~90%
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status !== 200) {
            throw new Error(data?.message || data?.error || "上传失败");
          }
          setProgress(100);
          // 解析/画像在服务端完成，直接回调
          setTimeout(() => onUploaded(data as UploadResult), 150);
        } catch (e) {
          setUploading(false);
          const msg = (e as Error).message;
          setError(msg);
          onError?.(msg);
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setError("网络错误，请重试");
        onError?.("网络错误，请重试");
      };
      xhr.send(form);
    },
    [onUploaded, onError],
  );

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10">
      {/* 拖拽区 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const fs = Array.from(e.dataTransfer.files ?? []);
          if (fs.length > 0) uploadFiles(fs);
        }}
        className={
          "group flex w-full max-w-md cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12 transition-all duration-200 " +
          (dragging
            ? "scale-[1.01] border-primary bg-primary/5 shadow-lg shadow-primary/10"
            : "border-border/80 bg-muted/30 hover:border-primary/50 hover:bg-primary/3")
        }
      >
        <div
          className={
            "flex size-14 items-center justify-center rounded-2xl transition-all duration-300 " +
            (dragging
              ? "rotate-6 scale-110 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
              : "bg-gradient-to-br from-primary/12 to-primary/5 text-primary group-hover:scale-105")
          }
        >
          <UploadCloud className="size-7" />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-foreground">
            {dragging ? "松开即可上传" : "拖拽文件到此处，或点击选择"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            支持 .xlsx / .xls / .csv / .tsv / .json · 最大 {MAX_MB}MB · 可多选多张表，自动检测可组合字段
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          if (fs.length > 0) uploadFiles(fs);
          e.target.value = "";
        }}
      />

      {/* 解析进度（细进度条） */}
      {uploading && (
        <div className="mt-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              正在解析
            </span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          {fileName && <div className="mt-1.5 truncate text-xs text-muted-foreground">{fileName}</div>}
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 animate-in fade-in">
          <X className="size-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground/70">
        <FileSpreadsheet className="size-3.5" />
        文件仅用于本次分析，不会被持久化存储
      </div>
    </div>
  );
}
