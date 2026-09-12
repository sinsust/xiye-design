// Dotted Offset Button — Originkit（点线偏移按钮）

"use client"

import * as React from "react"
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { useAnimate, useReducedMotion, type Transition } from "motion/react"

const radiusFromPercent = (w: number, h: number, pct: number) =>
    (Math.min(w, h) / 2) * (Math.max(0, Math.min(100, pct)) / 100)

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect

const borderColorOf = (b: any): string => b?.borderColor ?? "transparent"

const borderBoxOf = (b: any): React.CSSProperties => {
    if (!b) return {}
    const { borderColor, ...rest } = b as Record<string, any>
    return rest as React.CSSProperties
}

const DEFAULT_TRANSITION: Transition = {
    mass: 1,
    type: "spring",
    damping: 25,
    stiffness: 400,
}

export type IconConfig = {
    type?: "symbol" | "image"
    symbol?: string
    image?: string | { src?: string; srcSet?: string; alt?: string }
    color?: string
    hoverColor?: string
    size?: number
    padding?: number
    rounded?: number
    side?: "left" | "right"
}

export type HoverConfig = {
    fill?: string
    textColor?: string
    borderColor?: string
    rounded?: number
    offsetX?: number
    offsetY?: number
}

export type ShadowConfig = {
    color?: string

    side?: "left" | "right"
    distance?: number
}

export type Colors = {
    fill?: string
    textColor?: string
    hoverFill?: string
    hoverTextColor?: string
}

export type BorderConfig = {
    borderColor?: string
    borderStyle?: "solid" | "dashed" | "dotted" | "double"
    borderWidth?: number | string
    borderTopWidth?: number | string
    borderRightWidth?: number | string
    borderBottomWidth?: number | string
    borderLeftWidth?: number | string
}

export type DottedOffsetButtonProps = {
    label?: string
    font?: Record<string, any>
    showText?: boolean
    padding?: string
    rounded?: number
    fill?: string
    textColor?: string
    colors?: Colors
    addIcon?: boolean
    icon?: IconConfig
    gap?: number
    border?: BorderConfig
    hover?: HoverConfig
    shadow?: ShadowConfig

    hoverRounded?: number
    hoverBorderColor?: string
    shadowColor?: string
    shadowSide?: "left" | "right"
    shadowDistance?: number
    link?: string
    transition?: Transition
    newTab?: boolean
    style?: React.CSSProperties
}

