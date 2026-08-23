"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 商品主图：点击放大查看。lightbox 挂到 body，避免表格/sticky overflow 裁切。
 * nestedInButton：外层已是 button 时用 span，避免非法嵌套。
 */
export function ZoomableImage({
  src,
  alt = "",
  className = "",
  imgClassName = "h-full w-full max-h-full max-w-full object-cover",
  nestedInButton = false,
  children,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  nestedInButton?: boolean;
  /** 无图时的占位 */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mounted = typeof document !== "undefined";
  const url = (src || "").trim();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!url) {
    return (
      <div className={`overflow-hidden bg-zinc-50 ${className}`}>
        {children ?? (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">
            无图
          </div>
        )}
      </div>
    );
  }

  const openZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  const thumb = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`cursor-zoom-in ${imgClassName}`}
    />
  );

  const lightbox =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-6"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            role="dialog"
            aria-modal
            aria-label="查看大图"
          >
            <button
              type="button"
              aria-label="关闭"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="absolute right-4 top-4 z-[201] flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-lg leading-none text-white hover:bg-black/70"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              referrerPolicy="no-referrer"
              className="max-h-[90vh] max-w-[90vw] cursor-zoom-out rounded-lg bg-transparent object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {nestedInButton ? (
        <span
          title="查看大图"
          role="button"
          tabIndex={0}
          onClick={openZoom}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }
          }}
          className={`relative inline-block overflow-hidden bg-zinc-50 ${className}`}
        >
          {thumb}
        </span>
      ) : (
        <button
          type="button"
          title="查看大图"
          onClick={openZoom}
          className={`relative block shrink-0 overflow-hidden bg-zinc-50 text-left ${className}`}
        >
          {thumb}
        </button>
      )}
      {lightbox}
    </>
  );
}
