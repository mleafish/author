# Author (本地版)

> 基于 [YuanShiJiLoong/author](https://github.com/YuanShiJiLoong/author) 修改的纯本地版本。
>
> 原项目 README 见 [README.original.md](README.original.md)

一款面向小说作者的 AI 辅助创作工具，集成富文本编辑器、AI 写作助手和世界观设定管理。本版本移除了所有云端/登录功能，数据完全保存在本地。


意外发现了这个ai写作工具，用下来挺好用，但还有些不喜欢的地方，我不会编程，所以这个项目全部由claude修改，我只想加入我需要的功能，然后分享出来，随缘更新！

---

## 相比原版的改动

- **完全本地化** — 删除所有登录、Firebase 云同步功能，数据 100% 留在本地
- **API 配置页面优化** — 重新调整布局，修复若干 bug
- **修复设定集同步异常** — 解决设定集引用/参考异常的 bug
- **快照功能增强** — 支持自定义是否自动保存，新增一键删除快照
- 更多功能见发布页

---

## 快速开始

### 桌面客户端

直接下载安装，无需 Node.js：

- [下载安装包 (Windows)](https://github.com/mleafish/author/releases/latest)

### 从源码运行

```bash
git clone https://github.com/mleafish/author.git
cd author
npm install
npm run dev
```

打开 http://localhost:3000 即可使用。

### 构建生产版本

```bash
npm run build
npm start
```

### 构建桌面客户端

```bash
npm run build && npx electron-builder --win
```

---

## 许可证

[AGPL-3.0](LICENSE)