export default function DottedOffsetButton(props: DottedOffsetButtonProps) {
    const {
        label = "DOTTED OFFSET",
        font = {
            variant: "Regular",
            fontSize: 40,
            textAlign: "left",
            fontFamily: "Inter",
            fontWeight: 500,
            lineHeight: "1.5em",
            letterSpacing: "0em",
        },
        showText = true,
        padding = "40px 64px 40px 64px",
        rounded = 32,
        fill: fillProp,
        textColor: textColorProp,
        colors = {
            fill: "#000000",
            hoverFill: "#000000",
            textColor: "#FFFFFF",
            hoverTextColor: "#FFFFFF",
        },
        addIcon = false,

        icon = {
            side: "left",
            size: 24,
            type: "symbol",
            color: "#FFFFFF",
            image: "",
            symbol: "→",
            padding: 0,
            rounded: 0,
            hoverColor: "#FC731C",
        },
        gap = 12,
        border = {
            borderColor: "#FFFFFF",
            borderStyle: "dashed",
            borderWidth: 2,
        },
        hover = {
            offsetX: 14,
            offsetY: 14,
            rounded: 25,
            borderColor: "#FFFFFF",
        },
        shadow = { color: "#00FF99" },
        hoverRounded: hoverRoundedLegacy,
        hoverBorderColor: hoverBorderColorLegacy,
        shadowColor: shadowColorLegacy,
        shadowSide: shadowSideLegacy,
        shadowDistance: shadowDistanceLegacy,
        link = "",
        transition = DEFAULT_TRANSITION,
        newTab = false,
        style,
    } = props

    const fill = colors?.fill ?? fillProp ?? "#000000"
    const textColor = colors?.textColor ?? textColorProp ?? "#FFFFFF"
    const restBorderColor = borderColorOf(border)

    const {
        fill: hoverFill = colors?.hoverFill ?? "#000000",
        textColor: hoverTextColor = colors?.hoverTextColor ?? "#FFFFFF",
        borderColor: hoverBorderColor = hoverBorderColorLegacy ??
            restBorderColor,
        rounded: hoverRounded = hoverRoundedLegacy ?? 25,
        offsetX: hoverOffsetX,
        offsetY: hoverOffsetY,
    } = hover

    const {
        color: shadowColor = shadowColorLegacy ?? "#FC731C",
        side: shadowSide = shadowSideLegacy ?? "right",
        distance: shadowDistance = shadowDistanceLegacy ?? 14,
    } = shadow

    const legacyDist = Math.max(0, Math.round(shadowDistance))
    const shadowX = Math.round(
        hoverOffsetX ?? (shadowSide === "left" ? -legacyDist : legacyDist)
    )
    const shadowY = Math.round(hoverOffsetY ?? legacyDist)

    const [scope, animate] = useAnimate()

    const [radiusBox, setRadiusBox] = useState({ w: 0, h: 0 })
    useIsoLayoutEffect(() => {
        const el = scope.current as HTMLElement | null
        if (!el) return
        const read = () =>
            setRadiusBox((prev) =>
                prev.w === el.offsetWidth && prev.h === el.offsetHeight
                    ? prev
                    : { w: el.offsetWidth, h: el.offsetHeight }
            )
        read()
        const ro = new ResizeObserver(read)
        ro.observe(el)
        return () => ro.disconnect()
    }, [scope])
    const radiusPx = radiusFromPercent(radiusBox.w, radiusBox.h, rounded)

    const hoverRadiusPx = radiusFromPercent(
        radiusBox.w,
        radiusBox.h,
        hoverRounded
    )

    const iconRef = useRef<HTMLSpanElement>(null)
    const hovered = useRef(false)
    const reducedMotion = useReducedMotion()

    const fontStyles = (font ?? {}) as React.CSSProperties

    const {
        type: iconKind = "symbol",
        symbol: iconSymbol = "→",
        image: iconImage,
        color: iconColor = "#FFFFFF",
        hoverColor: iconHoverColor = "#FC731C",
        size: iconSize = 24,
        padding: iconPaddingProp = 0,
        rounded: iconRounded = 0,
        side: iconSide = "left",
    } = icon

    const iconSrc =
        typeof iconImage === "string"
            ? iconImage
            : iconImage && iconImage.src
              ? iconImage.src
              : ""

    const iconMode = iconKind === "image" && iconSrc ? "image" : "symbol"
    const iconPx = Math.max(1, Math.round(iconSize))

    const iconPadPx = Math.max(0, Math.round(iconPaddingProp))

    const iconRadius = radiusFromPercent(iconPx, iconPx, iconRounded)
    const gapPx = Math.max(0, Math.round(gap))

    const iconEl = !addIcon ? null : iconMode === "image" ? (
        <img
            src={iconSrc}
            alt=""
            aria-hidden
            draggable={false}
            style={{
                width: iconPx,
                height: iconPx,
                margin: iconPadPx,

                objectFit: iconRadius > 0 ? "cover" : "contain",
                borderRadius: Math.min(iconRadius, iconPx / 2),
                display: "block",
                flex: "none",
                pointerEvents: "none",
            }}
        />
    ) : (
        <span
            ref={iconRef}
            aria-hidden
            style={{
                fontSize: iconPx,
                margin: iconPadPx,
                lineHeight: 1,
                color: iconColor,
                flex: "none",
                pointerEvents: "none",
            }}
        >
            {iconSymbol}
        </span>
    )

    const apply = useCallback(
        (toHover: boolean, instant: boolean) => {
            if (!scope.current) return
            const t: Transition =
                instant || reducedMotion ? { duration: 0 } : transition

            animate(
                scope.current,
                toHover
                    ? {
                          x: -shadowX,
                          y: -shadowY,
                          borderRadius: hoverRadiusPx,
                          backgroundColor: hoverFill,
                          color: hoverTextColor,
                          borderColor: hoverBorderColor,
                          boxShadow: `${shadowX}px ${shadowY}px 0px ${shadowColor}`,
                      }
                    : {
                          x: 0,
                          y: 0,
                          borderRadius: radiusPx,
                          backgroundColor: fill,
                          color: textColor,
                          borderColor: restBorderColor,
                          boxShadow: `0px 0px 0px ${shadowColor}`,
                      },

                t as any
            )
            if (iconRef.current)
                animate(
                    iconRef.current,
                    { color: toHover ? iconHoverColor : iconColor },
                    t as any
                )
        },
        [
            animate,
            scope,
            transition,
            reducedMotion,
            shadowX,
            shadowY,
            shadowColor,
            radiusPx,
            hoverRadiusPx,
            fill,
            hoverFill,
            textColor,
            hoverTextColor,

            restBorderColor,
            hoverBorderColor,
            iconColor,
            iconHoverColor,
        ]
    )

    useEffect(() => {
        apply(hovered.current, true)
    }, [apply])

    const onEnter = () => {
        hovered.current = true
        apply(true, false)
    }
    const onLeave = () => {
        hovered.current = false
        apply(false, false)
    }

    const onDown = () => apply(false, false)
    const onUp = () => apply(hovered.current, false)

    const isLink = typeof link === "string" && link.length > 0
    const Tag: any = isLink ? "a" : "button"
    const tagProps = {
        "aria-label": showText ? undefined : label || undefined,
        ...(isLink
            ? {
                  href: link,
                  target: newTab ? "_blank" : undefined,
                  rel: newTab ? "noopener noreferrer" : undefined,
              }
            :
              { type: "button" }),
    }

    return (
        <div
            style={{
                display: "inline-block",
                boxSizing: "border-box",
                paddingLeft: Math.max(0, shadowX),
                paddingTop: Math.max(0, shadowY),
                paddingRight: Math.max(0, -shadowX),
                paddingBottom: Math.max(0, -shadowY),
                ...style,
            }}
        >
            <Tag
                {...tagProps}
                onPointerEnter={onEnter}
                onPointerLeave={onLeave}
                onPointerDown={onDown}
                onPointerUp={onUp}
                style={{
                    display: "inline-flex",
                    width: "100%",
                    height: "100%",
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    textDecoration: "none",
                    cursor: "pointer",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                }}
            >
                <span
                    ref={scope}
                    style={{
                        display: "inline-block",
                        width: "100%",
                        padding,

                        ...borderBoxOf(border),
                        borderColor: restBorderColor,
                        borderRadius: radiusPx,
                        backgroundColor: fill,
                        boxSizing: "border-box",
                        whiteSpace: "nowrap",

                        ...fontStyles,
                        color: textColor,
                    }}
                >
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",

                            gap: iconEl && showText ? gapPx : 0,

                            flexDirection:
                                iconSide === "right" ? "row-reverse" : "row",
                        }}
                    >
                        {iconEl}
                        {showText && <span>{label}</span>}
                    </span>
                </span>
            </Tag>
        </div>
    )
}