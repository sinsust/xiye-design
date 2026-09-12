"use client";

// Grainy Carousel — 颗粒轮播
// 一条无限长的图片带，画面两端逐渐溶散为动态 fbm 噪声颗粒。
// 可拖拽（甩）、点击两侧步进，或让其自动滚动；滚动模式分 smooth（持续缓动）
// 与 snap（按卡顿对齐）。图带先在 2D canvas 上合成为一张纹理，再经一次
// WebGL shader 在左右边缘做位移 + 变暗 + 噪声颗粒处理；无 WebGL 时退回纯 2D。
// 默认图为内联 SVG 渐变块（每张各不相同），不依赖外部图床。
// 自 Framer Originkit Grainy Carousel 移植，去掉 Framer 面板依赖。

import { animate } from "motion/react"

/** framer-motion `animate()` 的选项袋。此处显式拼出（framer 内打包的版本未导出
 *  AnimationOptions，且其 Transition 类型不能直接赋给 animate，故用 type alias）。 */
type Motion = {
    type?: "spring" | "tween" | "keyframes" | "inertia"
    duration?: number
    ease?: [number, number, number, number]
    delay?: number
    stiffness?: number
    damping?: number
    mass?: number
    bounce?: number
    restSpeed?: number
    restDelta?: number
}

const DEFAULT_TRANSITION: Motion = {
    type: "tween",
    duration: 0.5,
    ease: [0, 0, 0.58, 1],
}

import * as React from "react"
import { useEffect, useRef } from "react"

interface ScrollGroup {
    mode?: "smooth" | "snap"
    /** 0–100 拨盘映射 DRAG_GAIN_MIN…DRAG_GAIN_MAX；0 不是关（无死端），
     *  25 为 1:1 跟手，100 为 2.5:1。 */
    drag?: number
    /** percent，1–100。越大越快落定；两种模式下都驱动每次拖拽。 */
    damping?: number
    /** percent，0–30。0 即关。 */
    zoom?: number
}

interface GrainGroup {
    /** 0–100 拨盘；50 是它出厂的速度 */
    speed?: number
    /** percent，0–100 */
    amount?: number
    scale?: number
}

interface Props {
    images?: string[]
    background?: string
    /** px */
    cardWidth?: number
    /** px */
    cardHeight?: number
    gap?: number
    /** 相对最大圆角的 percent */
    rounded?: number
    /** 0–500 拨盘；50 是它出厂的速度 */
    speed?: number
    scroll?: ScrollGroup
    grain?: GrainGroup
    transition?: Motion
    style?: React.CSSProperties
}

/** Drag 0 时每 px 指针对应的图带位移 px —— 源的常量，也是拨盘的下限 */
const DRAG_GAIN_MIN = 0.5
/** …Drag 100 时。刻意超过 1:1（1:1 落在 25 档）：一张卡默认约 731px 宽，
 *  1:1 时满宽滑动大约只前进一张。 */
const DRAG_GAIN_MAX = 2.5

/* 已裁剪的控制项，各自冻结为源上出厂时的取值。 */
const CLICK_SLOP = 5
const SMOOTH_AT_50 = 90
const SNAP_INTERVAL_AT_50 = 5
const NOISE_AT_50 = 0.15
const DAMP_AT_100 = 0.5

const DEFAULT_CARD_W = 711
const DEFAULT_CARD_H = 400
const SIZE_MIN = 40
const SIZE_MAX = 800

/* 默认占位图：内联 SVG data URI，绝不指外部 CDN（外部图床一旦失效即为空白，
 * 且离线 / 代理 / 无网络时无法显示）。同一套图全文件夹共用。 */
const DUMMY_PAIRS: ReadonlyArray<[string, string]> = [
    ["FF7A45", "FFB199"],
    ["4D7CFE", "9BC1FF"],
    ["16C79A", "9BE7C4"],
    ["FFC53D", "FFE9A8"],
    ["B15CFF", "E0B8FF"],
    ["FF4D7E", "FFB3C7"],
]
const dummyImage = (i: number, w = 1200, h = 800) => {
    const [a, b] = DUMMY_PAIRS[i % DUMMY_PAIRS.length]
    const n = String(i + 1).padStart(2, "0")
    return (
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'%3E` +
        `%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E` +
        `%3Cstop offset='0' stop-color='%23${a}'/%3E%3Cstop offset='1' stop-color='%23${b}'/%3E` +
        `%3C/linearGradient%3E%3C/defs%3E%3Crect width='${w}' height='${h}' fill='url(%23g)'/%3E` +
        `%3Ctext x='50%25' y='50%25' dy='.35em' text-anchor='middle' ` +
        `font-family='Inter, Helvetica, Arial, sans-serif' font-size='${Math.round(Math.min(w, h) * 0.34)}' ` +
        `font-weight='700' fill='rgba(255,255,255,0.9)'%3E${n}%3C/text%3E%3C/svg%3E`
    )
        .replace(/ /g, "%20")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
}

