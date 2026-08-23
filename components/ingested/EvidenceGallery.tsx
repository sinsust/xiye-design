"use client";

// 通用凭证画廊（源：agent-workstudio/src/components/ui/EvidenceGallery.tsx）
// 改动：EvidenceImage 业务类型 → 通用 GalleryImage；next/image → 原生 img（去依赖）；
// 硬编码中文文案 → title / countText 可配（默认值保持原样）。
import { useState } from "react";

export interface GalleryImage {
  id: string;
  url: string;
  label?: string;
  source?: string;
  uploadedAt?: string;
}

interface EvidenceGalleryProps {
  images: GalleryImage[];
  compact?: boolean;
  /** 画廊标题，默认「凭证图片」 */
  title?: string;
  /** 计数文案生成器，默认 `共 ${n} 张` */
  countText?: (n: number) => string;
}

export function EvidenceGallery({
  images,
  compact,
  title = "凭证图片",
  countText = (n) => `共 ${n} 张`,
}: EvidenceGalleryProps) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? null);
  const active = images.find((img) => img.id === activeId) ?? images[0];

  if (images.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {images.slice(0, 3).map((img) => (
          <div
            key={img.id}
            className="relative h-9 w-9 overflow-hidden rounded border border-zinc-200 bg-white"
            title={img.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.label ?? ""} className="h-full w-full object-cover" />
          </div>
        ))}
        <span className="text-[10px] text-zinc-500">{images.length} 张凭证图</span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[12px] font-medium text-zinc-700">{title}</h4>
        <span className="text-[11px] text-zinc-400">{countText(images.length)}</span>
      </div>
      {active && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          <div className="relative aspect-[4/3] w-full bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.label ?? ""}
              className="h-full w-full object-contain p-2"
            />
          </div>
          <div className="border-t border-zinc-200 px-3 py-2">
            <div className="text-[12px] font-medium text-zinc-800">{active.label}</div>
            <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span>{active.source}</span>
              {active.uploadedAt && <span>· {active.uploadedAt}</span>}
            </div>
          </div>
        </div>
      )}
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveId(img.id)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-white transition-colors ${
                (activeId ?? images[0].id) === img.id
                  ? "border-[#1e4d5c]"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
              title={img.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.label ?? ""} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
