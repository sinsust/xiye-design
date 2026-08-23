// 页面骨架工作台 · 数据模型（页面 → 区块组件 → 变体 三层）。
// 每个变体带：实时预览（由组件预览器渲染）+ 可复制 TSX 代码 + 实现提示词 + 交互说明。

export interface SkeletonVariant {
  id: string;
  name: string;
  description: string;
  tags: string[]; // 风格标签：居中 / 分屏 / 玻璃 / 渐变 / 深色…
  prompt: string; // 可复制的实现提示词（给 AI/开发参考）
  code: string; // 可复制的完整 TSX 代码片段
  interaction?: string; // 交互/动效说明
  /** 关联动效（引用 motion-library 变体 id，预览做示意动画） */
  motionId?: string;
}

export interface SkeletonComponent {
  id: string;
  name: string;
  icon: string; // lucide-react 图标名
  description: string;
  variants: SkeletonVariant[];
}

export interface SkeletonPage {
  id: string;
  name: string;
  icon: string; // lucide-react 图标名
  description: string;
  components: SkeletonComponent[];
}
