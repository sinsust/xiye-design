import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { FlowLeaveGuard } from "@/components/flow-leave-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "xiye · AI驱动的开发者资产平台",
  description: "AI驱动的开发者资产平台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* CJK 字体走运行时 Google CSS（dev Turbopack 对 next/font/google 的 CJK 有解析 bug）；
            latin 仍用 next/font 自托管 Geist */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* 主题初始化：hydration 前同步套 .dark + 主题预设，避免闪烁（FOUC）。
            读取 zustand persist 的 theme-preset-custom（{state:{activeStyleId,custom}}），
            去掉 aw- 前缀后写 data-theme-preset，使其命中预设 CSS；若有自定义覆盖则直接写 CSS 变量，
            保证首帧即为正确主题色，不再先走 :root 绿色兜底。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  function readId(key){var v=localStorage.getItem(key);if(!v)return null;try{var p=JSON.parse(v);var st=p&&p.state?p.state:(p&&p.activeStyleId?p:null);if(st&&st.activeStyleId)return st.activeStyleId;}catch(e){}if(v&&v!=="null")return v;return null;}
  var active=readId("theme-preset-custom")||readId("theme-preset")||"aw-brutalist";
  var custom={};var raw=localStorage.getItem("theme-preset-custom");if(raw){try{var p=JSON.parse(raw);var st=p&&p.state?p.state:(p&&p.activeStyleId?p:null);if(st&&st.custom)custom=st.custom;}catch(e){}}
  var themeAttr=active.replace(/^aw-/, "");
  document.documentElement.setAttribute("data-theme-preset",themeAttr);
  var ov=custom[active];
  if(ov&&Object.keys(ov).length){
    var el=document.documentElement;
    function parseHex(h){h=(h||"").trim().replace("#","");if(h.length===3)h=h.split("").map(function(c){return c+c;}).join("");if(!/^[0-9a-fA-F]{6}$/.test(h))return null;var n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255];}
    function mixHex(a,b,t){var ca=parseHex(a),cb=parseHex(b);if(!ca||!cb)return a;var r=Math.round(ca[0]*t+cb[0]*(1-t)),g=Math.round(ca[1]*t+cb[1]*(1-t)),bl=Math.round(ca[2]*t+cb[2]*(1-t));return "#"+[r,g,bl].map(function(v){return v.toString(16).padStart(2,"0");}).join("");}
    function pickReadable(bg,hint,op){var rgb=parseHex(bg);if(!rgb)return hint;var lum=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];var target=lum>140?"#0F172A":"#F5F5F5";return mixHex(hint,target,op);}
    if(ov.bg)el.style.setProperty("--background",ov.bg);
    if(ov.surface)el.style.setProperty("--surface",ov.surface);
    if(ov.text){el.style.setProperty("--foreground",pickReadable(ov.bg||"#ffffff",ov.text,0.95));el.style.setProperty("--muted-foreground",pickReadable(ov.bg||"#ffffff",ov.text,0.55));}
    if(ov.accent)el.style.setProperty("--primary",ov.accent);
    if(ov.accent2)el.style.setProperty("--secondary",ov.accent2);
    if(ov.accents){var seed=[ov.accent||"#000000",ov.accent2||"#000000"].concat(ov.accents);for(var i=0;i<6;i++)el.style.setProperty("--accent-"+(i+1),seed[i%seed.length]);}
  }
  var t=localStorage.getItem("theme");
  var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark",d);
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteNav />
        <main className="flex-1 w-full min-h-0">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-8">{children}</div>
        </main>
        <FlowLeaveGuard />
      </body>
    </html>
  );
}
