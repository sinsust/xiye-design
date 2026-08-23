const LINK_ITEMS = [
  { key: "1688", prop: "url1688" as const, label: "1688" },
  { key: "tangbuy", prop: "urlTangbuy" as const, label: "大店" },
  { key: "admin", prop: "urlAdmin" as const, label: "Admin" },
  { key: "ti", prop: "urlTi" as const, label: "TI" },
];

export function ProductExternalLinks({
  url1688,
  urlTangbuy,
  urlAdmin,
  urlTi,
  className = "",
}: {
  url1688?: string;
  urlTangbuy?: string;
  urlAdmin?: string;
  /** Admin 按 TI 子单号搜索；有关联 TI 时展示 */
  urlTi?: string;
  className?: string;
}) {
  const hrefByProp = {
    url1688,
    urlTangbuy,
    urlAdmin,
    urlTi,
  } as const;

  const links = LINK_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    href: hrefByProp[item.prop],
  })).filter((item): item is { key: string; label: string; href: string } => Boolean(item.href));

  if (links.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${className}`.trim()}>
      {links.map((item, index) => (
        <span key={item.key} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-zinc-300">·</span> : null}
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1e4d5c] hover:underline"
          >
            {item.label}
          </a>
        </span>
      ))}
    </span>
  );
}
