"use client";

// Direction Hover — 方向悬停字
// 文案在鼠标移入一侧（上 / 下）时，以强调色副本从该侧滑入，移出则滑回。
// 组件自持尺寸跟随文字，无边框、背景或内边距。基础文案始终可见。
// 钩住同一个数字（进入方向）的三张叠层副本，用 CSS transform 过渡滑动。
// 参考原点：Originkit Direction Hover，单文件零依赖。

import { useRef, useState } from "react"
import type { CSSProperties, MouseEvent } from "react"

const EASE_MAP: Record<string, string> = {
    linear: "linear",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
}

// 将 Framer Transition 对象转换为 CSS transition 字符串。spring 用过冲贝塞尔近似。
function transitionToCss(t: { type?: string; duration?: number; ease?: string | number[] }): string {
    const duration = (t && t.duration) || 0.4
    let ease = "cubic-bezier(0.22, 1, 0.36, 1)"
    if (t && t.ease) {
        if (Array.isArray(t.ease)) ease = `cubic-bezier(${(t.ease as number[]).join(", ")})`
        else if (EASE_MAP[t.ease as string]) ease = EASE_MAP[t.ease as string]
    } else if (t && t.type === "spring") {
        ease = "cubic-bezier(0.34, 1.56, 0.64, 1)"
    }
    return `transform ${duration}s ${ease}`
}

export interface DirectionHoverProps {
    title?: string
    font?: {
        fontSize?: number | string
        fontFamily?: string
        fontWeight?: number | string
        variant?: string
        letterSpacing?: string
        lineHeight?: string | number
    }
    gap?: number
    textColor?: string
    hoverColor?: string
    transition?: { type?: string; duration?: number; delay?: number; ease?: string | number[] }
    style?: CSSProperties
}

function __OriginkitBase_DirectionHover(props: DirectionHoverProps) {
    const { title, font, gap, textColor, hoverColor, transition, style } = props

    const ref = useRef<HTMLSpanElement>(null)
    // "none" = 静止，"top"/"bottom" = 从该侧进入
    const [dir, setDir] = useState<"none" | "top" | "bottom">("none")

    const onEnter = (e: MouseEvent) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const y = e.clientY - rect.top
        setDir(y < rect.height / 2 ? "top" : "bottom")
    }
    const onLeave = () => setDir("none")

    const fontObj = font || {}
    const rawSize = fontObj.fontSize
    const size = typeof rawSize === "string" ? parseFloat(rawSize) : rawSize || 24
    // 盒子裁剪到约大写字母高度，使 gap 0 时字形能相接（完整字体盒自带行距，会读出多余间隙）。
    const lineBox = size * 0.72
    // gap 滑杆 0–20 → 基础与强调副本之间的像素间距
    const gapPx = (gap || 0) * 3
    // 一次滑动步长 = 一个行盒 + 两副本间距
    const step = lineBox + gapPx

    // 三张叠层副本：[强调, 基础, 强调]，各一个行盒高。
    // 静止显示中间（基础）；悬停推移整个叠层一步，从进入侧露出强调副本。偏移用 px，
    // 因为 % 平移相对整个三层堆叠，而非单行。
    const yByDir = { none: -step, top: 0, bottom: -2 * step }

    const labelStyle: CSSProperties = {
        ...fontObj,
        margin: 0,
        whiteSpace: "pre",
        lineHeight: 1,
        height: lineBox,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
    }

    return (
        <span
            ref={ref}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            style={{
                ...style,
                position: "relative",
                display: "inline-block",
                overflow: "hidden",
                height: lineBox,
                cursor: "pointer",
                userSelect: "none",
            }}
        >
            <span
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: gapPx,
                    transform: `translateY(${yByDir[dir]}px)`,
                    transition: transitionToCss(transition ?? {}),
                }}
            >
                <span style={{ ...labelStyle, color: hoverColor }}>
                    {title}
                </span>
                <span style={{ ...labelStyle, color: textColor }}>{title}</span>
                <span style={{ ...labelStyle, color: hoverColor }}>
                    {title}
                </span>
            </span>
        </span>
    )
}

const COMPONENT_DEFAULTS = {
    title: "DIRECTION HOVER",
    font: {
        fontSize: 24,
        variant: "Bold",
        letterSpacing: "0em",
        lineHeight: "1em",
    },
    gap: 20,
    textColor: "#ffffff",
    hoverColor: "#6E92FF",
    transition: {
        type: "tween",
        duration: 0.3,
        delay: 0,
        ease: "easeInOut",
    },
}

export default function DirectionHover(props: DirectionHoverProps) {
    return <__OriginkitBase_DirectionHover {...COMPONENT_DEFAULTS} {...props} />
}