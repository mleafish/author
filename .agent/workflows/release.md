---
description: 发版流程 — 提交代码、更新版本号、打 tag、推送触发自动构建
---

# 发版流程 / Release Workflow

## 前置安全检查

以下检查必须覆盖**一切**与计划、方案、敏感信息相关的文件，不限于固定列表。

// turbo
1. 检查 `.gitignore` 是否覆盖了敏感目录和文件类型：
```bash
cat .gitignore
```
确认以下类型均被忽略（如有遗漏需先补上）：
- 环境变量文件（`.env*`，`.env.local` 等）
- 日志文件（`*.log`，`firebase-debug.log` 等）
- 内部文档目录（`docs/`，`方案和计划文件/` 等）
- 密钥和凭证文件（`*secret*`，`*credential*`，`*.key`，`*.pem` 等）
- 构建产物（`dist/`，`.next/` 等）

// turbo
2. 全面扫描已追踪文件中是否有敏感文件：
```bash
git ls-files | findstr /i "secret credential key\.pem env\.local plan 方案 计划 doc 草稿 draft private internal debug\.log"
```
除 `.env.example`、`README` 类说明文档、源码中合理使用的文件外，不应有任何敏感文件。**发现可疑文件必须逐个核实。**

// turbo
3. 扫描本次改动中是否有密钥、API Key 或敏感信息泄露：
```bash
git diff -- . ":(exclude)package-lock.json" | findstr /i "api_key apikey secret_key token password credential private_key firebase_api sk- Bearer"
```
应该无匹配结果。如有匹配，必须逐条审查是否为真正的密钥泄露。

// turbo
4. 检查是否有不应提交的文件被暂存（重点关注非代码文件）：
```bash
git status --short
```

5. **【必须】向用户汇报安全检查结果**，包括：
   - `.gitignore` 是否完整覆盖敏感文件
   - 是否有意外追踪的敏感文件
   - diff 中是否存在密钥泄露
   - 本次待提交的文件清单
   - 任何可疑发现的详细说明
   等待用户确认通过后，才可继续后续步骤。

## 撰写发版文案（非常重要）

**【强制规范】每次推送代码前，都必须全面更新以下两个文件！**

6. **【必须】** 更新或创建 `RELEASE_NOTES.md`，用作 GitHub Release 的详细双语更新日志：
   - 梳理完整的中、英双语更新日志，内容涵盖**本版本与上一版本之间的所有改动**。
   - **常规版本升级**：总结新旧两个版本间的核心功能差异。
   - **紧急修复（版本号不变）**：不可覆盖已有日志！在现有内容基础上**追加**本次修复的简要说明。
   - 如果丢失了原文件结构，请沿用上一版的排版格式。

7. **【必须】** 更新或创建 `RELEASE_TITLE.txt`，用作 GitHub Release 的精简标题：
   - 根据上一步写好的详细日志，**提炼出一句话总结**。
   - **格式规范：必须采用 `中文标题 | 英文标题`（中间用竖线隔开）的结构。**
   - 示例：`修复了云端断网时的卡顿崩溃 | Fixed stuttering crash in offline cloud modes`
   - 注意：只写标题正文即可，**切勿带版本号前缀**（例如不要写 `Author vX.Y.Z — ...`，构建脚本会自动拼接版本号）。

> **⚠️ 紧急修复（版本号不变）的特殊流程：** 写完上述两个文件后，跳过下方的"更新版本号"步骤，直接进入"提交与推送"。打 tag 时使用 `git tag -f vX.Y.Z` 强制覆盖旧 tag，推送时使用 `git push origin vX.Y.Z -f`。

## 更新版本号

> 如果是不改版本号的紧急修复，跳过此步骤。

8. 更新 `package.json` 中的版本号（替换 `X.Y.Z` 为目标版本）：
```bash
npm version X.Y.Z --no-git-tag-version
```

## 提交与推送

9. 暂存并提交所有改动（包括文案与版本号）：
```bash
git add -A
git commit -m "vX.Y.Z: 简要描述本次更新内容"
```

10. 打 git tag（如果版本号不变则强制覆盖旧 tag）：
```bash
# 新版本号：
git tag vX.Y.Z

# 或版本号不变的紧急修复（强制覆盖）：
git tag -f vX.Y.Z
```

11. 推送代码和 tag（如果版本号不变则强制推送 tag）：
```bash
# 新版本号：
git push origin main && git push origin vX.Y.Z

# 或版本号不变的紧急修复（强制推送）：
git push origin main && git push origin vX.Y.Z -f
```

## 自动构建

推送 `v*` tag 后，GitHub Actions 会自动触发：

- **`electron-build.yml`**：构建 Windows `.exe` 安装包 → 创建 GitHub Release（双语格式）
- **`docker-publish.yml`**：Release 发布后自动构建 Docker 镜像 → 推送到 Docker Hub

构建进度：https://github.com/YuanShiJiLoong/author/actions

## 构建完成后

12. 去 [Releases 页面](https://github.com/YuanShiJiLoong/author/releases) 确认：
    - 安装包文件名版本号正确（如 `Author Setup X.Y.Z.exe`）
    - Release Notes 格式正确（双语）
    - 下载链接可用

13. （可选）下载 `.exe` 发到 QQ 群，或直接分享 Release 链接

## 注意事项

- **版本号来源**：安装包文件名读取 `package.json` 的 `version` 字段，不是 git tag。两者必须一致。
- **敏感文件**：`docs/`、`方案和计划文件/`、`.env`、`firebase-debug.log` 均被 `.gitignore` 忽略，不会进入 git 仓库和 Release 的 Source code 包。
- **Docker 安全**：Docker 使用多阶段构建，最终镜像只含构建产物（`.next/standalone`），不含源码和配置文件。
- **如果构建失败**：去 Actions 页面查看日志，修复后用 `git tag -f vX.Y.Z && git push origin vX.Y.Z -f` 强制更新 tag 重新触发。
