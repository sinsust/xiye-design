import { KnowledgeBrowserFromClient } from "@/components/knowledge-browser-client";

// 知识库列表改为纯客户端取数（Hobby 函数数削减：去掉 force-dynamic，本页静态预渲染）。
// KnowledgeBrowserFromClient 复用与原来一致的 KnowledgeBrowser 组件，通过 /api/knowledge
// 的 GET 汇总「内置只读条目 + 云端共享条目」，任何部署形态（服务端 / 浏览器数据层）数据都一致，
// 因此不再需要在服务端按 isBrowserDataMode() 分支预取。
export default function LibraryPage() {
  return (
    <div className="mx-auto xiye-container px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          知识库
        </h1>
        <p className="mt-2 text-muted-foreground">
          汇集产品、工程与设计相关的参考资料、技能与范式，供搭建时随时查阅。点击「查看条目」阅读
          frontmatter 与完整正文；如需扩充，可在右上角「新增条目」上传自己的素材。
        </p>
      </div>
      <KnowledgeBrowserFromClient />
    </div>
  );
}
