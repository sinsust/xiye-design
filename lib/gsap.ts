// GSAP 集中注册（builder 动画引擎唯一事实源）。
// GSAP 自 Webflow 收购后全插件免费（含原 Club 的 SplitText / MorphSVG /
// Inertia / DrawSVG / ScrambleText / MotionPath / ScrollSmoother），从公共
// npm 包安装即可，无需 token / 私有源。
//
// 所有用到 GSAP 的模块都从这里 import 已注册好的 gsap / useGSAP，
// 不要再单独 registerPlugin，避免重复注册与 SSR 顺序问题。

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(
  useGSAP,
  ScrollTrigger,
  Flip,
  Draggable,
  InertiaPlugin,
  DrawSVGPlugin,
  SplitText,
  ScrambleTextPlugin,
  MotionPathPlugin,
);

export { gsap, ScrollTrigger, Flip, Draggable, InertiaPlugin, DrawSVGPlugin, SplitText, ScrambleTextPlugin, MotionPathPlugin, useGSAP };
