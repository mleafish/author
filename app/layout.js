'use client';

import "./globals.css";
import { useEffect, useState } from "react";

// 内联脚本：在 HTML 解析阶段同步读取 theme，避免 hydration 不匹配和闪烁
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('author-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    var v = localStorage.getItem('author-visual');
    if (v) document.documentElement.setAttribute('data-visual', v);
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>Author - AI辅助创作平台</title>
        <meta name="description" content="面向小说创作者的AI辅助写作工具，让创作更自由" />
        <link
          rel="stylesheet"
          href="/katex/katex.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
