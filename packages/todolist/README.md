# todolist — DSH 待办清单插件

一个跑在 DeepSeek Harness（DSH）桌面端 Web GUI 里的待办清单插件：

- 左侧导航栏新增 **「待办清单」** 入口（与「上下文洞察」同级）。
- 主面板是一个**可折叠**的任务列表，分为「待办 / 已完成」两段，每段都可收起。
- 支持**新增、编辑（双击或「编辑」按钮）、勾选完成、删除、清除已完成**。
- **卡片式大卡视觉**：双行布局、状态色条（逾期红 / 今日橙）、悬停抬升、圆角渐变卡片、完成进度条。
- 每个任务可设置**截止日期**：添加时可一并选日期，或点任务行「截止 / 改期」；已逾期红色高亮、今天到期橙色，未完成列表按截止日期升序排列（无日期排最后）。
- 每个任务可以**绑定某个工作区里的某个会话**；绑定后显示会话胶囊，**点击即可跳转到该会话**。
- 任务持久化在宿主端的 `<DSH_HOME>/todolist/todos.json`，重启 DSH / 刷新页面都不会丢失（不受随机端口影响）。

---

## 目录结构

```
packages/todolist/
├─ package.json          # 包声明：main=宿主半侧，./client=浏览器半侧，dsh.client 声明
├─ cordis.patch.yml      # bundle 补丁层：向加载器插入本插件行
├─ icon.svg              # 插件图标
├─ lib/
│  ├─ index.js           # 宿主半侧（Cordis 插件）：持久化 + POST /api/todolist/state
│  └─ client.js          # 浏览器半侧：注册 sidebar.panellist 入口 + main 面板
└─ README.md
```

## 工作原理

DSH 的插件包分两侧：

1. **宿主半侧**（`lib/index.js`，`main` 入口）是一个普通 Cordis 插件。它通过
   `ctx.inject(['connection'])` 取得共享的 `connection` 服务，并用
   `connection.fetch.register({ path: '/api/todolist/state', methods: ['POST'], ... })`
   注册一个同源接口。数据写入 `~/.dsh/todolist/todos.json`（遵循 `DSH_HOME`）。

2. **浏览器半侧**（`lib/client.js`）由 `package.json` 的 `dsh.client` 声明自动加载。
   它注册两个 slot：
   - `sidebar.panellist`（左侧导航的图标行，`id: todolist`）——侧边栏外壳负责点击后
     调用 `ctx.layout.selectPanel('todolist')`；
   - `main` 的 keyed 面板（`key: todolist`）——选中后占据中间主区域。
   - 跳转会话使用 `ctx.get('uiWorkspace').openSession(sessionId)`。
   - 工作区 / 会话列表来自 slot 运行时注入的 `useWorkspaces()` / `useSessions()` 全局钩子。

## 安装

在仓库根目录执行：

```powershell
pwsh -File .\install-todolist.ps1
```

脚本会：

1. 把 `packages/todolist` 复制到 `%DSH_HOME%\profiles\desktop\node_modules\todolist`；
2. 在 profile 的 `package.json` 里登记 `file:` 依赖；
3. 在 profile 的 `cordis.patch.yml` 末尾插入本插件行（带备份）。

安装后 DSH 的 profile 补丁层会热加载（`patchReload: live`）；如界面未立即出现，
刷新一下 Web GUI 页面即可。

## 使用

1. 左侧导航出现「待办清单」，点击进入主面板。
2. 在输入框输入任务，回车或点「添加」；输入框右侧的日期选择器可同时设置截止日期。
3. 任务行右侧：
   - 「截止 / 改期」→ 在弹出的日期框里选日期，或点「今天 / 明天」快捷设置，也可清除日期；
   - 「绑定会话」→ 在弹出的下拉框里按工作区分组选择目标会话；
   - 绑定后出现会话胶囊，点击胶囊即可跳到该会话；
   - 「编辑」或双击标题可改名；勾选框切换完成；「删除」移除任务。
4. 「已完成」段可折叠，底部「清除已完成」可批量清理。

## 开发备注

- 浏览器半侧是手写的惰性 CJS 工厂（`window.__ModuleLoader__.load({id, factory})`），
  与官方 UI 插件产物同构，因此**不需要额外构建步骤**（无需 tsdown）。
- 修改 `lib/client.js` 后，刷新 Web GUI 页面即可生效；修改宿主半侧 `lib/index.js`
  后需要让 profile 重新加载该插件（重开 DSH 或触发一次补丁重载）。
- 面板只依赖平台基座模块 `react`，不引入其它运行时依赖。