const DEFAULT_IMAGES: string[] = DUMMY_PAIRS.map((_, i) =>
    dummyImage(i, 1200, 1200)
)

const DEFAULT_SCROLL: Required<ScrollGroup> = {
    mode: "snap",
    drag: 25,
    damping: 60,
    zoom: 5,
}

/** 冻结：颗粒带精确等于一张图宽（源的 "1 = 1 Image"）。 */
const GRAIN_WIDTH = 1

const DEFAULT_GRAIN: Required<GrainGroup> = {
    speed: 50,
    amount: 10,
    scale: 250,
}

const VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAG = `
precision highp float;

uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2  uResolution;
uniform float uEdgeWidth;
uniform float uNoiseSpeed;
uniform float uGrainScale;
uniform float uGrainAmount;

varying vec2 vUv;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m  = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p  = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  float leftBand  = 1.0 - smoothstep(0.0, uEdgeWidth, vUv.x);
  float rightBand = smoothstep(1.0 - uEdgeWidth, 1.0, vUv.x);
  float xMask     = max(leftBand, rightBand);

  if (xMask <= 0.001) {
      gl_FragColor = texture2D(tDiffuse, vUv);
      return;
  }

  float mask = pow(xMask, 3.0) * 3.0;
  float ar = uResolution.x / max(uResolution.y, 1.0);

  float t = uTime * uNoiseSpeed * (uGrainScale * 0.015);

  vec2 noiseUV = vec2(vUv.x * ar, vUv.y) * uGrainScale;

  float dx = fbm(noiseUV + vec2(t, t * 0.5)) * uGrainAmount;
  float dy = fbm(noiseUV + vec2(-t * 0.3, t * 0.8)) * uGrainAmount;

  vec2 warpedUV = vUv + vec2(dx, dy) * mask;

  vec4 col = vec4(0.0);
  if (warpedUV.x >= 0.0 && warpedUV.x <= 1.0 && warpedUV.y >= 0.0 && warpedUV.y <= 1.0) {
      col = texture2D(tDiffuse, warpedUV);
  }

  float colorDecay = max(smoothstep(1.0, 0.1, mask / 6.0), 0.1);

  gl_FragColor = vec4(col.rgb * colorDecay, col.a);
}`

/** 把 img cover 裁剪进圆角盒 (x, y, w, h)。
 *  `pct` 是相对最大圆角的 percent——短边一半，100 在任意宽高比下真成圆
 *  （不是药丸）：裁剪盒随圆角增大收窄为方形，短边与长轴裁掉。 */
function drawCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    pct: number
) {
    const t = Math.max(0, Math.min(100, pct)) / 100
    const short = Math.min(boxW, boxH)
    const x = boxX + (t * (boxW - short)) / 2
    const y = boxY + (t * (boxH - short)) / 2
    const w = boxW - t * (boxW - short)
    const h = boxH - t * (boxH - short)
    const r = (t * short) / 2
    if (!img.complete || !img.naturalWidth) return
    const imgRatio = img.naturalWidth / img.naturalHeight
    const boxRatio = w / h
    let sx: number
    let sy: number
    let sw: number
    let sh: number
    if (imgRatio > boxRatio) {
        sh = img.naturalHeight
        sw = sh * boxRatio
        sx = (img.naturalWidth - sw) / 2
        sy = 0
    } else {
        sw = img.naturalWidth
        sh = sw / boxRatio
        sx = 0
        sy = (img.naturalHeight - sw) / 2
    }
    const rr = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
    ctx.restore()
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.warn("GrainyCarousel shader:", gl.getShaderInfoLog(s))
    return s
}

