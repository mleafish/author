## 📋 本次焕新简报 / Release Overview

在本次更新中，我们重点对应用的外部部署环境（特别是如 Vercel 等 Serverless 平台）的兼容性做出了关键修复，同时优化了发版构建的脚本链路，确保版本控制更加严谨。

### 🇨🇳 中文更新概览

- 🛡️ **云端只读部署环境 500 熔断机制**：修复了当应用部署在 Vercel 等无写入权限的 Serverless 环境下时，频繁调用 `/api/storage` 导致的不断抛出 `500 Server Error` 错误。系统现在会智能通过 POST 探针感知环境读写权限，并在服务端触发拦截时立刻绕开 API，优雅降级回 IndexedDB 或 Firebase，彻底根绝同步状态死循环。
- 🔧 **构建链标题去重规范化**：修复了在触发 GitHub Actions 自动发版构建期间，系统无法识别手写包含重叠版本号的自定义前缀，从而导致像 `Author v1.2.8 — Author v1.2.7...` 等“俄罗斯套娃”式废话标题。现在底层已加入 Node.js 正则防呆拦截代码。
- 📦 **强化发版审计指南**：全站更新工作流规范说明。针对每一次 GitHub Tag 发版新增强制手撸更新日志节点，减少因复制粘贴疏忽产生的文档残留。

📦 点击下方 `.exe` 直链下载，无需繁琐配置，双击运行即可开启您的零干涉心流创作。

---

### 🇺🇸 English Release Notes

In this update, we made key reliability fixes targeting external deployment environments (specifically Serverless platforms like Vercel with strict filesystem permissions) and refined the internal CI/CD release logging mechanism to curb layout oversights.

- 🛡️ **Serverless Environment API Loop Circuit Breaker:** Resolved a critical recursive synchronization bug where hosting environments without explicit write capabilities (such as Vercel) caused the front-end to spam the `/api/storage` endpoint with continuously failing `500 Server Error` signals. The system now utilizes a smart POST-ping mechanism capable of diagnosing read-only environments locally, bypassing storage APIs immediately, and gracefully falling back to IndexedDB or Firebase without stalling.
- 🔧 **Automated Release Notes Title Normalization:** Addressed an annoying GitHub Action automation quirk causing redundant release title injections containing stacked version prefixes (e.g., `Author v1.2.8 — Author v1.2.7...`). The deployment script now leverages rigorous regex-based sanitization in Node.js to enforce single unified release headers.
- 📦 **Strengthened Publishing Guidelines:** Heavily revamped internal workspace release flow. The release workflow is now fortified with explicit checkpoints enforcing manually-drafted update briefs per version to combat un-updated residual files persisting into final builds.

📦 Simply grab the `.exe` installer right below and run it directly. Cloud sync engine is already packed nicely inside.
