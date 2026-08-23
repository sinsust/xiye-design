import { getKnowledgeEntries } from "@/lib/knowledge";
import { KnowledgeBrowser } from "@/components/knowledge-browser";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const entries = getKnowledgeEntries();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          知识库
        </h1>
        <p className="mt-2 text-muted-foreground">
          汇集产品、工程与设计相关的参考资料、技能与范式，供搭建时随时查阅。点击「查看条目」阅读
          frontmatter 与完整正文；如需扩充，可在右上角「新增条目」上传自己的素材。
        </p>
      </div>
      <KnowledgeBrowser entries={entries} />
    </div>
  );
}
