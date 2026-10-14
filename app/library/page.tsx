import { loadKnowledgeEntries } from "@/lib/knowledge";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { KnowledgeBrowserFromClient } from "@/components/knowledge-browser-client";
import { isBrowserDataMode } from "@/lib/deploy-mode";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  // 浏览器数据层走客户端取数：服务端在这里既没有 knowledge/ 目录也没有可写的本地库，
  // 硬扫只会静默得到空列表 —— 那等于把内置知识库删了，所以换成读构建期快照 + 本机库。
  const body = isBrowserDataMode() ? (
    <KnowledgeBrowserFromClient />
  ) : (
    <KnowledgeBrowser entries={await loadKnowledgeEntries()} />
  );

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
      {body}
    </div>
  );
}