/** 帧循环读取的一切，已展平为循环使用的单位。 */
interface Resolved {
    images: string[]
    mediaKey: string
    cardWidth: number
    cardHeight: number
    gap: number
    rounded: number
    mode: "smooth" | "snap"
    dragGain: number
    smoothRate: number
    snapInterval: number
    damping: number
    zoom: number
    edgeWidth: number
    noiseSpeed: number
    grainAmount: number
    grainScale: number
}

function resolve(p: Props): Resolved {
    const scroll = { ...DEFAULT_SCROLL, ...p.scroll }
    const grain = { ...DEFAULT_GRAIN, ...p.grain }
    const images = p.images && p.images.length ? p.images : DEFAULT_IMAGES
    const speed = p.speed ?? 155
    return {
        images,
        mediaKey: images.join("|"),
        cardWidth: Math.max(1, Math.round(p.cardWidth ?? DEFAULT_CARD_W)),
        cardHeight: Math.max(1, Math.round(p.cardHeight ?? DEFAULT_CARD_H)),
        gap: p.gap ?? 20,
        rounded: p.rounded ?? 8,
        mode: scroll.mode,
        dragGain:
            DRAG_GAIN_MIN +
            (Math.max(0, Math.min(100, scroll.drag)) / 100) *
                (DRAG_GAIN_MAX - DRAG_GAIN_MIN),
        smoothRate: (speed / 50) * SMOOTH_AT_50,
        snapInterval:
            speed <= 0 ? Infinity : SNAP_INTERVAL_AT_50 * (50 / speed),
        damping: (Math.max(1, Math.min(100, scroll.damping)) / 100) * DAMP_AT_100,
        zoom: Math.max(0, Math.min(100, scroll.zoom)) / 100,
        edgeWidth: GRAIN_WIDTH,
        noiseSpeed: (grain.speed / 50) * NOISE_AT_50,
        grainAmount: Math.max(0, Math.min(100, grain.amount)) / 100,
        grainScale: grain.scale,
    }
}

