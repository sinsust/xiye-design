"use client";

// Gradient Text — 渐变流光字
// 文字以渐变填充，渐变背景在其后匀速流动（流光扫动）。支持多档流动方向
// （横向 / 上下 / 交替），速度、角度、渐变色与字体可调。appear 触发默认为进入即显。
// 依赖 framer-motion 的 useAnimate + motion 元素驱动渐变位移。
// 参考原点：Originkit AuroraText。

import { useEffect, useRef, useCallback, useMemo } from "react";
import { motion, useAnimate, type Transition } from "framer-motion";

const TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span"] as const;

interface AuroraTextFont {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  lineHeight?: string | number;
  letterSpacing?: string | number;
  textAlign?: "left" | "right" | "center" | "justify";
}

interface AuroraTextProps {
  text?: string;
  font?: AuroraTextFont;
  tag?: (typeof TAGS)[number];
  colors?: string[];
  angle?: number;
  speed?: number;
  direction?: "left" | "right" | "alternate" | "top-to-bottom" | "bottom-to-top";
}

const DEFAULT_FONT: AuroraTextFont = {
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: 120,
  lineHeight: "1.5em",
  letterSpacing: "0em",
  textAlign: "left",
};

const SPREAD = 200;
const START_OPACITY = 100; // 进入即显（100% 透明度），去掉淡入淡出可测性

function __OriginkitBase_AuroraText(props: AuroraTextProps) {
  const {
    text = "GRADIENT TEXT",
    font = DEFAULT_FONT,
    tag = "h1",
    colors = ["#FA6D0F", "#57F2AC"],
    angle = 135,
    speed = 5,
    direction = "alternate",
  } = props;

  const [scope, animate] = useAnimate();
  const hoverFiredRef = useRef(false);

  const isVertical = direction === "top-to-bottom" || direction === "bottom-to-top";

  const gradient = useMemo(() => {
    const list = (colors ?? []).filter(Boolean);
    if (list.length === 0) return "linear-gradient(135deg, #FA6D0F, #57F2AC)";

    let stops = list;
    if (isVertical) {
      stops = [...list, ...list.slice().reverse()];
    } else {
      stops = list.length === 1 ? [list[0], list[0]] : [...list, list[0]];
    }

    const effectiveAngle =
      direction === "top-to-bottom" ? 180 : direction === "bottom-to-top" ? 0 : angle;

    return `linear-gradient(${effectiveAngle}deg, ${stops.join(", ")})`;
  }, [colors, angle, direction, isVertical]);

  useEffect(() => {
    if (!scope.current) return;

    let bgFrames: string[];
    if (direction === "left") {
      bgFrames = ["0% 50%", `-${SPREAD}% 50%`];
    } else if (direction === "right") {
      bgFrames = ["0% 50%", `${SPREAD}% 50%`];
    } else if (direction === "top-to-bottom") {
      bgFrames = ["50% 0%", `50% -${SPREAD}%`];
    } else if (direction === "bottom-to-top") {
      bgFrames = ["50% 0%", `50% ${SPREAD}%`];
    } else {
      bgFrames = ["0% 50%", `${SPREAD / 2}% 50%`];
    }

    const repType = direction === "alternate" ? "mirror" : "repeat";

    const controls = animate(
      scope.current,
      { backgroundPosition: bgFrames },
      {
        duration: 20 / speed,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: repType,
      } as any
    );
    return () => controls.stop();
  }, [animate, scope, speed, gradient, direction]);

  const fontStyles = (font ?? {}) as React.CSSProperties;
  const safeTag = (TAGS as readonly string[]).includes(tag) ? tag : "h1";
  const Tag = motion[safeTag] as any;

  void hoverFiredRef;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent:
          fontStyles.textAlign === "right"
            ? "flex-end"
            : fontStyles.textAlign === "center"
              ? "center"
              : "flex-start",
        overflow: "visible",
      }}
    >
      <Tag
        ref={scope}
        style={{
          margin: 0,
          display: "inline-block",
          whiteSpace: "pre-wrap",
          ...fontStyles,
          backgroundImage: gradient,
          backgroundSize: isVertical ? `auto ${SPREAD}%` : `${SPREAD}% auto`,
          backgroundPosition: isVertical ? "50% 0%" : "0% 50%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          opacity: START_OPACITY / 100,
          willChange: "background-position, opacity",
        }}
      >
        {text}
      </Tag>
    </div>
  );
}

const COMPONENT_DEFAULTS: AuroraTextProps = {
  text: "GRADIENT TEXT",
  font: {
    fontSize: 90,
    textAlign: "center",
    fontFamily: "Inter",
    fontWeight: 800,
    lineHeight: "1em",
    letterSpacing: "0em",
  },
  colors: ["#FA6D0F", "#57F2AC"],
};

export default function AuroraText(props: AuroraTextProps) {
  return <__OriginkitBase_AuroraText {...COMPONENT_DEFAULTS} {...props} />;
}