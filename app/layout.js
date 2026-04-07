'use client';

import "./globals.css";
import { useEffect, useState } from "react";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { shouldEnableTelemetry } from './lib/desktop-runtime';

// 内联脚本：在 HTML 解析阶段同步读取 theme，避免 hydration 不匹配和闪烁
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('author-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    var v = localStorage.getItem('author-visual');
    if (v) document.documentElement.setAttribute('data-visual', v);
    var bg = localStorage.getItem('author-writing-background');
    if (bg) {
      var parsed = JSON.parse(bg);
      var isLegacy = parsed && (Object.prototype.hasOwnProperty.call(parsed, 'type') || Object.prototype.hasOwnProperty.call(parsed, 'color') || Object.prototype.hasOwnProperty.call(parsed, 'image'));
      var canvas = isLegacy ? parsed : (parsed && parsed.canvas) || {};
      var page = isLegacy ? {} : (parsed && parsed.page) || {};
      var canvasColor = typeof canvas.color === 'string' && canvas.color ? canvas.color : 'var(--bg-canvas)';
      var canvasImage = canvas.type === 'image' && typeof canvas.image === 'string' && canvas.image ? 'url("' + canvas.image.replace(/"/g, '\\"') + '")' : 'none';
      var canvasSize = canvas.size === 'contain' || canvas.size === '100% auto' ? canvas.size : 'cover';
      var pageColor = typeof page.color === 'string' && page.color ? page.color : 'var(--bg-editor)';
      var pageImage = page.type === 'image' && typeof page.image === 'string' && page.image ? 'url("' + page.image.replace(/"/g, '\\"') + '")' : 'none';
      var pageSize = page.size === 'contain' || page.size === '100% auto' ? page.size : 'cover';
      document.documentElement.style.setProperty('--author-writing-bg', canvasColor);
      document.documentElement.style.setProperty('--author-writing-bg-image', canvasImage);
      document.documentElement.style.setProperty('--author-writing-bg-size', canvasSize);
      document.documentElement.style.setProperty('--author-page-bg', pageColor);
      document.documentElement.style.setProperty('--author-page-bg-image', pageImage);
      document.documentElement.style.setProperty('--author-page-bg-size', pageSize);
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  const telemetryEnabled = shouldEnableTelemetry();

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
        {telemetryEnabled ? <Analytics /> : null}
        {telemetryEnabled ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
