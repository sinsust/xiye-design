// Zoom Grid — Originkit（马赛克缩放网格，Cursor/Zoom Grid，Canvas 2D + rAF，零依赖）

"use client"

import { useEffect, useRef } from "react"
import type { CSSProperties } from "react"

interface ResponsiveImageLike {
  src?: string
  srcSet?: string
  alt?: string
}

interface Props {
  image?: ResponsiveImageLike | string
  background?: string
  size?: number
  zoom?: number
  reach?: number
  damping?: number
  speed?: number
  fade?: number
  dotSize?: number
  dotColor?: string
  style?: CSSProperties
}

const MAX_DPR = 2

const TAU = Math.PI * 2

const FOLLOW_RATE = 6

const REACH_RATE = 1.6

const HOVER_RATE = 8

const LAG_GAIN = 2

const RIM_RAMP = 8

const IDLE_OPEN = 0.45

const DRIFT_AX = 0.32
const DRIFT_AY = 0.28
const DRIFT_WX = 0.6
const DRIFT_WY = 0.95

const D = {
  image: {
    alt: "",
    src: "https://images.unsplash.com/photo-1695805311440-628c4db1c1d5?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTh8fG5hdHVyZSUyMGltYWdlfGVufDB8MHwwfHx8Mg%3D%3D",
  } as ResponsiveImageLike,
  background: "#000000",
  size: 72,
  zoom: 3,
  reach: 600,
  damping: 94,
  speed: 50,
  fade: 0,
  dotSize: 15,
  dotColor: "#ffffff",
}

