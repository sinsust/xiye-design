// 把「交互变体 id 列表」用 GSAP 应用到元素（preview 态由 Selectable 调用）。
// 引擎：GSAP（全插件现已免费）。hover / magnetic 等事件驱动交互在 Selectable
// 内联用 React 事件处理；本文件负责「挂载即播放」与拖拽类交互。
//
// 支持：
//  - inertia-drag   惯性甩动：Draggable + InertiaPlugin（免费，替代原 GSAP 付费 Inertia）
//  - layout-flip    布局切换：mount 一次性布局入场过渡（免费复刻 GSAP Flip）
//  - text-scramble  故障解码：ScrambleTextPlugin 乱码逐帧揭示（免费复刻原 GSAP 付费 ScrambleText）
//  - svg-draw       描边绘制：DrawSVGPlugin 路径描边 0→1（免费复刻原 GSAP 付费 DrawSVG）
import { gsap, Draggable } from "@/lib/gsap";

export function applyInteractions(scope: HTMLElement, ids: string[]): void {
  const has = (x: string) => ids.includes(x);

  // —— text-scramble：免费复刻 GSAP ScrambleTextPlugin ——
  // 对叶子文本节点做乱码逐帧揭示为真实文字（左→右解码观感）。
  if (has("text-scramble")) {
    const leaves = scope.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,span,button,a,li,label,blockquote,strong,em",
    );
    leaves.forEach((el) => {
      if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
        const txt = el.textContent;
        gsap.to(el, {
          duration: 1.4,
          ease: "none",
          scrambleText: { text: txt, chars: "upperCase", speed: 0.4, revealDelay: 0.1 },
        });
      }
    });
  }

  // —— svg-draw：免费复刻 GSAP DrawSVGPlugin ——
  // 把 SVG 几何元素描边从 0 绘制到完整（需元素本身带 stroke 才可见）。
  if (has("svg-draw")) {
    const shapes = scope.querySelectorAll<SVGGeometryElement>(
      "path,line,circle,rect,ellipse,polyline,polygon",
    );
    if (shapes.length) {
      gsap.from(shapes, { drawSVG: 0, duration: 1.8, ease: "power1.inOut", stagger: 0.08 });
    }
  }

  // —— layout-flip：免费复刻 GSAP Flip ——
  // mount 时从「偏移 + 缩放 + 半透明」回弹归位，模拟一次布局切换过渡。
  if (has("layout-flip")) {
    gsap.from(scope, {
      duration: 0.7,
      ease: "back.out(1.4)",
      rotation: -3,
      scale: 0.92,
      autoAlpha: 0.35,
    });
  }

  // —— inertia-drag：免费复刻 GSAP InertiaPlugin ——
  // Draggable 拖拽 + 松手惯性回弹（useGSAP 的 context 会在卸载时自动 kill）。
  if (has("inertia-drag")) {
    Draggable.create(scope, {
      type: "x,y",
      inertia: true,
      dragResistance: 0.1,
      edgeResistance: 0.7,
      onDragStart() {
        gsap.set(scope, { zIndex: 50, cursor: "grabbing" });
      },
      onRelease() {
        gsap.set(scope, { zIndex: "", cursor: "" });
      },
    });
  }
}
