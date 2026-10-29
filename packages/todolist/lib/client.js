/**
 * todolist — browser half.
 *
 * Loaded through the DSH web module loader as a lazy CJS factory. Registers:
 *   - a `main` keyed panel (the full-size todo board), and
 *   - a `sidebar.panellist` row (the left-navigation entry) with the same id,
 * so the shell's own panellist wiring selects the panel and swaps the centre
 * column back to it.
 *
 * Task state is persisted by the host half over POST /api/todolist/state.
 */
;(function () {
  var MODULE_ID = 'todolist'
  var loader = typeof window !== 'undefined' ? window.__ModuleLoader__ : undefined
  if (!loader || typeof loader.load !== 'function') return

  loader.load({
    id: MODULE_ID,
    factory: function (require) {
      var module = { exports: {} }

      var React = require('react')
      var h = React.createElement

      var NS = 'todolist'

      var ZH = {
        'nav.title': '待办清单',
        'page.title': '待办清单',
        'page.subtitle': '共 {total} 项 · {n} 项待办',
        'add.placeholder': '添加一个任务，按回车确认',
        'add.button': '添加',
        'section.active': '待办',
        'section.done': '已完成',
        'action.edit': '编辑',
        'action.delete': '删除',
        'action.bind': '绑定会话',
        'action.rebind': '改绑',
        'action.jump': '跳转到该会话',
        'bind.title': '选择要绑定的工作区会话',
        'bind.none': '不绑定会话',
        'unbound': '未绑定会话',
        'empty': '还没有待办任务，先在上方添加一个吧。',
        'emptyDone': '暂无已完成任务。',
        'clearDone': '清除已完成',
        'loading': '正在加载…',
        'saveFailed': '保存失败，请稍后重试',
        'due.set': '截止',
        'due.edit': '设置截止日期',
        'due.clear': '清除日期',
        'due.none': '无截止日期',
        'due.overdue': '已逾期',
        'due.today': '今天到期',
        'due.tomorrow': '明天到期',
        'due.overdueCount': '{n} 项已逾期',
        'due.change': '改期',
        'due.quickToday': '今天',
        'due.quickTomorrow': '明天',
      }

      var EN = {
        'nav.title': 'To-do List',
        'page.title': 'To-do List',
        'page.subtitle': '{total} total · {n} open',
        'add.placeholder': 'Add a task, press Enter to save',
        'add.button': 'Add',
        'section.active': 'To do',
        'section.done': 'Completed',
        'action.edit': 'Edit',
        'action.delete': 'Delete',
        'action.bind': 'Bind session',
        'action.rebind': 'Rebind',
        'action.jump': 'Jump to this session',
        'bind.title': 'Pick a workspace session',
        'bind.none': 'No session',
        'unbound': 'No session bound',
        'empty': 'No tasks yet — add one above.',
        'emptyDone': 'Nothing completed yet.',
        'clearDone': 'Clear completed',
        'loading': 'Loading…',
        'saveFailed': 'Save failed, please retry',
        'due.set': 'Due',
        'due.edit': 'Set due date',
        'due.clear': 'Clear date',
        'due.none': 'No due date',
        'due.overdue': 'Overdue',
        'due.today': 'Due today',
        'due.tomorrow': 'Due tomorrow',
        'due.overdueCount': '{n} overdue',
        'due.change': 'Reschedule',
        'due.quickToday': 'Today',
        'due.quickTomorrow': 'Tomorrow',
      }

      function injectStyles() {
        if (typeof document === 'undefined') return
        var marker = 'todolist/styles'
        if (document.querySelector('style[data-plugin-css="' + marker + '"]') !== null) return
        var el = document.createElement('style')
        el.dataset.plugin = 'todolist'
        el.dataset.pluginCss = marker
        el.textContent = [
          '.tdl-page{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#16181d);color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:1.55;overflow:hidden;container:tdl/inline-size}',
          '.tdl-header{flex:none;padding:22px clamp(16px,2.6cqi,32px) 12px}',
          '.tdl-titlerow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
          '.tdl-h1{margin:0;font-size:19px;font-weight:600;letter-spacing:.01em}',
          '.tdl-sub{color:var(--dsw-alias-label-secondary,#9aa0aa);font-size:12px;font-variant-numeric:tabular-nums}',
          '.tdl-addrow{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}',
          '.tdl-adddate{flex:none;box-sizing:border-box;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;padding:6px 8px;outline:none}',
          '.tdl-input{flex:1;min-width:0;box-sizing:border-box;font:inherit;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;padding:7px 11px;font-size:13px;outline:none;transition:border-color .18s ease,box-shadow .18s ease}',
          '.tdl-input:focus{border-color:var(--dsw-alias-brand-primary,#4d8dff);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary,#4d8dff) 22%,transparent)}',
          '.tdl-add{flex:none;font:inherit;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-button-primary-fill,#3b6ff5);border:0;border-radius:8px;padding:7px 16px;transition:filter .18s ease,opacity .18s ease}',
          '.tdl-add:hover:enabled{filter:brightness(1.08)}',
          '.tdl-add:disabled{opacity:.45;cursor:default}',
          '.tdl-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:4px clamp(16px,2.6cqi,32px) 48px}',
          '.tdl-loading{color:var(--dsw-alias-label-secondary,#9aa0aa);padding:18px 2px}',
          '.tdl-section{margin-top:14px}',
          '.tdl-sec-head{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;font:inherit;text-align:left;color:var(--dsw-alias-label-secondary,#9aa0aa);background:transparent;border:0;border-bottom:1px dashed var(--dsw-alias-border-l2,rgba(255,255,255,.14));padding:6px 2px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:.04em}',
          '.tdl-sec-head:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
          '.tdl-caret{flex:none;width:12px;text-align:center;font-size:10px;transition:transform .15s ease}',
          '.tdl-sec-title{flex:none}',
          '.tdl-badge{flex:none;min-width:18px;text-align:center;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));color:var(--dsw-alias-label-secondary,#9aa0aa);padding:0 7px;font-size:11px;font-variant-numeric:tabular-nums;font-weight:500}',
          '.tdl-sec-body{display:flex;flex-direction:column;gap:6px;margin-top:8px}',
          '.tdl-task-wrap{display:flex;flex-direction:column;gap:6px}',
          '.tdl-task{display:flex;align-items:center;gap:9px;flex-wrap:wrap;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:10px;padding:8px 10px;transition:border-color .18s ease,background-color .18s ease}',
          '.tdl-task:hover{border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.16));background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
          '.tdl-task.is-done .tdl-task-title{color:var(--dsw-alias-label-tertiary,#7c828c);text-decoration:line-through}',
          '.tdl-check{flex:none;width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary,#4d8dff);cursor:pointer;margin:0}',
          '.tdl-task-title{flex:1;min-width:80px;overflow-wrap:anywhere;cursor:text;font-size:13px}',
          '.tdl-editinput{flex:1;min-width:80px;box-sizing:border-box;font:inherit;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));border:1px solid var(--dsw-alias-brand-primary,#4d8dff);border-radius:6px;padding:3px 8px;font-size:13px;outline:none}',
          '.tdl-chip{flex:none;display:inline-flex;align-items:center;gap:5px;max-width:220px;font:inherit;font-size:11.5px;cursor:pointer;color:var(--dsw-alias-brand-primary,#6ea8ff);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d8dff) 10%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d8dff) 38%,transparent);border-radius:999px;padding:2px 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
          '.tdl-chip:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d8dff) 18%,transparent)}',
          '.tdl-chip-dot{flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}',
          '.tdl-due{flex:none;display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:11px;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa0aa);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:999px;padding:1px 9px;line-height:1.7;white-space:nowrap}',
          '.tdl-due:hover{color:var(--dsw-alias-label-primary,#e6e6e6);border-color:var(--dsw-alias-label-secondary,#9aa0aa)}',
          '.tdl-due.is-today{color:var(--dsw-alias-state-warn-primary,#f0a020);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0a020) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0a020) 12%,transparent)}',
          '.tdl-due.is-overdue{color:var(--dsw-alias-state-error-primary,#ff6b6b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 12%,transparent)}',
          '.tdl-due-none{flex:none;color:var(--dsw-alias-label-tertiary,#7c828c);font-size:11px;white-space:nowrap}',
          '.tdl-date{flex:1;min-width:140px;box-sizing:border-box;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-1,#1d2026);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:6px;padding:4px 8px;outline:none}',
          '.tdl-subwarn{color:var(--dsw-alias-state-error-primary,#ff6b6b);font-size:12px;font-variant-numeric:tabular-nums}',
          '.tdl-unbound{flex:none;color:var(--dsw-alias-label-tertiary,#7c828c);font-size:11px;white-space:nowrap}',
          '.tdl-mini{flex:none;font:inherit;font-size:11px;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa0aa);background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:6px;padding:2px 8px;line-height:1.5;transition:color .15s ease,border-color .15s ease}',
          '.tdl-mini:hover{color:var(--dsw-alias-label-primary,#e6e6e6);border-color:var(--dsw-alias-label-secondary,#9aa0aa)}',
          '.tdl-del:hover{color:var(--dsw-alias-state-error-primary,#ff6b6b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 55%,transparent)}',
          '.tdl-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 2px 24px;padding:7px 10px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:9px}',
          '.tdl-picker-label{color:var(--dsw-alias-label-secondary,#9aa0aa);font-size:11.5px;flex:none}',
          '.tdl-select{flex:1;min-width:150px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-1,#1d2026);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:6px;padding:4px 8px;outline:none}',
          '.tdl-empty-inline{color:var(--dsw-alias-label-tertiary,#7c828c);font-size:12px;padding:8px 4px 2px}',
          '.tdl-foot{display:flex;justify-content:flex-end;margin-top:16px}',
          '.tdl-linkbtn{font:inherit;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa0aa);background:transparent;border:0;padding:2px 4px}',
          '.tdl-linkbtn:hover{color:var(--dsw-alias-label-primary,#e6e6e6);text-decoration:underline}',
          '@container tdl (width<=560px){.tdl-unbound{display:none}.tdl-chip{max-width:140px}}',
          '/* ===== refined visual design ===== */',
          '.tdl-page{background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-bg-base,#14161b) 70%,transparent),color-mix(in srgb,var(--dsw-alias-bg-base,#14161b) 92%,transparent));backdrop-filter:blur(16px) saturate(1.05)}',
          '.tdl-header{max-width:1000px;width:100%;margin:0 auto;padding:26px clamp(20px,3cqi,44px) 14px}',
          '.tdl-titlerow{align-items:center;gap:12px}',
          '.tdl-h1{display:flex;align-items:center;gap:10px;margin:0;font-size:22px;font-weight:700;letter-spacing:.01em;line-height:1.2}',
          '.tdl-h1 svg{color:var(--dsw-alias-brand-primary,#5b8cff);flex:none}',
          '.tdl-sub{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:999px;padding:2px 12px;color:var(--dsw-alias-label-secondary,#9aa0aa);font-size:12px;font-variant-numeric:tabular-nums}',
          '.tdl-subwarn{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 55%,transparent);color:var(--dsw-alias-state-error-primary,#ff6b6b);border-radius:999px;padding:2px 12px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}',
          '.tdl-addrow{margin-top:16px;padding:8px;gap:8px;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:15px;box-shadow:0 8px 24px rgba(0,0,0,.16)}',
          '.tdl-input{background:transparent;border:0;padding:9px 12px;font-size:13.5px}',
          '.tdl-input:focus{box-shadow:none;border:0}',
          '.tdl-adddate{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));border-radius:10px;padding:7px 10px}',
          '.tdl-add{background:linear-gradient(135deg,#4d8dff,#7a6bff);border-radius:10px;padding:8px 20px;font-weight:600;box-shadow:0 6px 18px color-mix(in srgb,var(--dsw-alias-brand-primary,#4d8dff) 35%,transparent)}',
          '.tdl-add:hover:enabled{filter:brightness(1.08)}',
          '.tdl-scroll{padding:6px clamp(20px,3cqi,44px) 56px}',
          '.tdl-inner{max-width:1000px;width:100%;margin:0 auto;display:flex;flex-direction:column}',
          '.tdl-section{margin-top:20px}',
          '.tdl-sec-head{border-bottom:0;padding:8px 4px 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#7c828c)}',
          '.tdl-sec-head:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
          '.tdl-caret{width:14px;font-size:11px}',
          '.tdl-sec-title{font-weight:700}',
          '.tdl-badge{min-width:22px;padding:1px 8px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#9aa0aa);font-size:11px}',
          '.tdl-sec-body{gap:10px;margin-top:10px}',
          '.tdl-task-wrap{gap:8px}',
          '.tdl-task{position:relative;display:block;padding:15px 18px 13px 20px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015)),var(--dsw-alias-bg-layer-1,rgba(22,25,31,.72));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));box-shadow:0 4px 16px rgba(0,0,0,.16);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background-color .18s ease;overflow:hidden}',
          '.tdl-task::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:transparent;transition:background .18s ease}',
          '.tdl-task.is-overdue::before{background:var(--dsw-alias-state-error-primary,#ff6b6b)}',
          '.tdl-task.is-today::before{background:var(--dsw-alias-state-warn-primary,#f0a020)}',
          '.tdl-task:hover{transform:translateY(-1px);border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.2));box-shadow:0 10px 28px rgba(0,0,0,.24)}',
          '.tdl-task.is-done{opacity:.72;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.02))}',
          '.tdl-task-top{display:flex;align-items:flex-start;gap:12px}',
          '.tdl-task-bottom{display:flex;align-items:center;gap:10px;margin-top:12px;padding-left:31px;flex-wrap:wrap}',
          '.tdl-task-meta{display:flex;align-items:center;gap:8px;flex:1;min-width:140px;flex-wrap:wrap}',
          '.tdl-task-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
          '.tdl-task-title{flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary,#e6e6e6);overflow-wrap:anywhere;cursor:text}',
          '.tdl-task.is-done .tdl-task-title{color:var(--dsw-alias-label-tertiary,#7c828c);text-decoration:line-through;text-decoration-thickness:1px}',
          '.tdl-check{appearance:none;-webkit-appearance:none;width:19px;height:19px;margin-top:1px;border-radius:50%;border:1.7px solid var(--dsw-alias-border-l3,#5a6273);background:transparent;cursor:pointer;position:relative;flex:none;transition:background .16s ease,border-color .16s ease,transform .12s ease}',
          '.tdl-check:hover{border-color:var(--dsw-alias-brand-primary,#5b8cff)}',
          '.tdl-check:active{transform:scale(.92)}',
          '.tdl-check:checked{background:linear-gradient(135deg,#3ecf8e,#26b06f);border-color:#26b06f;box-shadow:0 0 0 3px color-mix(in srgb,#3ecf8e 18%,transparent)}',
          '.tdl-check:checked::after{content:"✓";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#0c2a1d;font-size:12px;font-weight:800;line-height:1}',
          '.tdl-editinput{flex:1;min-width:0;font-size:14px;padding:6px 10px;border-radius:9px}',
          '.tdl-due{font-size:11.5px;padding:2px 10px;gap:6px;border-radius:999px}',
          '.tdl-due-ico{font-size:11px;opacity:.85}',
          '.tdl-chip{font-size:12px;padding:3px 12px;border-radius:999px}',
          '.tdl-unbound{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#7c828c);display:inline-flex;align-items:center;gap:6px}',
          '.tdl-mini{font-size:11.5px;padding:4px 11px;border-radius:8px;color:var(--dsw-alias-label-secondary,#9aa0aa);background:transparent}',
          '.tdl-mini:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#e6e6e6);border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.2))}',
          '.tdl-del:hover{color:var(--dsw-alias-state-error-primary,#ff6b6b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b6b) 55%,transparent)}',
          '.tdl-picker{margin:0 0 0 31px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05))}',
          '.tdl-empty-inline{padding:34px 16px;text-align:center;color:var(--dsw-alias-label-tertiary,#7c828c);border:1px dashed var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:14px;font-size:12.5px}',
          '.tdl-loading{text-align:center;padding:28px}',
          '.tdl-foot{margin-top:20px}',
          '.tdl-task.is-done{opacity:.82}',
          '.tdl-progresswrap{display:flex;align-items:center;gap:12px;margin-top:14px}',
          '.tdl-progress{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07));overflow:hidden}',
          '.tdl-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4d8dff,#3ecf8e);transition:width .35s ease}',
          '.tdl-progress-label{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa0aa);font-variant-numeric:tabular-nums}',
          '@container tdl (width<=620px){.tdl-task-actions{width:100%;justify-content:flex-start}.tdl-task-bottom{padding-left:0}}',
        ].join('\n')
        document.head.appendChild(el)
      }

      function newId() {
        try {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
        } catch (e) { /* fall through */ }
        return 'td-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
      }

      function pad2(n) { return n < 10 ? '0' + n : String(n) }
      function ymd(date) { return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) }
      function todayStr() { return ymd(new Date()) }
      function addDaysStr(days) {
        var d = new Date()
        d.setDate(d.getDate() + days)
        return ymd(d)
      }
      function dueStatus(due) {
        if (!due) return null
        var today = todayStr()
        if (due < today) return 'overdue'
        if (due === today) return 'today'
        if (due === addDaysStr(1)) return 'tomorrow'
        return 'future'
      }

      function normalizeClientTask(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
        var title = typeof raw.title === 'string' ? raw.title.trim() : ''
        if (title === '') return null
        return {
          id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId(),
          title: title,
          done: raw.done === true,
          due: typeof raw.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) ? raw.due : null,
          sessionId: typeof raw.sessionId === 'string' && raw.sessionId !== '' ? raw.sessionId : null,
          sessionTitle: typeof raw.sessionTitle === 'string' && raw.sessionTitle !== '' ? raw.sessionTitle : null,
          createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
          updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
        }
      }

      async function loadTasks() {
        try {
          var res = await fetch('api/todolist/state', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          })
          if (!res.ok) return []
          var json = await res.json()
          if (!json || json.ok !== true || !json.value || !Array.isArray(json.value.tasks)) return []
          var out = []
          for (var i = 0; i < json.value.tasks.length; i++) {
            var task = normalizeClientTask(json.value.tasks[i])
            if (task !== null) out.push(task)
          }
          return out
        } catch (e) {
          return []
        }
      }

      function saveTasks(tasks) {
        try {
          fetch('api/todolist/state', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ op: 'save', tasks: tasks }),
          }).catch(function () {})
        } catch (e) { /* ignore */ }
      }

      function createIcon() {
        function Icon(props) {
          var size = props && typeof props.size === 'number' ? props.size : 16
          return h('svg', {
            width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
            stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
            strokeLinejoin: 'round', 'aria-hidden': 'true',
          }, [
            h('rect', { key: 'r', x: 4, y: 3.5, width: 16, height: 17, rx: 3 }),
            h('path', { key: 'c1', d: 'M8.5 9.5l1.4 1.4 2.6-2.9' }),
            h('path', { key: 'c2', d: 'M8.5 15l1.4 1.4 2.6-2.9' }),
            h('path', { key: 'l1', d: 'M14.5 9.8h3.2' }),
            h('path', { key: 'l2', d: 'M14.5 15.3h3.2' }),
          ])
        }
        Icon.displayName = 'TodolistNavIcon'
        return Icon
      }

      function createPanel(ctx, t) {
        function openSession(sessionId) {
          try {
            var workspace = ctx && typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined
            if (workspace && typeof workspace.openSession === 'function') workspace.openSession(sessionId)
          } catch (e) { /* ignore */ }
        }

        function Panel(props) {
          var useSessions = props ? props.useSessions : undefined
          var useWorkspaces = props ? props.useWorkspaces : undefined
          var sessionsState = typeof useSessions === 'function' ? useSessions(function (x) { return x }) : null
          var workspacesState = typeof useWorkspaces === 'function' ? useWorkspaces(function (x) { return x }) : null

          var tasksState = React.useState([])
          var tasks = tasksState[0]
          var setTasks = tasksState[1]
          var loadedState = React.useState(false)
          var loaded = loadedState[0]
          var setLoaded = loadedState[1]
          var draftState = React.useState('')
          var draft = draftState[0]
          var setDraft = draftState[1]
          var editingIdState = React.useState(null)
          var editingId = editingIdState[0]
          var setEditingId = editingIdState[1]
          var editingTextState = React.useState('')
          var editingText = editingTextState[0]
          var setEditingText = editingTextState[1]
          var bindingIdState = React.useState(null)
          var bindingId = bindingIdState[0]
          var setBindingId = bindingIdState[1]
          var dueIdState = React.useState(null)
          var dueId = dueIdState[0]
          var setDueId = dueIdState[1]
          var addDueState = React.useState('')
          var addDue = addDueState[0]
          var setAddDue = addDueState[1]
          var collapsedState = React.useState({ active: false, done: false })
          var collapsed = collapsedState[0]
          var setCollapsed = collapsedState[1]

          React.useEffect(function () {
            var alive = true
            loadTasks().then(function (list) {
              if (alive) { setTasks(list); setLoaded(true) }
            })
            return function () { alive = false }
          }, [])

          var options = React.useMemo(function () {
            var byId = sessionsState && sessionsState.byId ? sessionsState.byId : {}
            var items = workspacesState && Array.isArray(workspacesState.items) ? workspacesState.items : []
            var groups = []
            var used = {}
            function pushSession(list, sid) {
              var summary = byId[sid]
              if (!summary) return
              if (summary.blank === true || summary.origin === 'subagent') return
              list.push({ id: sid, title: summary.displayTitle || summary.title || sid })
            }
            for (var i = 0; i < items.length; i++) {
              var workspace = items[i]
              if (!workspace) continue
              var list = []
              var ids = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []
              for (var j = 0; j < ids.length; j++) {
                pushSession(list, ids[j])
                used[ids[j]] = true
              }
              if (list.length > 0) groups.push({ title: workspace.title || 'Untitled workspace', sessions: list })
            }
            var others = []
            var allIds = sessionsState && Array.isArray(sessionsState.ids) ? sessionsState.ids : []
            for (var k = 0; k < allIds.length; k++) {
              if (used[allIds[k]]) continue
              pushSession(others, allIds[k])
            }
            if (others.length > 0) groups.push({ title: '其他会话 / Other sessions', sessions: others })
            return groups
          }, [sessionsState, workspacesState])

          function persist(next) {
            setTasks(next)
            saveTasks(next)
          }

          function patchTask(id, patch) {
            var now = Date.now()
            persist(tasks.map(function (task) {
              if (task.id !== id) return task
              return { id: task.id, title: task.title, done: task.done, due: task.due, sessionId: task.sessionId, sessionTitle: task.sessionTitle, createdAt: task.createdAt, updatedAt: now, ...patch }
            }))
          }

          function addTask() {
            var title = draft.trim()
            if (title === '') return
            var now = Date.now()
            var task = { id: newId(), title: title, done: false, due: addDue || null, sessionId: null, sessionTitle: null, createdAt: now, updatedAt: now }
            persist([task].concat(tasks))
            setDraft('')
            setAddDue('')
          }

          function removeTask(id) {
            persist(tasks.filter(function (task) { return task.id !== id }))
          }

          function startEdit(task) {
            setEditingId(task.id)
            setEditingText(task.title)
          }

          function commitEdit() {
            var text = editingText.trim()
            if (editingId !== null && text !== '') patchTask(editingId, { title: text })
            setEditingId(null)
          }

          function findSessionTitle(sessionId) {
            for (var i = 0; i < options.length; i++) {
              var group = options[i]
              for (var j = 0; j < group.sessions.length; j++) {
                if (group.sessions[j].id === sessionId) return group.sessions[j].title
              }
            }
            return null
          }

          function bindSession(taskId, sessionId) {
            if (!sessionId) patchTask(taskId, { sessionId: null, sessionTitle: null })
            else patchTask(taskId, { sessionId: sessionId, sessionTitle: findSessionTitle(sessionId) || sessionId })
            setBindingId(null)
          }

          function toggleSection(key) {
            var next = { active: collapsed.active, done: collapsed.done }
            next[key] = !next[key]
            setCollapsed(next)
          }

          function renderPicker(task) {
            var children = []
            children.push(h('option', { key: '__none', value: '' }, t('bind.none')))
            for (var i = 0; i < options.length; i++) {
              var group = options[i]
              children.push(h('optgroup', { key: 'g-' + i, label: group.title },
                group.sessions.map(function (session) {
                  return h('option', { key: session.id, value: session.id }, session.title)
                })
              ))
            }
            return h('div', { className: 'tdl-picker', key: 'picker' }, [
              h('span', { className: 'tdl-picker-label', key: 'label' }, t('bind.title')),
              h('select', {
                key: 'select',
                className: 'tdl-select',
                value: task.sessionId || '',
                onChange: function (event) { bindSession(task.id, event.target.value) },
              }, children),
              h('button', {
                key: 'close', type: 'button', className: 'tdl-mini',
                onClick: function () { setBindingId(null) },
              }, '✕'),
            ])
          }

          function renderDuePicker(task) {
            return h('div', { className: 'tdl-picker', key: 'due-picker' }, [
              h('span', { className: 'tdl-picker-label', key: 'label' }, t('due.edit')),
              h('input', {
                key: 'date', type: 'date', className: 'tdl-date', value: task.due || '',
                onChange: function (event) { patchTask(task.id, { due: event.target.value || null }) },
              }),
              h('button', {
                key: 'today', type: 'button', className: 'tdl-mini',
                onClick: function () { patchTask(task.id, { due: todayStr() }) },
              }, t('due.quickToday')),
              h('button', {
                key: 'tomorrow', type: 'button', className: 'tdl-mini',
                onClick: function () { patchTask(task.id, { due: addDaysStr(1) }) },
              }, t('due.quickTomorrow')),
              h('button', {
                key: 'clear', type: 'button', className: 'tdl-mini',
                onClick: function () { patchTask(task.id, { due: null }) },
              }, t('due.clear')),
              h('button', {
                key: 'close', type: 'button', className: 'tdl-mini',
                onClick: function () { setDueId(null) },
              }, '✕'),
            ])
          }

          function renderTask(task) {
            var editing = editingId === task.id
            var status = task.done === true ? null : dueStatus(task.due)
            var cardCls = 'tdl-task'
            if (task.done === true) cardCls += ' is-done'
            else if (status === 'overdue') cardCls += ' is-overdue'
            else if (status === 'today') cardCls += ' is-today'

            var top = []
            top.push(h('input', {
              key: 'check', type: 'checkbox', className: 'tdl-check',
              checked: task.done === true,
              onChange: function () { patchTask(task.id, { done: !task.done }) },
            }))
            if (editing) {
              top.push(h('input', {
                key: 'edit', className: 'tdl-editinput', autoFocus: true, value: editingText,
                onChange: function (event) { setEditingText(event.target.value) },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') commitEdit()
                  else if (event.key === 'Escape') setEditingId(null)
                },
                onBlur: commitEdit,
              }))
            } else {
              top.push(h('div', {
                key: 'title', className: 'tdl-task-title', title: '双击编辑',
                onDoubleClick: function () { startEdit(task) },
              }, task.title))
            }
            if (task.due) {
              var dueCls = 'tdl-due' + (status === 'overdue' ? ' is-overdue' : status === 'today' ? ' is-today' : '')
              var suffix = status === 'overdue' ? ' · ' + t('due.overdue')
                : status === 'today' ? ' · ' + t('due.today')
                : status === 'tomorrow' ? ' · ' + t('due.tomorrow') : ''
              top.push(h('button', {
                key: 'due', type: 'button', className: dueCls, title: t('due.edit'),
                onClick: function () { setDueId(dueId === task.id ? null : task.id) },
              }, [
                h('span', { key: 'ico', className: 'tdl-due-ico' }, '◷'),
                h('span', { key: 'txt' }, task.due + suffix),
              ]))
            }

            var meta = []
            if (task.sessionId) {
              meta.push(h('button', {
                key: 'chip', type: 'button', className: 'tdl-chip', title: t('action.jump'),
                onClick: function () { openSession(task.sessionId) },
              }, [
                h('span', { key: 'dot', className: 'tdl-chip-dot' }),
                h('span', { key: 'txt', className: 'tdl-chip-text' }, task.sessionTitle || task.sessionId),
              ]))
            } else {
              meta.push(h('span', { key: 'unbound', className: 'tdl-unbound' }, t('unbound')))
            }

            var actions = []
            actions.push(h('button', {
              key: 'due-btn', type: 'button', className: 'tdl-mini',
              onClick: function () { setDueId(dueId === task.id ? null : task.id) },
            }, task.due ? t('due.change') : t('due.set')))
            actions.push(h('button', {
              key: 'bind', type: 'button', className: 'tdl-mini',
              onClick: function () { setBindingId(bindingId === task.id ? null : task.id) },
            }, task.sessionId ? t('action.rebind') : t('action.bind')))
            actions.push(h('button', {
              key: 'edit-btn', type: 'button', className: 'tdl-mini',
              onClick: function () { startEdit(task) },
            }, t('action.edit')))
            actions.push(h('button', {
              key: 'del', type: 'button', className: 'tdl-mini tdl-del',
              onClick: function () { removeTask(task.id) },
            }, t('action.delete')))

            var row = h('div', { key: task.id, className: cardCls }, [
              h('div', { key: 'top', className: 'tdl-task-top' }, top),
              h('div', { key: 'bottom', className: 'tdl-task-bottom' }, [
                h('div', { key: 'meta', className: 'tdl-task-meta' }, meta),
                h('div', { key: 'actions', className: 'tdl-task-actions' }, actions),
              ]),
            ])
            var extras = []
            if (dueId === task.id) extras.push(renderDuePicker(task))
            if (bindingId === task.id) extras.push(renderPicker(task))
            if (extras.length > 0) return h('div', { key: task.id, className: 'tdl-task-wrap' }, [row].concat(extras))
            return row
          }

          function renderSection(key, label, list) {
            var isCollapsed = collapsed[key] === true
            var body
            if (isCollapsed) {
              body = null
            } else if (list.length > 0) {
              body = h('div', { className: 'tdl-sec-body', key: 'body' }, list.map(renderTask))
            } else {
              body = h('div', { className: 'tdl-sec-body', key: 'body' }, [
                h('div', { key: 'empty', className: 'tdl-empty-inline' }, key === 'active' ? t('empty') : t('emptyDone')),
              ])
            }
            return h('div', { className: 'tdl-section', key: 'sec-' + key }, [
              h('button', {
                key: 'head', type: 'button', className: 'tdl-sec-head',
                onClick: function () { toggleSection(key) },
              }, [
                h('span', { key: 'caret', className: 'tdl-caret' }, isCollapsed ? '▸' : '▾'),
                h('span', { key: 'title', className: 'tdl-sec-title' }, label),
                h('span', { key: 'badge', className: 'tdl-badge' }, String(list.length)),
              ]),
              body,
            ])
          }

          var activeTasks = tasks.filter(function (task) { return task.done !== true }).slice().sort(function (a, b) {
            var av = a.due || '9999-99-99'
            var bv = b.due || '9999-99-99'
            if (av !== bv) return av < bv ? -1 : 1
            return (a.createdAt || 0) - (b.createdAt || 0)
          })
          var doneTasks = tasks.filter(function (task) { return task.done === true }).slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0)
          })
          var overdueCount = activeTasks.filter(function (task) { return dueStatus(task.due) === 'overdue' }).length
          var doneCount = tasks.length - activeTasks.length
          var donePct = tasks.length > 0 ? Math.round(doneCount / tasks.length * 100) : 0

          var content = []
          content.push(h('div', { className: 'tdl-header', key: 'header' }, [
            h('div', { className: 'tdl-titlerow', key: 'title' }, [
              h('h2', { className: 'tdl-h1', key: 'h1' }, [
                h('svg', {
                  key: 'ico', width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
                  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
                  'aria-hidden': 'true',
                }, [
                  h('rect', { key: 'r', x: 4, y: 3.5, width: 16, height: 17, rx: 3 }),
                  h('path', { key: 'c1', d: 'M8.5 9.5l1.4 1.4 2.6-2.9' }),
                  h('path', { key: 'c2', d: 'M8.5 15l1.4 1.4 2.6-2.9' }),
                  h('path', { key: 'l1', d: 'M14.5 9.8h3.2' }),
                  h('path', { key: 'l2', d: 'M14.5 15.3h3.2' }),
                ]),
                h('span', { key: 'txt' }, t('page.title')),
              ]),
              h('span', { className: 'tdl-sub', key: 'sub' }, t('page.subtitle', { total: tasks.length, n: activeTasks.length })),
              overdueCount > 0 ? h('span', { className: 'tdl-subwarn', key: 'warn' }, t('due.overdueCount', { n: overdueCount })) : null,
            ]),
            h('div', { className: 'tdl-addrow', key: 'add' }, [
              h('input', {
                key: 'input', className: 'tdl-input', placeholder: t('add.placeholder'), value: draft,
                onChange: function (event) { setDraft(event.target.value) },
                onKeyDown: function (event) { if (event.key === 'Enter') addTask() },
              }),
              h('input', {
                key: 'adddue', type: 'date', className: 'tdl-adddate', value: addDue, title: t('due.edit'),
                onChange: function (event) { setAddDue(event.target.value) },
              }),
              h('button', {
                key: 'btn', type: 'button', className: 'tdl-add', disabled: draft.trim() === '',
                onClick: addTask,
              }, t('add.button')),
            ]),
            tasks.length > 0 ? h('div', { className: 'tdl-progresswrap', key: 'progress' }, [
              h('div', { className: 'tdl-progress', key: 'bar' }, [
                h('i', { key: 'fill', style: { width: donePct + '%' } }),
              ]),
              h('span', { className: 'tdl-progress-label', key: 'label' }, doneCount + ' / ' + tasks.length),
            ]) : null,
          ]))

          var scrollChildren = []
          if (!loaded) scrollChildren.push(h('div', { key: 'loading', className: 'tdl-loading' }, t('loading')))
          scrollChildren.push(renderSection('active', t('section.active'), activeTasks))
          if (doneTasks.length > 0) scrollChildren.push(renderSection('done', t('section.done'), doneTasks))
          if (doneTasks.length > 0) {
            scrollChildren.push(h('div', { key: 'foot', className: 'tdl-foot' }, [
              h('button', {
                key: 'clear', type: 'button', className: 'tdl-linkbtn',
                onClick: function () { persist(activeTasks) },
              }, t('clearDone')),
            ]))
          }
          content.push(h('div', { className: 'tdl-scroll', key: 'scroll' }, [
            h('div', { className: 'tdl-inner', key: 'inner' }, scrollChildren),
          ]))

          return h('section', { className: 'tdl-page', 'aria-label': t('page.title') }, content)
        }

        Panel.displayName = 'TodolistPanel'
        return Panel
      }

      function apply(ctx) {
        ctx.effect(function () { return ctx.locale.register(NS, { zh: ZH, en: EN }) }, 'todolist: dictionaries')
        var t = ctx.locale.bind(NS)
        injectStyles()

        var Panel = createPanel(ctx, t)
        var Icon = createIcon()

        ctx.slots.inject('main', function () {
          return ctx.slots.register({ name: 'main', key: MODULE_ID, locale: NS }, function (props) {
            return h(Panel, props)
          })
        })

        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: MODULE_ID,
            order: 30,
            label: function () { return t('nav.title') },
            locale: NS,
          }, function (props) {
            return h(Icon, { size: props && typeof props.size === 'number' ? props.size : undefined })
          })
        })
      }

      module.exports = { name: MODULE_ID, inject: ['slots', 'locale'], apply: apply }
      return module.exports
    },
  })
})()