function srcOf(v: unknown): string {
  if (!v) return ""
  if (typeof v === "string") return v
  return (v as ResponsiveImageLike).src || ""
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function cssColor(v: string): string {
  if (!v.startsWith("var(")) return v
  const comma = v.indexOf(",")
  if (comma < 0) return "#ffffff"
  return v.slice(comma + 1, v.lastIndexOf(")")).trim() || "#ffffff"
}

interface Cell {
  x: number
  y: number
  s: number
}

function __OriginkitBase_ZoomGrid(props: Props) {
  const src = srcOf(props.image ?? D.image)
  const background = props.background ?? D.background
  const style = props.style

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const live = useRef({
    size: D.size,
    zoom: D.zoom,
    reach: D.reach,
    damping: D.damping,
    speed: D.speed,
    fade: D.fade,
    dotSize: D.dotSize,
    dotColor: D.dotColor,
  })
  live.current.size = Math.max(4, props.size ?? D.size)
  live.current.zoom = Math.max(1, props.zoom ?? D.zoom)
  live.current.reach = Math.max(0, props.reach ?? D.reach)
  live.current.damping = clamp(props.damping ?? D.damping, 1, 100)
  live.current.speed = Math.max(0, props.speed ?? D.speed)
  live.current.fade = clamp(props.fade ?? D.fade, 0, 100)
  live.current.dotSize = Math.max(0, props.dotSize ?? D.dotSize)
  live.current.dotColor = props.dotColor ?? D.dotColor

  useEffect(() => {
    if (!src) {
      imgRef.current = null
      return
    }
    const img = new Image()

    img.decoding = "async"
    img.src = src
    img.onload = () => {
      imgRef.current = img
    }
    return () => {
      img.onload = null
    }
  }, [src])

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const context = canvasEl.getContext("2d")
    if (!context) return
    const canvas: HTMLCanvasElement = canvasEl
    const ctx: CanvasRenderingContext2D = context

    let cw = 0
    let ch = 0
    let dpr = 1
    let cellPx = 0
    let cells: Cell[] = []

    const st = {
      fx: 0,
      fy: 0,
      reach: -1,
      hover: 0,
      hoverTarget: 0,
      px: 0,
      py: 0,
      t: 0,
    }

    function rebuild() {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      const nd = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      const nw = Math.max(1, Math.round(w * nd))
      const nh = Math.max(1, Math.round(h * nd))
      const nc = Math.max(2, Math.round(live.current.size * nd))
      if (nw === cw && nh === ch && nc === cellPx) return
      if (nw !== cw || nh !== ch) {
        canvas.width = nw
        canvas.height = nh
        if (cw === 0) {
          st.fx = nw / 2
          st.fy = nh / 2
          st.px = nw / 2
          st.py = nh / 2
        }
      }
      cw = nw
      ch = nh
      dpr = nd
      cellPx = nc
      cells = []
      for (let x = 0; x <= cw; x += cellPx) {
        for (let y = 0; y <= ch; y += cellPx) cells.push({ x, y, s: 0 })
      }
    }

    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)
    rebuild()

    function onMove(e: PointerEvent) {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      st.px = (e.offsetX / w) * cw
      st.py = (e.offsetY / h) * ch
      st.hoverTarget = 1
    }
    function onLeave() {
      st.hoverTarget = 0
    }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.addEventListener("pointercancel", onLeave)

    let raf = 0
    let last = performance.now()

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      rebuild()

      const p = live.current

      st.t += dt * (p.speed / 50)
      const driftX = cw * (0.5 + DRIFT_AX * Math.sin(st.t * DRIFT_WX))
      const driftY = ch * (0.5 + DRIFT_AY * Math.sin(st.t * DRIFT_WY + 1.3))
      st.hover += (st.hoverTarget - st.hover) * (1 - Math.exp(-HOVER_RATE * dt))
      const tx = driftX + (st.px - driftX) * st.hover
      const ty = driftY + (st.py - driftY) * st.hover

      const k = FOLLOW_RATE * (p.damping / 50)
      const a = 1 - Math.exp(-k * dt)
      st.fx += (tx - st.fx) * a
      st.fy += (ty - st.fy) * a

      const lag = Math.hypot(tx - st.fx, ty - st.fy)
      const full = p.reach * dpr
      const idle = full * IDLE_OPEN * Math.min(1, p.speed / 50)
      const rTarget = idle + (Math.min(full, LAG_GAIN * lag) - idle) * st.hover
      if (st.reach < 0) st.reach = full
      st.reach += (rTarget - st.reach) * (1 - Math.exp(-REACH_RATE * dt))

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      const img = imgRef.current
      if (!img || !img.naturalWidth || !img.naturalHeight) return

      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scale = Math.max(cw / iw, ch / ih)
      const vw = cw / scale
      const vh = ch / scale
      const ox = (iw - vw) / 2
      const oy = (ih - vh) / 2

      ctx.globalAlpha = 1
      ctx.drawImage(img, ox, oy, vw, vh, 0, 0, cw, ch)

      const R = st.reach
      const fadeK = p.fade / 100
      const zoomK = p.zoom - 1
      const half = cellPx / 2
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        if (R < 1) {
          c.s = 0
          continue
        }
        const d = Math.hypot(c.x + half - st.fx, c.y + half - st.fy)
        const s = 1 - Math.min(1, d / R)
        c.s = s
        if (s < 0.001) continue

        const ss = cellPx / (1 + zoomK * s) / scale
        const sx = clamp(ox + (c.x + half) / scale - ss / 2, 0, Math.max(0, iw - ss))
        const sy = clamp(oy + (c.y + half) / scale - ss / 2, 0, Math.max(0, ih - ss))

        ctx.globalAlpha = (1 - fadeK * (1 - s)) * Math.min(1, s * RIM_RAMP)
        ctx.drawImage(img, sx, sy, ss, ss, c.x, c.y, cellPx, cellPx)
      }

      if (p.dotSize > 0) {
        const dr = (cellPx * p.dotSize) / 100
        ctx.globalAlpha = 1
        ctx.fillStyle = cssColor(p.dotColor)
        ctx.beginPath()
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i]
          if (c.s < 0.001) continue
          const r = dr * c.s

          ctx.moveTo(c.x + r, c.y)
          ctx.arc(c.x, c.y, r, 0, TAU)
        }
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      canvas.removeEventListener("pointercancel", onLeave)
    }
  }, [])

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background,
        minWidth: 1200,
        minHeight: 800,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  )
}

const __originkitPresetProps = {
  image: {
    alt: "",
    src: "https://images.unsplash.com/photo-1695805311440-628c4db1c1d5?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTh8fG5hdHVyZSUyMGltYWdlfGVufDB8MHwwfHx8Mg%3D%3D",
  },
}

export default function ZoomGrid(props: Record<string, unknown>) {
  return (
    <__OriginkitBase_ZoomGrid
      {...(__originkitPresetProps as Record<string, unknown>)}
      {...props}
    />
  )
}