# dsh-todolist

[English](README.md) | [中文](README.zh.md)

一个 **DeepSeek Harness（DSH）** 桌面端插件：在左侧导航新增「待办清单」面板，提供可折叠的任务卡片，支持截止时间（精确到小时）、按工作区绑定会话、一键跳转，以及按截止前 N 小时通过钉钉推送提醒。

![待办清单面板](docs/panel.png)

## 功能

- **左侧导航入口**：侧边栏新增「待办清单」一行，位于「上下文洞察」附近。
- **大卡片任务**：双行卡片布局，状态色条（逾期红 / 今日橙）、圆角渐变卡面、悬停抬升，顶部还有完成进度条。
- **完整任务操作**：新增、编辑（双击或「编辑」）、勾选完成、删除、清除已完成。
- **截止时间（精确到小时）**：添加时设置 `YYYY-MM-DD HH:00`，也可对任意任务「改期」（快捷「今天 18:00 / 明天 09:00 / 1 小时后」和清除）。逾期红色高亮、今天到期橙色；未完成任务按截止时间排序。
- **钉钉提醒**：全局默认提前小时数 + 每任务单独覆盖（0 = 不提醒）；到达「截止前 N 小时」时通过**钉钉群机器人 Webhook** 或**钉钉工作通知（企业应用）**推送。需要 DSH 处于运行/托盘状态（内置调度器每 60 秒检查一次）。
- **绑定工作区会话**：按工作区分组选择会话，绑定后点击会话胶囊即可跳转到该会话。
- **可折叠分组**：「待办」「已完成」两段均可收起，并显示数量。
- **持久化**：任务存于宿主端 `<DSH_HOME>/todolist/todos.json`，重启不丢，且不受 Web 端口随机变化影响。每次写入都会保留 `todos.json.bak`，并在 `todolist/backups/` 下保留最多 20 份带时间戳快照。
- **中英双语**：内置中文 / 英文 UI 文案。

## 环境要求

- DSH NEXT 2.0.20（或兼容的 0.2.x 版本）。
- Windows + PowerShell（安装脚本；也支持手动安装）。

## 安装

```powershell
git clone https://github.com/stitchmaps/dsh-todolist.git
cd dsh-todolist
pwsh -File .\install.ps1
```

脚本会：

1. 把本仓库的插件文件复制到 `%DSH_HOME%\profiles\desktop\node_modules\todolist`；
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
2. 输入任务后回车（或点「添加」）；输入框右侧的日期时间选择器可设置截止时间（精确到小时）。
3. 在任务卡片上：
   - **截止 / 改期**：选择日期与小时，或用快捷「今天 18:00 / 明天 09:00 / 1 小时后」，设置提醒提前量，也可清除；
   - **绑定会话**：按工作区分组选择会话，绑定后点会话胶囊即可跳转；
   - **编辑**：改名（也可双击标题）；
   - 勾选框切换完成；**删除**移除任务。

### 钉钉提醒设置

1. 点面板右上角 **推送设置**。
2. 选择推送方式：
   - **钉钉群机器人**：粘贴自定义机器人 Webhook（钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义），可选填加签 Secret 和 `@` 手机号；
   - **钉钉工作通知**：填写钉钉开放平台内部应用的 AppKey / AppSecret / AgentId 与接收人 userId。
3. 设置「默认提前（小时）」（0 = 不提醒），点 **保存设置**，再点 **测试推送** 验证。
4. 每任务覆盖：打开任务的截止对话框，单独选择提醒提前量（默认 / 不提醒 / 1–48 小时）。

配置与任务一起保存在 `<DSH_HOME>/todolist/todos.json`；群机器人推送到群，工作通知发给个人。

![钉钉推送设置](docs/panel-settings.png)

## 工作原理

DSH 插件分为两侧：

- **浏览器半侧**（`lib/client.js`）由 DSH 的 Web 模块加载器加载，注册：
  - `sidebar.panellist` —— 左侧导航入口（`id: todolist`）；
  - `main` keyed 槽位 —— 主面板。
  工作区/会话数据来自槽位运行时注入的 `useWorkspaces()` / `useSessions()`；跳转会话调用 `ctx.get('uiWorkspace').openSession(sessionId)`。
- **宿主半侧**（`lib/index.js`）是普通 Cordis 插件。它通过 `connection.fetch.register` 注册 `POST /api/todolist/state`，以原子方式读写 `<DSH_HOME>/todolist/todos.json`，并内置每 60 秒检查一次的提醒调度器，按「截止前 N 小时」推送到钉钉。

浏览器产物采用与官方 UI 插件一致的惰性 CJS 工厂格式（`window.__ModuleLoader__.load({ id, factory })`）手写，因此**无需构建步骤**。

## 仓库结构

```
.
├─ package.json             # main = 宿主半侧，./client = 浏览器半侧，dsh.client
├─ cordis.patch.yml         # bundle 补丁：插入插件行
├─ icon.svg
├─ lib/
│  ├─ index.js              # 宿主半侧：持久化 + POST /api/todolist/state
│  └─ client.js             # 浏览器半侧：侧边栏入口 + 主面板
├─ install.ps1
├─ README.md / README.zh.md
├─ LICENSE
├─ docs/panel.png
└─ docs/panel-settings.png
```

## 说明

- 截图使用示例数据。
- 这是纯 UI 插件：不注册任何面向模型的工具或提示词内容。
- 数据模型为 `{ version: 2, tasks: [{ id, title, done, due: 'YYYY-MM-DDTHH:00' | null, remindHours: number | null, remindedAt, reminderDue, sessionId, sessionTitle, createdAt, updatedAt }], config: { dingtalk: {...}, defaultRemindHours } }`。
- 备份：`<DSH_HOME>/todolist/todos.json.bak`（上一版）和 `<DSH_HOME>/todolist/backups/todos-YYYYMMDD-HHmmss.json`（最近 20 次写入）。主文件缺失或损坏时，宿主读取会自动回退到最新备份。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