function __OriginkitBase_GrainyCarousel(props: Props) {
    const {
        images: _images,
        background: _background,
        cardWidth: _cardWidth,
        cardHeight: _cardHeight,
        gap: _gap,
        rounded: _rounded,
        speed: _speed,
        scroll: _scroll,
        grain: _grain,
        style,
        ...rest
    } = props

    const p = resolve(props)
    const background = props.background ?? "rgba(0, 0, 0, 0)"

    const hostRef = useRef<HTMLDivElement>(null)
    const glCanvasRef = useRef<HTMLCanvasElement>(null)
    const fallbackRef = useRef<HTMLCanvasElement>(null)

    const transitionRef = useRef(props.transition ?? DEFAULT_TRANSITION)
    transitionRef.current = props.transition ?? DEFAULT_TRANSITION

    const propsRef = useRef(p)
    propsRef.current = p

    useEffect(() => {
        const host = hostRef.current
        const canvas = glCanvasRef.current
        const fallback = fallbackRef.current
        if (!host || !canvas || !fallback) return

        const strip = document.createElement("canvas")
        const stripCtx = strip.getContext("2d")

        const gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: false,
        })

        let prog: WebGLProgram | null = null
        let tex: WebGLTexture | null = null
        let uTime: WebGLUniformLocation | null = null
        let uResolution: WebGLUniformLocation | null = null
        let uEdgeWidth: WebGLUniformLocation | null = null
        let uNoiseSpeed: WebGLUniformLocation | null = null
        let uGrainScale: WebGLUniformLocation | null = null
        let uGrainAmount: WebGLUniformLocation | null = null
        let posBuf: WebGLBuffer | null = null
        let uvBuf: WebGLBuffer | null = null
        let hasGL = false

        if (gl) {
            prog = gl.createProgram()!
            gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
            gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
            gl.linkProgram(prog)
            if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                hasGL = true
                gl.useProgram(prog)
                // prettier-ignore
                const verts = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1])
                // prettier-ignore
                const uvs = new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1])
                posBuf = gl.createBuffer()
                gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
                gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
                const aPos = gl.getAttribLocation(prog, "position")
                gl.enableVertexAttribArray(aPos)
                gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
                uvBuf = gl.createBuffer()
                gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
                gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
                const aUv = gl.getAttribLocation(prog, "uv")
                gl.enableVertexAttribArray(aUv)
                gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
                uTime = gl.getUniformLocation(prog, "uTime")
                uResolution = gl.getUniformLocation(prog, "uResolution")
                uEdgeWidth = gl.getUniformLocation(prog, "uEdgeWidth")
                uNoiseSpeed = gl.getUniformLocation(prog, "uNoiseSpeed")
                uGrainScale = gl.getUniformLocation(prog, "uGrainScale")
                uGrainAmount = gl.getUniformLocation(prog, "uGrainAmount")
                tex = gl.createTexture()
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
            }
        }
        canvas.style.opacity = hasGL ? "1" : "0"
        fallback.style.opacity = hasGL ? "0" : "1"

        // -- media ---------------------------------------------------------
        let loaded: HTMLImageElement[] = []
        let mediaKey = ""
        const buildMedia = () => {
            mediaKey = propsRef.current.mediaKey
            loaded = propsRef.current.images.map((src) => {
                const img = new Image()
                img.crossOrigin = "anonymous"
                img.src = src
                return img
            })
        }
        buildMedia()

        // -- sizing --------------------------------------------------------
        let vw = 1
        let vh = 1
        let dpr = 1
        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2)
            vw = Math.max(1, host.clientWidth)
            vh = Math.max(1, host.clientHeight)
            const bw = Math.round(vw * dpr)
            const bh = Math.round(vh * dpr)
            for (const c of [canvas, fallback, strip]) {
                c.width = bw
                c.height = bh
            }
            if (gl && hasGL) gl.viewport(0, 0, bw, bh)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(host)

        // -- interaction ----------------------------------------------------
        let scrollX = 0
        let snapAnim: { stop: () => void } | null = null
        const stopSnap = () => {
            snapAnim?.stop()
            snapAnim = null
        }
        let targetX = 0
        let snapTimer = 0
        let itemWidth = 1
        let centerOffset = 0
        const drag = { active: false, id: -1, last: 0, x0: 0, y0: 0, click: true }

        const onDown = (e: PointerEvent) => {
            drag.active = true
            stopSnap()
            drag.id = e.pointerId
            drag.last = e.clientX
            drag.x0 = e.clientX
            drag.y0 = e.clientY
            drag.click = true
        }
        const onMove = (e: PointerEvent) => {
            if (!drag.active || e.pointerId !== drag.id) return
            targetX -= (e.clientX - drag.last) * propsRef.current.dragGain
            drag.last = e.clientX
            snapTimer = 0
            if (
                Math.abs(e.clientX - drag.x0) > CLICK_SLOP ||
                Math.abs(e.clientY - drag.y0) > CLICK_SLOP
            )
                drag.click = false
        }
        const onUp = (e: PointerEvent) => {
            if (!drag.active || e.pointerId !== drag.id) return
            drag.active = false
            if (!loaded.length || itemWidth <= 0) return
            const current = Math.round((targetX + centerOffset) / itemWidth)
            if (drag.click) {
                const clickX = e.offsetX
                const steps = Math.round((clickX - vw / 2) / itemWidth)
                targetX = (current + steps) * itemWidth - centerOffset
                snapTimer = 0
            } else if (propsRef.current.mode === "snap") {
                targetX = current * itemWidth - centerOffset
            }
        }
        const onWheel = (e: WheelEvent) => {
            if (propsRef.current.mode === "smooth")
                targetX += e.deltaX || e.deltaY
        }
        host.addEventListener("pointerdown", onDown)
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        host.addEventListener("wheel", onWheel, { passive: true })

        // -- loop -----------------------------------------------------------
        let raf = 0
        let last = performance.now()
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = Math.min((now - last) / 1000, 0.1)
            last = now
            const c = propsRef.current

            if (c.mediaKey !== mediaKey) buildMedia()

            const drawW = c.cardWidth
            const drawH = c.cardHeight
            itemWidth = drawW + c.gap
            const total = Math.max(1, loaded.length * itemWidth)
            centerOffset = (vw - drawW) / 2
            const roundedPct = c.rounded
            const edge = (drawW / vw) * c.edgeWidth

            if (!drag.active && loaded.length && Number.isFinite(c.snapInterval)) {
                if (c.mode === "smooth") {
                    targetX += c.smoothRate * dt
                } else if (Number.isFinite(c.snapInterval)) {
                    snapTimer += dt
                    if (snapTimer >= c.snapInterval) {
                        const current = Math.round(
                            (targetX + centerOffset) / itemWidth
                        )
                        targetX = (current + 1) * itemWidth - centerOffset
                        snapTimer = 0
                        const from = scrollX
                        const delta = targetX - from
                        stopSnap()
                        snapAnim = animate(0, 1, {
                            ...transitionRef.current,
                            onUpdate: (p: number) => {
                                scrollX = from + delta * p
                            },
                            onComplete: () => {
                                snapAnim = null
                            },
                        })
                    }
                }
            }

            if (!snapAnim) {
                const lf = 1 - Math.pow(1 - c.damping, dt * 60)
                scrollX += (targetX - scrollX) * lf
            }

            let visualScale = 1
            if (c.mode === "snap" && c.zoom > 0) {
                const nearest =
                    Math.round((scrollX + centerOffset) / itemWidth) *
                        itemWidth -
                    centerOffset
                let ratio = Math.min(
                    Math.abs(scrollX - nearest) / (itemWidth / 2),
                    1
                )
                ratio = ratio * ratio * (3 - 2 * ratio)
                visualScale = 1 - ratio * c.zoom
            }

            // --- compose the strip ---------------------------------------
            if (stripCtx) {
                stripCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
                stripCtx.clearRect(0, 0, vw, vh)
                if (loaded.length) {
                    stripCtx.save()
                    if (visualScale !== 1) {
                        stripCtx.translate(vw / 2, vh / 2)
                        stripCtx.scale(visualScale, visualScale)
                        stripCtx.translate(-vw / 2, -vh / 2)
                    }
                    const y = (vh - drawH) / 2
                    let wrapped = scrollX % total
                    if (wrapped < 0) wrapped += total
                    let x = -wrapped
                    const leftBound = -vw * 1.5
                    const rightBound = vw * 2.5
                    while (x < rightBound) {
                        for (let i = 0; i < loaded.length; i++) {
                            const px = x + i * itemWidth
                            if (px + drawW > leftBound && px < rightBound)
                                drawCover(
                                    stripCtx,
                                    loaded[i],
                                    px,
                                    y,
                                    drawW,
                                    drawH,
                                    roundedPct
                                )
                        }
                        x += total
                    }
                    stripCtx.restore()
                }
            }

            // --- edge pass ------------------------------------------------
            if (gl && hasGL) {
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    strip
                )
                gl.clearColor(0, 0, 0, 0)
                gl.clear(gl.COLOR_BUFFER_BIT)
                gl.uniform1f(uTime, now * 0.001)
                gl.uniform2f(uResolution, canvas.width, canvas.height)
                gl.uniform1f(uEdgeWidth, edge)
                gl.uniform1f(uNoiseSpeed, c.noiseSpeed)
                gl.uniform1f(uGrainScale, c.grainScale)
                gl.uniform1f(uGrainAmount, c.grainAmount)
                gl.drawArrays(gl.TRIANGLES, 0, 6)
            } else {
                const fb = fallback.getContext("2d")
                if (fb) {
                    fb.setTransform(1, 0, 0, 1, 0, 0)
                    fb.clearRect(0, 0, fallback.width, fallback.height)
                    fb.drawImage(strip, 0, 0)
                }
            }
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            stopSnap()
            ro.disconnect()
            host.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            host.removeEventListener("wheel", onWheel)
            if (gl && hasGL) {
                if (tex) gl.deleteTexture(tex)
                if (posBuf) gl.deleteBuffer(posBuf)
                if (uvBuf) gl.deleteBuffer(uvBuf)
                if (prog) gl.deleteProgram(prog)
            }
        }
    }, [])

    return (
        <div
            {...rest}
            ref={hostRef}
            style={{
                width: "100%",
                height: "100%",
                minWidth: 1200,
                minHeight: 800,
                position: "relative",
                overflow: "hidden",
                isolation: "isolate",
                cursor: "pointer",
                touchAction: "none",
                background,
                ...style,
            }}
        >
            <canvas
                ref={glCanvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                }}
            />
            {/* WebGL 不可用时显示的纯 2D 图带。 */}
            <canvas
                ref={fallbackRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

GrainyCarousel.displayName = "Grainy Carousel"

const __originkitPresetProps = {};

export default function GrainyCarousel(props: Record<string, unknown>) {
    return (
        <__OriginkitBase_GrainyCarousel
            {...(__originkitPresetProps as Record<string, unknown>)}
            {...props}
        />
    )
}