[English](README.md) | **简体中文**

# ✍️ Author — AI-Powered Creative Writing Platform

> AI 驱动的网文创作平台 | AI-Powered Web Novel Writing Studio

**Author** 是一款面向小说作者的 AI 辅助创作工具。它将专业的富文本编辑器、智能 AI 写作助手和完整的世界观管理系统整合在一起，为创作者提供一站式写作体验。

🌐 **在线体验**：[author-delta.vercel.app](https://author-delta.vercel.app)

📦 **Gitee 镜像（国内加速）**：[gitee.com/yuanshijilong/author](https://gitee.com/yuanshijilong/author)

---

## 💬 为什么做这个项目

我使用 AI 已经有一段日子了，各家公司的模型基本上都用过——从最开始的 ChatGPT 3.5，到 Gemini 2.0 Exp Thinking，接着从 ChatGPT o1 时代之后，彻底转入 Gemini 2.5 Pro Thinking。

我本人是写小说的，对 AI 的文字能力比较看重。小说的文本很长，因此我对模型的上下文以及召回率有很高的要求。当然，Gemini 最触动我的点还是祂笔下的人物——总会有那么一瞬间，让我有种想要落泪的冲动。这是情感共鸣。我需要这种接受了人类本身复杂性的文字。

然而，随着代码趋势的兴起，所有公司都开始往这个方向死磕。我本来觉得是好事，但当 Gemini 3.1 Pro 第一次将笔下的人物描述成生物学和心理学的术语时，我发现我错了——代码方向的模型将人类本身解构成一堆生物学零件。特别是 Claude Opus 4.6，这个模型笔下的所有人物都在某种心理学定义的性格里达成了极致的效率：说话言简意赅、惜字如金，不像人类，像个人机。

**我看不到模型对人类本身复杂性的理解。模型不在乎人类做了什么，只在乎人类是什么。模型不从人的行为去体现人的性格和情感，反而直接对人类本身下一个很简单的定义。**

我看到模型的通用性在被阉割。我不希望我们活在冰冷的代码世界。建立这个项目，是为了让 AI 能够在那些机械算符之外，**保留我们人类自己的语言**。

> 希望所有使用该项目的作者、编剧、爱好者，甚至读者、玩家，能够发挥自己的长处，创建出有人味儿的作品，保住我们自己语言的火种。🔥

---

## ✨ 核心功能

### 📝 专业编辑器
- 基于 **Tiptap** 的富文本编辑器，支持加粗、斜体、标题、列表、代码块等
- **Word 风格分页**排版，所见即所得
- **KaTeX** 数学公式支持
- 字体、字号、行距、颜色自定义
- 实时字数/字符/段落统计

### 🤖 AI 写作助手
- **多 AI 供应商**：智谱 GLM-4 / DeepSeek / OpenAI / Google Gemini / Claude / SiliconFlow / 火山引擎 / 阿里云百炼 / MiniMax / Moonshot + 自定义端点
- **智能模型拉取** — 一键从 API 拉取完整模型列表，自动兼容各种中转站格式（`/models`、`/v1/models`），超时保护不卡死
- **续写 / 改写 / 润色 / 扩写**，一键生成
- **Ghost Text** 流式预览 — 像 Cursor 一样实时显示 AI 生成内容，支持接受/拒绝
- **自由对话模式** — 与 AI 讨论剧情、角色、设定
- **上下文引擎** — AI 自动感知你的角色设定、世界观、前文，保持剧情连贯
- **API 格式切换** — 阿里云百炼和 MiniMax 同时支持 OpenAI 和 Anthropic 两种 API 格式

### 📚 设定集管理
- **树形结构**管理角色、地点、物品、大纲、写作规则
- 三种写作模式：**网文** / **传统文学** / **剧本**，每种模式有专属字段
- 分类配色 + glassmorphism 视觉风格
- 设定内容自动注入 AI 上下文

### 💾 数据管理
- **本地优先** — 所有数据存储在浏览器 IndexedDB，不上传服务器
- **快照系统** — 手动/自动版本存档，支持一键回滚
- **项目导入导出** — 完整项目 JSON 备份
- **多格式导出** — 导航栏一键导出本章或批量导出（TXT / Markdown / DOCX / EPUB / PDF）

### 🌐 国际化
- 🇨🇳 简体中文 / 🇺🇸 English / 🇷🇺 Русский

### 🎨 界面体验
- 护眼暖色调 / 深色模式切换
- 新手引导教程
- 帮助面板 + 快捷键说明

---

## 💻 桌面客户端

**无需安装 Node.js！** 直接下载安装包：

- 📥 [下载 Author 安装包（Windows）](https://github.com/YuanShiJiLoong/author/releases/latest)
- 💬 无法访问 GitHub？[加入 QQ 交流群：1087016949](https://qm.qq.com/q/wjRDkotw0E)，群文件中下载

安装即用，所有功能开箱即得。

> 💡 从源码构建桌面应用：`npm run build && npx electron-builder --win`

### 🐛 常见问题排查 / Debug 日志

如果您在打开软件时遇到持续白屏，或程序无法正常启动，请查看系统为您生成的本地 Debug 日志文件：
- **Windows 路径**：`C:\Users\<您的用户名>\AppData\Roaming\Author\author-debug.log`

*(按 `Win + R` 键，输入 `%APPDATA%\Author` 回车即可快速打开该文件夹查看日志)*

---

## 🚀 快速开始

### 环境要求
- **Node.js** 18+
- **npm** 9+ 或 **pnpm** 8+

### 安装

```bash
# 克隆仓库
git clone https://github.com/YuanShiJiLoong/author.git
# 国内用户推荐使用 Gitee 镜像（更快）
# git clone https://gitee.com/yuanshijilong/author.git
cd author

# 安装依赖
npm install
# 或使用 pnpm（无幽灵依赖问题）
# pnpm install
# pnpm approve-builds    # pnpm 需要手动激活原生构建包

# 配置环境变量（可选）
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Key
# 也可以在应用内「设置」面板中配置
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 生产构建

```bash
npm run build
npm start
```

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YuanShiJiLoong/author)

### ☁️ 云同步配置（自部署用户）

桌面客户端已内置云同步功能。如果你通过源码自部署，需要以下步骤启用登录和云同步：

#### 1. 创建 Firebase 项目

1. 前往 [Firebase 控制台](https://console.firebase.google.com/) → **创建项目**
2. 启用 **Authentication** → 登录方式 → **Google**
3. 创建 **Firestore Database**（生产模式）
4. 设置 Firestore 安全规则，限制每个用户只能访问自己的数据：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### 2. 配置环境变量

将 `.env.example` 复制为 `.env.local`，填入 Firebase 配置：

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=你的_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=你的项目.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=你的项目ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=你的项目.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=你的sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=你的app_id
```

> 这些值可在 Firebase 控制台 → 项目设置 → 常规 → 你的应用 → SDK 配置 中找到。

#### 3. Vercel 部署

在 **Vercel 控制面板 → 项目设置 → Environment Variables** 中添加相同的变量，然后重新部署。

> 💡 Firebase API Key 设计上就是公开的（客户端标识符）。数据安全由 Firebase Auth + Firestore 安全规则保障，而非隐藏 API Key。

---

## 🔄 更新

### 桌面客户端用户

前往 [Releases](https://github.com/YuanShiJiLoong/author/releases/latest) 页面下载最新版本安装包，覆盖安装即可。你的数据存储在浏览器/Electron 用户配置中，不会丢失。

> 💬 无法访问 GitHub？[加入 QQ 交流群：1087016949](https://qm.qq.com/q/wjRDkotw0E)，群文件中下载最新版本。

### 源码部署用户

#### 方式一：应用内一键更新

打开 **帮助面板 → 关于 → 检查更新**，点击「一键更新」即可自动执行 `git pull → npm install → npm run build`。

> ⚠️ **更新完成后必须重启服务才能生效**，应用内会显示重启步骤指引。

#### 方式二：手动更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如有新增）
npm install
# 或: pnpm install && pnpm approve-builds

# 3. 重新构建（生产模式需要）
npm run build

# 4. 重启服务
# 开发模式：先 Ctrl+C 停止，再启动
npm run dev

# 生产模式：先 Ctrl+C 停止，再启动
npm start

# 使用 PM2 管理：
pm2 restart author
```

> ⚠️ **只执行 `git pull` 而不重启服务，新版本不会生效。** Running 的 Node.js 进程仍然使用旧代码。

### Vercel 部署用户

如果你通过 Fork 部署到 Vercel，只需在 GitHub 上将你的 Fork 与上游同步（Sync fork），Vercel 会自动重新部署。

---

## ⚙️ AI 配置

Author 支持多种 AI 供应商，你可以通过 **环境变量** 或 **应用内设置** 来配置：

| 供应商 | 环境变量 | 获取 API Key |
|--------|---------|-------------|
| 智谱 AI (GLM-4) | `ZHIPU_API_KEY` | [open.bigmodel.cn](https://open.bigmodel.cn/) |
| Google Gemini（原生格式） | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Google Gemini（OpenAI 兼容） | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| DeepSeek | 应用内配置 | [platform.deepseek.com](https://platform.deepseek.com/) |
| OpenAI | 应用内配置 | [platform.openai.com](https://platform.openai.com/) |
| OpenAI Responses | 应用内配置 | [platform.openai.com](https://platform.openai.com/) |
| Claude (Anthropic) | `CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| SiliconFlow (硅基流动) | 应用内配置 | [siliconflow.cn](https://siliconflow.cn/) |
| 火山引擎 (豆包) | 应用内配置 | [console.volcengine.com](https://console.volcengine.com/) |
| Moonshot (Kimi) | 应用内配置 | [platform.moonshot.cn](https://platform.moonshot.cn/) |
| 自定义（OpenAI 兼容） | 应用内配置 | 任何 OpenAI 兼容端点 |
| 自定义（Gemini 格式） | 应用内配置 | 任何 Gemini 兼容端点 |
| 自定义（Claude 格式） | 应用内配置 | 任何 Claude 兼容端点 |

> 💡 **无需 API Key 也能使用**大部分编辑功能。AI 功能需要至少配置一个供应商。

---

## 🔍 联网搜索配置

Author 支持让 AI 联网搜索实时信息。不同供应商的搜索方式不同：

| 供应商 | 搜索方式 | 额外配置 |
|--------|---------|---------|
| Gemini（原生格式） | 内置 Google Search | 无需额外配置 |
| OpenAI / OpenAI Responses | 内置 Web Search | 无需额外配置（需搜索模型） |
| DeepSeek / 智谱 / 硅基 / 其他 | 外部搜索 API | **需配置搜索引擎 Key** |

对于不支持内置搜索的供应商，你需要选择一个搜索引擎并填入 API Key：

### Tavily（推荐，最简单）

1. 访问 [tavily.com](https://tavily.com)，注册账号
2. 登录后在 Dashboard 页面即可看到 API Key（格式：`tvly-...`）
3. 在 Author 设置 → 联网搜索 → 选择 **Tavily** → 粘贴 Key

> 免费额度：**1000 次/月**

### Exa（语义搜索）

1. 访问 [exa.ai](https://exa.ai)，注册账号
2. 在 [Dashboard](https://dashboard.exa.ai/api-keys) 获取 API Key
3. 在 Author 设置 → 联网搜索 → 选择 **Exa** → 粘贴 Key

> 免费额度：**1000 次/月**　｜　支持语义搜索，AI 场景下搜索质量更高

### 自定义搜索 API 地址（中转号池）

如果你搭建了 Tavily/Exa 的中转号池代理，可以在搜索配置中填写**自定义 API 地址**：

1. 在 Author 设置 → 联网搜索 → 搜索引擎配置区域
2. 找到「🔗 自定义 API 地址（可选）」输入框
3. 填入你的中转地址，如 `https://your-proxy.com`
4. 留空则使用官方默认地址

> 💡 系统会自动在你的地址后拼接 `/search` 路径，无需手动添加

---

## 设定集导入格式说明

Author 支持从多种格式导入设定集：**JSON / Markdown / TXT / DOCX / PDF**。

### 支持的文件格式

| 格式 | 说明 | 推荐度 |
|------|------|--------|
| **JSON** | Author 原生导出格式，完整保留所有数据 | ⭐⭐⭐⭐⭐ |
| **Markdown (.md)** | 最推荐的手写格式，结构清晰 | ⭐⭐⭐⭐⭐ |
| **TXT (.txt)** | 纯文本格式，使用【】标记条目 | ⭐⭐⭐⭐ |
| **DOCX (.docx)** | Word 文档，使用标题层级区分结构 | ⭐⭐⭐ |
| **PDF (.pdf)** | 自动识别 ■/◆ 标记或启发式解析 | ⭐⭐ |

---

### Markdown 格式模板（推荐）

用 `##` 标记分类，`###` 标记条目名，`字段名：内容` 填写字段：

```markdown
## 人物设定

### 林逸
姓名：林逸
性别：男
年龄：22
外貌：黑发黑瞳，身材修长，面容冷峻
性格：沉稳冷静，表面冷漠实则重情重义
背景故事：自幼修炼剑道的孤儿，被师父收养后踏入修仙之路
动机：寻找失踪的师父，揭开身世之谜
能力：御剑术、灵识感知、基础阵法
说话风格：言简意赅，偶尔冷笑讽刺

### 苏雨晴
姓名：苏雨晴
性别：女
性格：活泼开朗，心思细腻
能力：水系法术、医术

## 空间/地点

### 天剑宗
描述：坐落于青云山巅的修仙门派，云雾缭绕
视觉描写：白色建筑群隐于云海之中，剑光时常划破天际
氛围基调：庄严肃穆与仙气飘渺并存
危险等级：安全区域

## 物品/道具

### 玄冰剑
描述：上古神兵，寒气逼人
物品类型：武器
品阶：天阶
持有者：林逸

## 世界观/设定

### 灵气体系
描述：天地间充斥灵气，修士通过吸收灵气突破境界。境界分为：练气、筑基、金丹、元婴、化神。

## 大纲

### 第一卷：踏入修仙路
状态：已完成
描述：林逸被天剑宗收为弟子，开始修炼之路，在宗门大比中崭露头角

## 写作规则

### 文风要求
描述：用古风韵味的现代文写作，避免过于白话。战斗场面要有画面感，不使用数值化描述。
```

---

### TXT 格式模板

使用 `【】` 标记条目名，分类用 `│` 标记：

```
┌──────────────────────────
│ 人物设定
└──────────────────────────

【林逸】
姓名：林逸
性别：男
年龄：22
外貌：黑发黑瞳，身材修长
性格：沉稳冷静
背景故事：自幼修炼剑道的孤儿

【苏雨晴】
姓名：苏雨晴
性别：女
性格：活泼开朗

┌──────────────────────────
│ 世界观/设定
└──────────────────────────

【灵气体系】
描述：天地间充斥灵气，修士通过吸收灵气突破境界
```

---

### DOCX 格式要求

在 Word 中使用**标题样式**来标记结构：
- **标题 1 (H1)** → 分类名（如"人物设定"）
- **标题 2 (H2)** → 条目名（如"林逸"）
- **正文** → `字段名：内容`（如 `性别：男`）

---

### 各分类支持的字段

<details>
<summary>点击展开完整字段列表</summary>

#### 人物设定 (character)
`姓名` `性别` `年龄` `外貌` `性格` `背景故事` `动机` `能力` `说话风格` `人物关系` `成长弧线` `备注`

#### 空间/地点 (location)
`描述` `场景标题` `视觉描写` `听觉描写` `嗅觉/触觉` `氛围基调` `危险等级` `备注`

#### 物品/道具 (object)
`描述` `物品类型` `品阶` `持有者` `数值属性` `象征意义` `备注`

#### 世界观/设定 (world)
`描述` `备注`

#### 大纲 (plot)
`状态` `描述` `备注`

#### 写作规则 (rules)
`描述` `备注`

> 💡 字段名支持多种别名，例如"性格"也可以写成"个性"或"人格"。系统会自动识别并映射到对应字段。

</details>

---

### 导入注意事项

1. **自动分类检测** — 如果没有明确的分类标记，系统会根据字段关键词自动判断分类
2. **冲突处理** — 导入同名条目时会弹出冲突解决弹窗，可选择覆盖、跳过或重命名
3. **JSON 最完整** — 如果需要完整迁移（包括写作模式、书籍信息），建议使用 JSON 格式
4. **PDF 限制** — 扫描件或图片型 PDF 无法解析，仅支持文字型 PDF

---

## �🔒 隐私与数据安全

### 本地存储（安全）
- 章节内容、设定集、快照等创作数据 **100% 存储在浏览器本地（IndexedDB）**，不会上传到任何服务器
- API Key 存储在浏览器 localStorage 中

### ⚠️ AI 功能的数据流向

使用 AI 功能时（续写、改写、对话等），以下数据会经过**部署者的服务器**转发给 AI 供应商：
- 你的 **API Key**
- 你发送给 AI 的**文字内容**

```
你的浏览器 → 部署者的服务器 → AI 供应商（智谱/Gemini/DeepSeek等）
```

**如果你正在使用他人部署的公开实例**，虽然部署者承诺不会窥视日志，但技术上存在被截获的可能。因此：

1. ✅ 可以先用公开实例**简单体验**功能
2. ⚠️ 体验完毕后，**务必到 API 提供商网站及时销毁你的 Key**
3. 🔐 **正式使用请自行 Fork 并部署私有实例**，这样数据只经过你自己的服务器

> 💡 部署自己的实例非常简单：Fork 本项目 → 在 Vercel 一键部署 → 完成。全程不到 5 分钟。

---

##  开源协议

本项目采用 [AGPL-3.0](LICENSE) 协议开源。

**简单说**：
- ✅ 你可以自由使用、修改、分发
- ✅ 允许个人和商业使用（前提是修改后的代码也必须开源）
- ⚠️ 修改后的版本（包括基于此搭建的网络服务）必须同样以 AGPL-3.0 开源
- ⚠️ 必须保留原始版权声明
- ❌ 不可闭源后用于商业用途

---

## 💬 社区交流

- [QQ 交流群：1087016949（Author交流群）](https://qm.qq.com/q/wjRDkotw0E)
- [GitHub Issues](https://github.com/YuanShiJiLoong/author/issues) — 问题反馈与功能建议

---

## 🙏 致谢

### 🤖 AI 伙伴
本项目在以下 AI 伙伴的辅助下开发：

| 名称 | 作用 |
|------|------|
| [Google Antigravity](https://antigravity.google/) | AI 驱动的 IDE — 本项目的开发平台 |
| [Claude Opus 4.6](https://www.anthropic.com/)（Thinking） | 主力编程助手 — 架构设计、功能实现、调试 |
| [Gemini 3.1 Pro](https://deepmind.google/technologies/gemini/)（High） | UI 审查、截图分析、设计迭代 |
| [Gemini 3 Flash](https://deepmind.google/technologies/gemini/) | 内置浏览器自动化工具 |
| [Chrome DevTools MCP](https://developer.chrome.com/) | 浏览器测试、性能分析、DOM 检查 |
| [Firebase MCP](https://firebase.google.com/) | 云数据库管理、安全规则验证、项目配置 |
| [GitHub MCP](https://github.com/) | 仓库管理、PR 审查、代码搜索 |

### 📦 开源项目
- [Tiptap](https://tiptap.dev/) — 编辑器框架
- [Next.js](https://nextjs.org/) — React 全栈框架
- [Zustand](https://zustand-demo.pmnd.rs/) — 状态管理
- [KaTeX](https://katex.org/) — 数学公式渲染
