# dsh-todolist

[English](README.md) | [中文](README.zh.md)

一个 **DeepSeek Harness（DSH）** 桌面端插件：在左侧导航新增「待办清单」面板，提供可折叠的任务列表，支持截止日期、按工作区绑定会话，以及点击一键跳转到对应会话。

![待办清单面板](docs/panel.png)

## 功能

- **左侧导航入口**：侧边栏新增「待办清单」一行，位于「上下文洞察」附近。
- **大卡片任务**：双行卡片布局，状态色条（逾期红 / 今日橙）、圆角渐变卡面、悬停抬升，顶部还有完成进度条。
- **完整任务操作**：新增、编辑（双击或「编辑」）、勾选完成、删除、清除已完成。
- **截止日期**：添加时可顺手选日期，也可对任意任务「改期」（支持快捷「今天 / 明天」和清除）。逾期红色高亮、今天到期橙色；未完成任务按截止日期排序。
- **绑定工作区会话**：按工作区分组选择会话，绑定后点击会话胶囊即可跳转到该会话。
- **可折叠分组**：「待办」「已完成」两段均可收起，并显示数量。
- **持久化**：任务存于宿主端 `<DSH_HOME>/todolist/todos.json`，重启不丢，且不受 Web 端口随机变化影响。
- **中英双语**：内置中文 / 英文 UI 文案。

## 环境要求

- DSH NEXT 2.0.20（或兼容的 0.2.x 版本）。
- Windows + PowerShell（安装脚本；也支持手动安装）。

## 安装

```powershell
git clone https://github.com/stitchmaps/dsh-todolist.git
cd dsh-todolist
pwsh -File .\install-todolist.ps1
```

脚本会：

1. 把 `packages/todolist` 复制到 `%DSH_HOME%\profiles\desktop\node_modules\todolist`；
2. 在 profile 的 `package.json` 里登记 `file:` 依赖；
3. 在 profile 的 `cordis.patch.yml` 末尾追加插件加载行。

每个被修改的文件都会在原位置保留带时间戳的备份。若界面未立即出现入口，刷新一次 Web GUI（`Ctrl+R`）即可。

手动安装：把包复制进 profile 的 `node_modules`，再在 `~/.dsh/profiles/desktop/cordis.patch.yml` 中加入：

```yaml
- insert:
    - id: todolist
      name: todolist
```

## 使用

1. 点击左侧「待办清单」。
2. 输入任务后回车（或点「添加」）；输入框右侧的日期选择器可设置可选截止日期。
3. 在任务卡片上：
   - **截止 / 改期**：选择日期，或用「今天 / 明天」快捷设置，也可清除；
   - **绑定会话**：按工作区分组选择会话，绑定后点会话胶囊即可跳转；
   - **编辑**：改名（也可双击标题）；
   - 勾选框切换完成；**删除**移除任务。

## 工作原理

DSH 插件分为两侧：

- **浏览器半侧**（`packages/todolist/lib/client.js`）由 DSH 的 Web 模块加载器加载，注册：
  - `sidebar.panellist` —— 左侧导航入口（`id: todolist`）；
  - `main` keyed 槽位 —— 主面板。
  工作区/会话数据来自槽位运行时注入的 `useWorkspaces()` / `useSessions()`；跳转会话调用 `ctx.get('uiWorkspace').openSession(sessionId)`。
- **宿主半侧**（`packages/todolist/lib/index.js`）是普通 Cordis 插件。它通过 `connection.fetch.register` 注册 `POST /api/todolist/state`，并以原子方式读写 `<DSH_HOME>/todolist/todos.json`。

浏览器产物采用与官方 UI 插件一致的惰性 CJS 工厂格式（`window.__ModuleLoader__.load({ id, factory })`）手写，因此**无需构建步骤**。

## 仓库结构

```
.
├─ packages/todolist/
│  ├─ package.json          # main = 宿主半侧，./client = 浏览器半侧，dsh.client
│  ├─ cordis.patch.yml      # bundle 补丁：插入插件行
│  ├─ icon.svg
│  └─ lib/
│     ├─ index.js           # 宿主半侧：持久化 + POST /api/todolist/state
│     └─ client.js          # 浏览器半侧：侧边栏入口 + 主面板
├─ install-todolist.ps1
└─ docs/panel.png
```

## 说明

- 截图使用示例数据。
- 这是纯 UI 插件：不注册任何面向模型的工具或提示词内容。
- 数据模型为 `{ version: 1, tasks: [{ id, title, done, due, sessionId, sessionTitle, createdAt, updatedAt }] }`。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
