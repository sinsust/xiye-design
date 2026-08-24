"use client";
// 统一按钮资源：把三种 Originkit 交互按钮（水波 / 键帽 / 流光）收敛到同一份契约。
// 上层只关心 {@link ButtonResourceProps}；按 style 分发到各自组件并补齐 defaults。
import type { CSSProperties } from "react";
import WaterButton from "@/components/originkit/ui/water-button";
import KeycapButton from "@/components/originkit/ui/keycap-button";
import MovingGradientButton from "@/components/originkit/ui/moving-gradient-button";

export type ButtonResourceStyle = "water" | "keycap" | "moving";

export interface ButtonResourceProps {
  style?: ButtonResourceStyle;
  label?: string;
  link?: string;
  onClick?: () => void;
  /** 链接是否新标签打开（内链建议 false）；缺省 false */
  newTab?: boolean;
  /** 键帽的棱柱/高光色；空则用组件默认 */
  prismColor?: string;
  /** 水色；空则用组件默认 */
  waterColor?: string;
  /** 键帽/流光填充色 */
  fill?: string;
  textColor?: string;
  hoverTextColor?: string;
  rounded?: number;
  fontSize?: number;
  /** 键帽/流光的 padding 字符串（如 "10px 22px 10px 22px"）；缺省用各自组件默认 */
  padding?: string;
  className?: string;
}

export const BUTTON_RESOURCE_STYLES: { id: ButtonResourceStyle; name: string; description: string }[] = [
  { id: "water", name: "水波", description: "拨开的水面玻璃按钮" },
  { id: "keycap", name: "键帽", description: "等轴机械键盘质感" },
  { id: "moving", name: "流光", description: "常驻流动的动态渐变" },
];

export function buttonResourceName(style?: ButtonResourceStyle): string {
  return BUTTON_RESOURCE_STYLES.find((s) => s.id === style)?.name ?? "流光";
}

const BASE_LABEL = {
  fontFamily: "Inter, system-ui, sans-serif",
} as CSSProperties;

export default function ButtonResource(props: ButtonResourceProps) {
  const {
    style = "moving",
    label = "开始体验",
    link,
    onClick,
    newTab = false,
    prismColor,
    waterColor,
    fill,
    textColor,
    hoverTextColor,
    rounded,
    fontSize = 22,
    padding,
    className,
  } = props;

  const font: CSSProperties = {
    ...BASE_LABEL,
    fontWeight: 700,
    fontSize,
  };

  let node: React.ReactNode;
  if (style === "water") {
    node = (
      <WaterButton
        label={label}
        textColor={textColor ?? "#000000"}
        waterColor={waterColor}
        rounded={rounded ?? 100}
        font={font}
      />
    );
  } else if (style === "keycap") {
    node = (
      <KeycapButton
        label={label}
        colors={{
          fill: fill ?? "#16121D",
          textColor: textColor ?? "#A05CFF",
          hoverTextColor: hoverTextColor ?? "#FFFFFF",
        }}
        prism={{ color: prismColor ?? "#A05CFF" }}
        rounded={rounded ?? 45}
        padding={padding}
        font={font}
        link={link}
        newTab={link ? newTab : undefined}
      />
    );
  } else {
    node = (
      <MovingGradientButton
        label={label}
        colors={{
          fill: fill ?? "#000000",
          textColor: textColor ?? "#FFFFFF",
          hoverTextColor: hoverTextColor ?? "#CCC30E",
        }}
        rounded={rounded ?? 100}
        padding={padding}
        font={font}
        link={link}
        newTab={link ? newTab : undefined}
      />
    );
  }

  const cls = className ?? "";
  // 水波组件不接 link，需要外套 <a>；键帽/流光已自带 link，不再外包避免 <a> 嵌套。
  if (style === "water" && link) {
    return (
      <a href={link} className={cls} style={{ textDecoration: "none", display: "inline-flex" }}>
        {node}
      </a>
    );
  }
  if (onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={cls}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: "pointer", display: "inline-flex" }}
      >
        {node}
      </span>
    );
  }
  return <span className={cls}>{node}</span>;
}