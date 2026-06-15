import { ScumPluginBridge, type BridgeContext } from './bridge'
import { domainRoutes, normalToolRoutes, routeFor, type DomainRoute } from './resources/domainCatalog'

type PluginEnvelope = {
  kind?: 'domain_result' | 'operation_handle' | 'unavailable'
  state?: 'loading' | 'available' | 'empty' | 'denied' | 'unavailable' | 'not_migrated' | 'deferred' | 'pending_dispatch' | 'failed'
  route?: string
  domain?: string
  title?: string
  summary?: string
  data?: Record<string, unknown>
  operation?: Record<string, unknown>
  unavailable?: {
    code?: string
    reasonCode?: string
    summary?: string
    nextAction?: string
  }
  error?: {
    code?: string
    message?: string
  }
}

type SourceSummary = {
  kind?: string
  mode?: string
  summary?: string
}

type RenderState = {
  bridge: ScumPluginBridge
  context: BridgeContext | null
  route: DomainRoute
  content: HTMLElement
  status: HTMLElement
  nav: HTMLElement
}

type ConfigWorkspace = {
  key: string
  title: string
  directoryPath: string
  supportedFiles?: string[]
  defaultFilePath?: string
  summary?: string
}

type LogWorkspace = {
  key: string
  title: string
  directoryPath: string
  preferredFiles?: string[]
  summary?: string
}

type StructuredField = {
  section: string
  key: string
  label: string
  validator: string
  sensitive?: boolean
}

type ResolvedStructuredField = StructuredField & {
  value: string
}

type FileListEntry = {
  name: string
  relativePath: string
  directory?: boolean
  sizeBytes?: number
  modifiedAt?: string
}

type CoreFileOperation = {
  id: string
  status: string
  result?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
}

type CoreFileDispatchResponse = {
  operation: CoreFileOperation
}

const sampleStructuredFields: StructuredField[] = [
  { section: 'SCUM.Server', key: 'MaxPlayers', label: '最大玩家数', validator: '1-256' },
  { section: 'SCUM.Server', key: 'ServerName', label: '服务器名称', validator: '1-128 字符' }
]

const emptyEnvelope = (route: DomainRoute, state: PluginEnvelope['state'] = 'unavailable'): PluginEnvelope => ({
  kind: 'unavailable',
  state,
  route: route.key,
  domain: route.key,
  title: route.title,
  summary: route.summary,
  unavailable: {
    code: route.unavailable.reasonCode,
    reasonCode: route.unavailable.reasonCode,
    summary: route.unavailable.summary,
    nextAction: route.unavailable.nextAction
  }
})

const pluginSkin = `
  :root {
    color-scheme: dark;
    background: transparent;
  }

  html,
  body {
    min-height: 100%;
    margin: 0;
    background: transparent;
  }

  * {
    box-sizing: border-box;
  }

  .scum-admin-plugin {
    --plugin-primary: var(--plugin-theme-primary-color, #36ad6a);
    --plugin-primary-hover: var(--plugin-theme-primary-color-hover, #43c177);
    --plugin-info: var(--plugin-theme-info-color, #4098fc);
    --plugin-warning: var(--plugin-theme-warning-color, #ffb020);
    --plugin-error: var(--plugin-theme-error-color, #f23f42);
    --plugin-bg: var(--plugin-theme-app-bg-color, #101014);
    --plugin-panel: var(--plugin-theme-panel-bg-color, rgba(23, 27, 36, 0.78));
    --plugin-panel-strong: var(--plugin-theme-panel-strong-bg-color, rgba(21, 25, 34, 0.96));
    --plugin-panel-soft: var(--plugin-theme-hover-color, rgba(255, 255, 255, 0.045));
    --plugin-border: var(--plugin-theme-border-color, rgba(255, 255, 255, 0.12));
    --plugin-border-strong: rgba(255, 255, 255, 0.18);
    --plugin-text: var(--plugin-theme-text-color, #f4f4f5);
    --plugin-text-strong: #f8fafc;
    --plugin-muted: var(--plugin-theme-muted-text-color, #a1a1aa);
    --plugin-control: var(--plugin-theme-control-bg-color, rgba(16, 16, 20, 0.78));
    --plugin-control-focus: var(--plugin-theme-control-focus-bg-color, rgba(16, 16, 20, 0.92));
    --plugin-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
    min-height: 100vh;
    padding: 16px;
    color: var(--plugin-text);
    background: transparent;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }

  .scum-admin-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 0 0 16px;
    border-bottom: 1px solid var(--plugin-border);
  }

  .scum-admin-header h1 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 22px;
    font-weight: 720;
  }

  .scum-admin-status {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.5;
  }

  .scum-admin-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 16px 0;
  }

  .scum-admin-tabs button {
    min-height: 34px;
    padding: 7px 11px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: #d4d4d8;
    background: var(--plugin-control);
    cursor: pointer;
    font: inherit;
    letter-spacing: 0;
  }

  .scum-admin-tabs button:hover {
    border-color: color-mix(in srgb, var(--plugin-primary) 45%, transparent);
    color: #ffffff;
    background: var(--plugin-panel-soft);
  }

  .scum-admin-tabs button[aria-current="page"] {
    border-color: color-mix(in srgb, var(--plugin-primary) 55%, transparent);
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 16%, transparent);
  }

  .scum-admin-tabs button[data-status="not_migrated"],
  .scum-admin-tabs button[data-status="deferred"] {
    color: #8b8b94;
  }

  .route-surface {
    padding: 16px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
      var(--plugin-panel-strong);
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), var(--plugin-shadow);
  }

  .surface-title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .surface-title h2 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 18px;
    font-weight: 700;
  }

  .surface-title p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.5;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 4px 9px;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    color: #d4d4d8;
    background: var(--plugin-panel-soft);
    font-size: 12px;
    white-space: nowrap;
  }

  .status-pill[data-tone="ok"] {
    border-color: rgba(54, 173, 106, 0.5);
    color: #9ae6b4;
    background: rgba(54, 173, 106, 0.14);
  }

  .status-pill[data-tone="warn"] {
    border-color: rgba(255, 176, 32, 0.5);
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.12);
  }

  .status-pill[data-tone="error"] {
    border-color: rgba(242, 63, 66, 0.52);
    color: #ffb4b5;
    background: rgba(242, 63, 66, 0.12);
  }

  .controls {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    margin: 12px 0;
  }

  .controls input,
  .controls select,
  .field-grid input {
    min-height: 36px;
    padding: 8px 9px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    color: var(--plugin-text);
    background: var(--plugin-control);
    font: inherit;
    letter-spacing: 0;
    outline: none;
  }

  .controls input:focus,
  .controls select:focus,
  .field-grid input:focus {
    border-color: var(--plugin-primary);
    background: var(--plugin-control-focus);
  }

  .controls input::placeholder {
    color: #71717a;
  }

  .controls button,
  .action-button {
    min-height: 36px;
    padding: 8px 11px;
    border: 1px solid var(--plugin-primary);
    border-radius: 6px;
    color: #ffffff;
    background: var(--plugin-primary);
    cursor: pointer;
    font: inherit;
    letter-spacing: 0;
  }

  .controls button:hover,
  .action-button:hover {
    border-color: var(--plugin-primary-hover);
    background: var(--plugin-primary-hover);
  }

  .controls button.secondary,
  .action-button.secondary {
    border-color: var(--plugin-border-strong);
    color: #d4d4d8;
    background: var(--plugin-panel-soft);
  }

  .controls button.secondary:hover,
  .action-button.secondary:hover {
    border-color: rgba(255, 255, 255, 0.24);
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .controls button:disabled,
  .action-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .notice {
    margin: 10px 0;
    padding: 10px;
    border: 1px solid rgba(255, 176, 32, 0.45);
    border-radius: 6px;
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.1);
    line-height: 1.5;
  }

  .notice p {
    margin: 6px 0 0;
  }

  .notice.error {
    border-color: rgba(242, 63, 66, 0.52);
    color: #ffb4b5;
    background: rgba(242, 63, 66, 0.12);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .meta-item {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    background: var(--plugin-panel-soft);
  }

  .meta-item strong {
    display: block;
    margin-bottom: 4px;
    color: var(--plugin-text-strong);
    font-size: 12px;
  }

  .meta-item span {
    color: var(--plugin-muted);
    font-size: 12px;
    word-break: break-word;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .field-grid label {
    display: grid;
    gap: 6px;
    min-width: 0;
    color: var(--plugin-muted);
  }

  .field-grid strong {
    color: var(--plugin-text);
    font-size: 13px;
  }

  .field-grid span {
    color: var(--plugin-muted);
    font-size: 12px;
  }

  .diff-box,
  .log-box {
    max-height: 260px;
    overflow: auto;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #dbeafe;
    background: rgba(6, 10, 20, 0.92);
    white-space: pre-wrap;
    word-break: break-word;
  }

  table {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 9px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #d4d4d8;
    background: rgba(255, 255, 255, 0.04);
    font-size: 12px;
    font-weight: 680;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.045);
  }

  .empty {
    padding: 18px;
    border: 1px dashed rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.025);
    text-align: center;
  }

  .task-list {
    display: grid;
    gap: 10px;
  }

  .task-row {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: var(--plugin-text);
    background: var(--plugin-panel);
  }

  .task-row p {
    margin: 0;
    color: var(--plugin-muted);
  }

  .task-row details {
    color: var(--plugin-muted);
  }

  .task-row pre {
    overflow: auto;
    margin: 8px 0 0;
    color: #dbeafe;
    white-space: pre-wrap;
  }

  @media (max-width: 700px) {
    .scum-admin-header,
    .surface-title {
      display: block;
    }

    .controls {
      display: grid;
    }

    .controls input,
    .controls select,
    .controls button {
      width: 100%;
    }
  }
`

export const mount = async () => {
  const root = document.getElementById('scum-admin-plugin-root') || document.body
  const initialRoute = new URL(window.location.href).searchParams.get('routeKey') || 'settings'
  const bridge = new ScumPluginBridge('scum-admin', '0.1.8', initialRoute)
  const panel = document.createElement('main')
  panel.className = 'scum-admin-plugin'
  panel.innerHTML = `
    <style>
      ${pluginSkin}
    </style>
    <header class="scum-admin-header">
      <div>
        <h1>SCUM 管理</h1>
        <p class="scum-admin-status" data-role="status">正在通过 host bridge 初始化...</p>
      </div>
    </header>
    <nav class="scum-admin-tabs" aria-label="SCUM 管理域" data-role="nav"></nav>
    <section class="route-surface" data-role="content"></section>
  `
  root.appendChild(panel)
  bridge.onContext((context) => applyPluginTheme(panel, context.themeTokens))

  const status = panel.querySelector<HTMLElement>('[data-role="status"]')
  const nav = panel.querySelector<HTMLElement>('[data-role="nav"]')
  const content = panel.querySelector<HTMLElement>('[data-role="content"]')
  if (!status || !nav || !content) {
    return
  }

  const renderState: RenderState = {
    bridge,
    context: null,
    route: routeFor(initialRoute),
    content,
    status,
    nav
  }

  renderNav(renderState)
  renderShell(renderState, { state: 'loading', title: renderState.route.title, summary: renderState.route.summary })

  try {
    const context = await bridge.init()
    renderState.context = context
    renderState.route = routeFor(context.routeKey || initialRoute)
    status.textContent = `已连接 host bridge，当前实例：${context.serverInstanceId || '未选择'}`
    renderNav(renderState)
    await renderRoute(renderState, renderState.route.key)
    bridge.ready({ surface: renderState.route.key, routes: domainRoutes.map((route) => route.key) })
    bridge.height(document.documentElement.scrollHeight)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    status.textContent = `host bridge 初始化失败：${message}`
    bridge.error(error)
  }
}

const applyPluginTheme = (panel: HTMLElement, tokens: BridgeContext['themeTokens']) => {
  if (!tokens) {
    return
  }
  for (const [key, value] of Object.entries(tokens)) {
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) && typeof value === 'string') {
      panel.style.setProperty(`--plugin-theme-${kebabCase(key)}`, value)
    }
  }
}

const renderNav = (state: RenderState) => {
  const visibleRoutes = routeTabsFor(state.route)
  state.nav.innerHTML = visibleRoutes.map((route) => `
    <button type="button" data-route="${route.key}" data-status="${route.migrationStatus}" aria-current="${route.key === state.route.key ? 'page' : 'false'}">
      ${escapeHtml(route.title)}
    </button>
  `).join('')
  state.nav.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.addEventListener('click', () => {
      void renderRoute(state, button.dataset.route || 'settings')
    })
  })
}

const routeTabsFor = (route: DomainRoute) => {
  if (normalToolRoutes.some((item) => item.key === route.key)) {
    return normalToolRoutes
  }
  return [route, ...normalToolRoutes]
}

const renderRoute = async (state: RenderState, routeKey: string) => {
  state.route = routeFor(routeKey)
  renderNav(state)
  renderShell(state, { state: 'loading', title: state.route.title, summary: state.route.summary })
  if (state.route.migrationStatus === 'not_migrated' || state.route.migrationStatus === 'deferred') {
    renderUnavailableRoute(state, emptyEnvelope(state.route, state.route.migrationStatus))
    return
  }
  if (state.route.key === 'update') {
    renderUpdatePage(state, emptyEnvelope(state.route, 'available'))
    return
  }
  try {
    const envelope = await state.bridge.api<PluginEnvelope>(state.route.apiPath, state.route.method, requestBodyFor(state.route))
    renderDomainPage(state, normalizeEnvelope(state.route, envelope))
  } catch (error) {
    renderDomainPage(state, failedEnvelope(state.route, error))
  }
}

const renderShell = (state: RenderState, envelope: PluginEnvelope) => {
  const route = state.route
  const tone = statusTone(envelope)
  state.content.innerHTML = `
    <div class="surface-title">
      <div>
        <h2>${escapeHtml(route.title)}</h2>
        <p>${escapeHtml(route.summary)}</p>
      </div>
      <span class="status-pill" data-tone="${tone}">${statusText(route, envelope)}</span>
    </div>
    <div data-role="route-body"><div class="empty">正在加载 ${escapeHtml(route.title)}...</div></div>
  `
}

const renderDomainPage = (state: RenderState, envelope: PluginEnvelope) => {
  switch (state.route.key) {
    case 'settings':
      renderSettingsPage(state, envelope)
      return
    case 'players':
      renderPlayersPage(state, envelope)
      return
    case 'vehicles':
      renderCollectionPage(state, envelope, {
        empty: '暂无载具数据。',
        columns: [
          { key: 'id', label: '载具 ID' },
          { key: 'vehicleType', label: '载具类型' },
          { key: 'ownerPrisonerId', label: '归属玩家' },
          { key: 'locationX', label: 'X' },
          { key: 'locationY', label: 'Y' },
          { key: 'locationZ', label: 'Z' }
        ]
      })
      return
    case 'territories':
      renderCollectionPage(state, envelope, {
        empty: '暂无领地或小队数据。',
        columns: [
          { key: 'territoryId', label: '领地 ID' },
          { key: 'ownerName', label: '归属角色' },
          { key: 'ownerSteamId', label: 'SteamID' },
          { key: 'squadName', label: '所属小队' },
          { key: 'locationX', label: 'X' },
          { key: 'locationY', label: 'Y' }
        ]
      })
      return
    case 'locks':
      renderCollectionPage(state, envelope, {
        empty: '暂无锁具数据。',
        columns: [
          { key: 'id', label: '锁具 ID' },
          { key: 'lockType', label: '锁具类型' },
          { key: 'ownerPrisonerId', label: '归属玩家' },
          { key: 'locationX', label: 'X' },
          { key: 'locationY', label: 'Y' },
          { key: 'locationZ', label: 'Z' }
        ]
      })
      return
    case 'logs':
      renderLogsPage(state, envelope)
      return
    case 'tasks':
      renderTasksPage(state, envelope)
      return
    case 'database':
      renderDatabaseNotice(state, envelope)
      return
    default:
      renderUnavailableRoute(state, envelope)
  }
}

const renderUnavailableRoute = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  body(state).innerHTML = `
    <div class="notice">
      <strong>${escapeHtml(envelope.unavailable?.reasonCode || state.route.unavailable.reasonCode)}</strong>
      <p>${escapeHtml(envelope.unavailable?.summary || state.route.unavailable.summary)}</p>
      <p>${escapeHtml(envelope.unavailable?.nextAction || state.route.unavailable.nextAction)}</p>
    </div>
  `
}

const renderDatabaseNotice = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  body(state).innerHTML = `
    <div class="notice">
      数据库独立查询页当前只作为直接访问的迁移占位。玩家、日志等业务页会通过插件后端使用受控查询模板。
    </div>
  `
}

const renderSettingsPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const workspaces = Array.isArray(envelope.data?.workspaces) ? envelope.data.workspaces as ConfigWorkspace[] : []
  const supportedFiles = Array.isArray(envelope.data?.supportedFiles)
    ? envelope.data.supportedFiles.filter((item): item is string => typeof item === 'string')
    : []
  const structuredFields = Array.isArray(envelope.data?.structuredFields) ? envelope.data.structuredFields as StructuredField[] : sampleStructuredFields
  const structuredPath = typeof envelope.data?.structuredPath === 'string' ? envelope.data.structuredPath : ''
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="controls">
      <select data-role="settings-workspace" ${blocked ? 'disabled' : ''}>
        ${workspaces.map((workspace) => `
          <option value="${escapeHtml(workspace.key)}">${escapeHtml(workspace.title)}</option>
        `).join('')}
      </select>
      <select data-role="settings-file" ${blocked ? 'disabled' : ''}></select>
      <button type="button" class="action-button" data-action="reload-settings" ${blocked ? 'disabled' : ''}>读取配置</button>
    </div>
    <div class="notice" data-role="settings-status">等待读取配置目录。</div>
    <div class="meta-grid" data-role="settings-meta"></div>
    <div class="field-grid" data-role="settings-fields"></div>
    <pre class="diff-box" data-role="diff">暂无配置内容。</pre>
  `
  if (blocked || workspaces.length === 0) {
    return
  }
  const run = () => {
    void loadSettingsWorkspace(state, workspaces, supportedFiles, structuredFields, structuredPath)
  }
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-settings"]')?.addEventListener('click', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.addEventListener('change', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.addEventListener('change', () => {
    void loadSettingsFile(state, structuredFields, structuredPath)
  })
  run()
}

const renderPlayersPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const rows = rowsFromEnvelope(envelope, [
    { id: 'sample-1', name: 'Prisoner One', steamId: '7656******0001', lastSeen: '待执行端返回', status: blocked ? '不可用' : '在线' }
  ])
  const source = sourceSummary(envelope)
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    ${source ? `<div class="notice"><strong>数据来源</strong><p>${escapeHtml(source)}</p></div>` : ''}
    <div class="controls">
      <input type="search" data-role="player-search" placeholder="搜索玩家、SteamID 或状态" />
      <button type="button" class="action-button secondary" data-action="show-player-detail" ${rows.length === 0 ? 'disabled' : ''}>查看详情</button>
      <button type="button" class="action-button secondary" disabled>踢出</button>
      <button type="button" class="action-button secondary" disabled>封禁</button>
      <button type="button" class="action-button secondary" disabled>发物品</button>
    </div>
    <div data-role="players-table">${playersTable(rows)}</div>
    <div class="task-row" data-role="player-detail">选择“查看详情”以显示当前第一名玩家的结构化详情占位。</div>
  `
  body(state).querySelector<HTMLInputElement>('[data-role="player-search"]')?.addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value.toLowerCase()
    const filtered = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)))
    const table = body(state).querySelector<HTMLElement>('[data-role="players-table"]')
    if (table) {
      table.innerHTML = playersTable(filtered)
    }
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="show-player-detail"]')?.addEventListener('click', () => {
    const target = body(state).querySelector<HTMLElement>('[data-role="player-detail"]')
    if (!target) {
      return
    }
    const first = rows[0] || {}
    target.innerHTML = `
      <strong>${escapeHtml(String(first.name || first.id || '玩家详情'))}</strong>
      <p>SteamID: ${escapeHtml(String(first.steamId || first.steamID || '-'))}</p>
      <p>状态: ${escapeHtml(String(first.status || '-'))}</p>
      <p>最近活动: ${escapeHtml(String(first.lastSeen || first.updatedAt || '-'))}</p>
      <details>
        <summary>查看结构化数据</summary>
        <pre>${escapeHtml(JSON.stringify(first, null, 2))}</pre>
      </details>
    `
  })
}

const renderCollectionPage = (
  state: RenderState,
  envelope: PluginEnvelope,
  options: { empty: string; columns: Array<{ key: string; label: string }> }
) => {
  renderShell(state, envelope)
  const source = sourceSummary(envelope)
  const blocked = !isUsable(envelope)
  const rows = rowsFromEnvelope(envelope, blocked ? [] : [sampleRow(options.columns)])
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    ${source ? `<div class="notice"><strong>数据来源</strong><p>${escapeHtml(source)}</p></div>` : ''}
    ${genericTable(rows, options.columns, options.empty)}
  `
}

const renderLogsPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const workspaces = Array.isArray(envelope.data?.workspaces) ? envelope.data.workspaces as LogWorkspace[] : []
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="controls">
      <select data-role="log-workspace" ${blocked ? 'disabled' : ''}>
        ${workspaces.map((workspace) => `
          <option value="${escapeHtml(workspace.key)}">${escapeHtml(workspace.title)}</option>
        `).join('')}
      </select>
      <select data-role="log-file" ${blocked ? 'disabled' : ''}></select>
      <button type="button" class="action-button" data-action="reload-logs" ${blocked ? 'disabled' : ''}>读取日志</button>
    </div>
    <div class="notice" data-role="logs-status">等待读取日志目录。</div>
    <div class="meta-grid" data-role="logs-meta"></div>
    <pre class="log-box" data-role="logs">暂无日志结果。</pre>
  `
  if (blocked || workspaces.length === 0) {
    return
  }
  const run = () => {
    void loadLogWorkspace(state, workspaces)
  }
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-logs"]')?.addEventListener('click', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="log-workspace"]')?.addEventListener('change', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="log-file"]')?.addEventListener('change', () => {
    void loadLogFile(state)
  })
  run()
}

const loadSettingsWorkspace = async (state: RenderState, workspaces: ConfigWorkspace[], supportedFiles: string[], structuredFields: StructuredField[], structuredPath: string) => {
  const workspaceKey = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.value || workspaces[0]?.key || ''
  const workspace = workspaces.find((item) => item.key === workspaceKey) || workspaces[0]
  if (!workspace) {
    setRouteNotice(state, 'settings-status', '未找到配置目录。', true)
    return
  }
  setRouteNotice(state, 'settings-status', `正在读取 ${workspace.title}...`)
  try {
    const entries = await loadDirectoryEntries(state, workspace.directoryPath)
    const scopedSupportedFiles = workspace.supportedFiles && workspace.supportedFiles.length > 0 ? workspace.supportedFiles : supportedFiles
    const filteredEntries = filterEntriesByRelativePath(entries, scopedSupportedFiles)
    const prioritizedEntries = prioritizeFiles(filteredEntries, scopedSupportedFiles)
    populateFileSelect(state, 'settings-file', prioritizedEntries, workspace.defaultFilePath)
    setRouteNotice(state, 'settings-status', `${workspace.title} 已加载，共 ${prioritizedEntries.length} 个受支持文件。`)
    await loadSettingsFile(state, structuredFields, structuredPath)
  } catch (error) {
    setRouteNotice(state, 'settings-status', coreErrorMessage(error), true)
    setRouteMeta(state, 'settings-meta', [])
    setSettingsFields(state, [])
    setDiff(state, '暂无配置内容。')
  }
}

const loadSettingsFile = async (state: RenderState, structuredFields: StructuredField[], structuredPath: string) => {
  const relativePath = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.value || ''
  if (!relativePath) {
    setRouteNotice(state, 'settings-status', '当前目录下没有可读取的配置文件。', true)
    setRouteMeta(state, 'settings-meta', [])
    setSettingsFields(state, [])
    setDiff(state, '暂无配置内容。')
    return
  }
  setRouteNotice(state, 'settings-status', `正在读取 ${relativePath}...`)
  try {
    const result = await readFile(state, relativePath)
    const content = typeof result.content === 'string' ? result.content : ''
    const redacted = redactSecrets(content)
    const fields = relativePath === structuredPath
      ? resolveStructuredFields(structuredFields, content)
      : []
    setSettingsFields(state, fields)
    setRouteMeta(state, 'settings-meta', [
      { label: '文件路径', value: relativePath },
      { label: '校验和', value: typeof result.checksum === 'string' ? result.checksum : '-' },
      { label: '文件大小', value: formatByteCount(result.sizeBytes) },
      { label: '截断状态', value: result.truncated ? '已截断' : '完整' }
    ])
    setDiff(state, redacted || '文件为空。')
    setRouteNotice(state, 'settings-status', `${relativePath} 已加载。`)
  } catch (error) {
    setRouteNotice(state, 'settings-status', coreErrorMessage(error), true)
    setRouteMeta(state, 'settings-meta', [])
    setSettingsFields(state, [])
    setDiff(state, '暂无配置内容。')
  }
}

const loadLogWorkspace = async (state: RenderState, workspaces: LogWorkspace[]) => {
  const workspaceKey = body(state).querySelector<HTMLSelectElement>('[data-role="log-workspace"]')?.value || workspaces[0]?.key || ''
  const workspace = workspaces.find((item) => item.key === workspaceKey) || workspaces[0]
  if (!workspace) {
    setRouteNotice(state, 'logs-status', '未找到日志目录。', true)
    return
  }
  setRouteNotice(state, 'logs-status', `正在读取 ${workspace.title}...`)
  try {
    const entries = await loadDirectoryEntries(state, workspace.directoryPath)
    populateFileSelect(state, 'log-file', prioritizeFiles(entries, workspace.preferredFiles || []))
    setRouteNotice(state, 'logs-status', `${workspace.title} 已加载，共 ${entries.length} 个文件。`)
    await loadLogFile(state)
  } catch (error) {
    setRouteNotice(state, 'logs-status', coreErrorMessage(error), true)
    setRouteMeta(state, 'logs-meta', [])
    setLogText(state, '暂无日志结果。')
  }
}

const loadLogFile = async (state: RenderState) => {
  const relativePath = body(state).querySelector<HTMLSelectElement>('[data-role="log-file"]')?.value || ''
  if (!relativePath) {
    setRouteNotice(state, 'logs-status', '当前目录下没有可读取的日志文件。', true)
    setRouteMeta(state, 'logs-meta', [])
    setLogText(state, '暂无日志结果。')
    return
  }
  setRouteNotice(state, 'logs-status', `正在读取 ${relativePath}...`)
  try {
    const result = await readFile(state, relativePath)
    const content = typeof result.content === 'string' ? result.content : ''
    setRouteMeta(state, 'logs-meta', [
      { label: '文件路径', value: relativePath },
      { label: '校验和', value: typeof result.checksum === 'string' ? result.checksum : '-' },
      { label: '文件大小', value: formatByteCount(result.sizeBytes) },
      { label: '截断状态', value: result.truncated ? `已截断，偏移 ${result.readOffset || 0}` : '完整' }
    ])
    setLogText(state, redactSecrets(content) || '日志文件为空。')
    setRouteNotice(state, 'logs-status', `${relativePath} 已加载。`)
  } catch (error) {
    setRouteNotice(state, 'logs-status', coreErrorMessage(error), true)
    setRouteMeta(state, 'logs-meta', [])
    setLogText(state, '暂无日志结果。')
  }
}

const renderUpdatePage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  body(state).innerHTML = `
    <div class="notice">
      更新和重启属于高风险操作。必须勾选确认后，插件才会提交受治理的 operation handle。
    </div>
    <label class="controls">
      <input type="checkbox" data-role="confirm-update" />
      <span>我确认这是当前服务器的维护窗口</span>
    </label>
    <div class="controls">
      <button type="button" class="action-button" data-action="update-server">更新服务端</button>
      <button type="button" class="action-button secondary" data-action="restart-server">受控重启</button>
    </div>
    <div class="task-row" data-role="operation-result">尚未提交操作。</div>
  `
  bindOperationButton(state, 'update-server', 'update/server')
  bindOperationButton(state, 'restart-server', 'server/restart')
}

const renderTasksPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const tasks = rowsFromEnvelope(envelope, [
    { id: 'pending-dispatch', type: 'plugin-operation', status: blocked ? '不可用' : '等待执行端', summary: '等待插件任务状态能力返回结果' }
  ])
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="task-list">
      ${tasks.map((task) => `
        <article class="task-row">
          <strong>${escapeHtml(String(task.type || task.id || '任务'))}</strong>
          <span>${escapeHtml(String(task.status || '状态未知'))}</span>
          <p>${escapeHtml(String(task.summary || '暂无摘要'))}</p>
          <details>
            <summary>查看安全详情</summary>
            <pre>${escapeHtml(JSON.stringify(task, null, 2))}</pre>
          </details>
        </article>
      `).join('')}
    </div>
  `
}

const bindOperationButton = (state: RenderState, action: string, apiPath: string) => {
  body(state).querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener('click', async () => {
    const confirmed = body(state).querySelector<HTMLInputElement>('[data-role="confirm-update"]')?.checked || false
    const target = body(state).querySelector<HTMLElement>('[data-role="operation-result"]')
    if (!confirmed) {
      if (target) {
        target.textContent = '请先确认维护窗口。'
      }
      return
    }
    if (target) {
      target.textContent = '正在提交 operation handle...'
    }
    const result = await state.bridge.api<PluginEnvelope>(apiPath, 'POST', { confirmed: true, action })
      .catch((error) => failedEnvelope(state.route, error))
    if (target) {
      target.textContent = operationSummary(normalizeEnvelope(state.route, result))
    }
  })
}

const playersTable = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return '<div class="empty">没有匹配的玩家。</div>'
  }
  return `
    <table>
      <thead><tr><th>玩家</th><th>SteamID</th><th>状态</th><th>最近活动</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(String(row.name || row.id || '-'))}</td>
            <td>${escapeHtml(String(row.steamId || row.steamID || '-'))}</td>
            <td>${escapeHtml(String(row.status || '-'))}</td>
            <td>${escapeHtml(String(row.lastSeen || row.updatedAt || '-'))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

const genericTable = (rows: Record<string, unknown>[], columns: Array<{ key: string; label: string }>, empty: string) => {
  if (rows.length === 0) {
    return `<div class="empty">${escapeHtml(empty)}</div>`
  }
  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((column) => `<td>${escapeHtml(String(row[column.key] ?? '-'))}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `
}

const sampleRow = (columns: Array<{ key: string; label: string }>) => {
  const row: Record<string, unknown> = {}
  for (const column of columns) {
    row[column.key] = `待返回${column.label}`
  }
  return row
}

const loadDirectoryEntries = async (state: RenderState, relativePath: string) => {
  const serverInstanceID = currentServerInstanceID(state)
  const dispatch = await coreJSON<CoreFileDispatchResponse>(`/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files?path=${encodeURIComponent(relativePath)}`)
  const operation = await waitForFileOperation(dispatch.operation.id)
  return normalizeFileEntries(operation.result?.entries)
}

const readFile = async (state: RenderState, relativePath: string) => {
  const serverInstanceID = currentServerInstanceID(state)
  const dispatch = await coreJSON<CoreFileDispatchResponse>(`/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files/read`, {
    method: 'POST',
    body: JSON.stringify({ path: relativePath, contentMode: 'text' })
  })
  const operation = await waitForFileOperation(dispatch.operation.id)
  return {
    content: operation.result?.content,
    checksum: operation.result?.checksum,
    sizeBytes: Number(operation.result?.sizeBytes || 0),
    truncated: Boolean(operation.result?.truncated),
    readOffset: Number(operation.result?.readOffset || 0)
  }
}

const coreJSON = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  })
  if (!response.ok) {
    throw new Error(await readErrorSummary(response))
  }
  return await response.json() as T
}

const waitForFileOperation = async (operationID: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const operation = await coreJSON<CoreFileOperation>(`/api/v1/file-operations/${encodeURIComponent(operationID)}`)
    if (operation.status === 'succeeded') {
      return operation
    }
    if (operation.status === 'failed' || operation.status === 'rejected' || operation.status === 'conflicted') {
      throw new Error(operation.errorMessage || operation.errorCode || 'file operation failed')
    }
    await delay(300)
  }
  throw new Error('file operation timed out')
}

const readErrorSummary = async (response: Response) => {
  const text = await response.text()
  try {
    const payload = JSON.parse(text) as { error?: string }
    if (payload?.error) {
      return payload.error
    }
  } catch {
    // ignore JSON parse errors and fall back to text.
  }
  return text || `request failed: ${response.status}`
}

const normalizeFileEntries = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as FileListEntry[]
  }
  return value
    .filter((item): item is FileListEntry => Boolean(item && typeof item === 'object' && typeof (item as FileListEntry).relativePath === 'string'))
    .filter((item) => !item.directory)
}

const populateFileSelect = (state: RenderState, role: string, entries: FileListEntry[], preferredPath?: string) => {
  const select = body(state).querySelector<HTMLSelectElement>(`[data-role="${role}"]`)
  if (!select) {
    return
  }
  const preferred = entries.find((entry) => entry.relativePath === preferredPath)?.relativePath || entries[0]?.relativePath || ''
  select.innerHTML = entries.map((entry) => `
    <option value="${escapeHtml(entry.relativePath)}"${entry.relativePath === preferred ? ' selected' : ''}>${escapeHtml(entry.name)}</option>
  `).join('')
}

const prioritizeFiles = (entries: FileListEntry[], preferredFiles: string[]) => {
  if (preferredFiles.length === 0) {
    return entries
  }
  const priority = new Map(preferredFiles.map((name, index) => [name.toLowerCase(), index]))
  return [...entries].sort((left, right) => {
    const leftPriority = priority.has(left.name.toLowerCase()) ? priority.get(left.name.toLowerCase())! : preferredFiles.length + 1
    const rightPriority = priority.has(right.name.toLowerCase()) ? priority.get(right.name.toLowerCase())! : preferredFiles.length + 1
    if (leftPriority === rightPriority) {
      return left.name.localeCompare(right.name)
    }
    return leftPriority - rightPriority
  })
}

const filterEntriesByRelativePath = (entries: FileListEntry[], allowedPaths: string[]) => {
  if (allowedPaths.length === 0) {
    return entries
  }
  const allowedSet = new Set(allowedPaths.map((path) => path.toLowerCase()))
  return entries.filter((entry) => allowedSet.has(entry.relativePath.toLowerCase()))
}

const resolveStructuredFields = (definitions: StructuredField[], content: string) => {
  const values = parseIniValues(content)
  return definitions.map((definition) => {
    const value = values[`${definition.section}.${definition.key}`] || ''
    return {
      ...definition,
      value: definition.sensitive ? (value ? '已设置' : '') : value
    }
  })
}

const parseIniValues = (content: string) => {
  const values: Record<string, string> = {}
  let currentSection = ''
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim()
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex < 0 || !currentSection) {
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    values[`${currentSection}.${key}`] = value
  }
  return values
}

const setRouteNotice = (state: RenderState, role: string, message: string, error = false) => {
  const target = body(state).querySelector<HTMLElement>(`[data-role="${role}"]`)
  if (!target) {
    return
  }
  target.classList.toggle('error', error)
  target.textContent = message
}

const setRouteMeta = (state: RenderState, role: string, items: Array<{ label: string; value: string }>) => {
  const target = body(state).querySelector<HTMLElement>(`[data-role="${role}"]`)
  if (!target) {
    return
  }
  if (items.length === 0) {
    target.innerHTML = ''
    return
  }
  target.innerHTML = items.map((item) => `
    <div class="meta-item">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.value || '-')}</span>
    </div>
  `).join('')
}

const setSettingsFields = (state: RenderState, fields: ResolvedStructuredField[]) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="settings-fields"]')
  if (!target) {
    return
  }
  if (fields.length === 0) {
    target.innerHTML = ''
    return
  }
  target.innerHTML = fields.map((field) => `
    <label>
      <strong>${escapeHtml(field.label)}</strong>
      <input value="${escapeHtml(field.value)}" readonly />
      <span>${escapeHtml(field.validator)}</span>
    </label>
  `).join('')
}

const setLogText = (state: RenderState, text: string) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="logs"]')
  if (target) {
    target.textContent = text
  }
}

const currentServerInstanceID = (state: RenderState) => {
  const value = state.context?.serverInstanceId || ''
  if (!value) {
    throw new Error('server instance context is required')
  }
  return value
}

const coreErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || 'file request failed')
  return message.slice(0, 180)
}

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatByteCount = (value: unknown) => {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const redactSecrets = (text: string) => {
  return text.replace(/((?:password|token|secret)\s*=\s*)(.+)/gi, '$1[redacted]')
}

const requestBodyFor = (route: DomainRoute) => {
  if (route.key === 'database') {
    return { template: 'players.summary' }
  }
  return undefined
}

const normalizeEnvelope = (route: DomainRoute, envelope: PluginEnvelope | undefined): PluginEnvelope => ({
  ...emptyEnvelope(route, 'unavailable'),
  ...envelope,
  unavailable: {
    ...emptyEnvelope(route, 'unavailable').unavailable,
    ...(envelope?.unavailable || {})
  }
})

const failedEnvelope = (route: DomainRoute, error: unknown): PluginEnvelope => {
  const message = error instanceof Error ? error.message : String(error || 'plugin api request failed')
  return {
    ...emptyEnvelope(route, message.includes('403') ? 'denied' : 'failed'),
    error: { code: 'api_error', message: message.slice(0, 180) },
    unavailable: {
      code: 'api_error',
      reasonCode: 'api_error',
      summary: message.slice(0, 180),
      nextAction: route.unavailable.nextAction
    }
  }
}

const isUsable = (envelope: PluginEnvelope) => {
  return envelope.state === 'available' || envelope.state === 'empty' || envelope.state === 'pending_dispatch'
}

const blockedNotice = (route: DomainRoute, envelope: PluginEnvelope) => {
  if (isUsable(envelope)) {
    return ''
  }
  return `
    <div class="notice ${envelope.state === 'denied' ? 'error' : ''}">
      <strong>${escapeHtml(envelope.unavailable?.reasonCode || route.unavailable.reasonCode)}</strong>
      <p>${escapeHtml(envelope.unavailable?.summary || route.unavailable.summary)}</p>
      <p>${escapeHtml(envelope.unavailable?.nextAction || route.unavailable.nextAction)}</p>
    </div>
  `
}

const statusTone = (envelope: PluginEnvelope) => {
  if (envelope.state === 'available' || envelope.state === 'empty' || envelope.state === 'pending_dispatch') {
    return 'ok'
  }
  if (envelope.state === 'denied' || envelope.state === 'failed') {
    return 'error'
  }
  return 'warn'
}

const statusText = (route: DomainRoute, envelope: PluginEnvelope) => {
  if (envelope.state === 'loading') {
    return '加载中'
  }
  if (route.migrationStatus === 'not_migrated') {
    return '未迁移'
  }
  if (route.migrationStatus === 'deferred') {
    return '延后'
  }
  if (envelope.state === 'pending_dispatch') {
    return '已提交'
  }
  if (isUsable(envelope)) {
    return route.migrationStatus === 'partial' ? '部分可用' : '可用'
  }
  if (envelope.state === 'denied') {
    return '无权限'
  }
  return '暂不可用'
}

const rowsFromEnvelope = (envelope: PluginEnvelope, fallback: Record<string, unknown>[]) => {
  const rows = envelope.data?.rows || envelope.data?.items || envelope.data?.tasks
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : fallback
}

const sourceSummary = (envelope: PluginEnvelope) => {
  const source = envelope.data?.source as SourceSummary | undefined
  if (!source || typeof source !== 'object') {
    return ''
  }
  const parts = [source.kind, source.mode, source.summary].filter((value) => typeof value === 'string' && value.length > 0)
  return parts.join(' / ')
}

const operationSummary = (envelope: PluginEnvelope) => {
  if (envelope.operation) {
    const id = envelope.operation.id || envelope.operation.operationId || 'operation'
    const status = envelope.operation.status || envelope.state || 'pending_dispatch'
    const summary = envelope.operation.summary || envelope.summary || ''
    return `${id} - ${status}${summary ? ` - ${summary}` : ''}`
  }
  return envelope.unavailable?.summary || envelope.error?.message || '操作未能提交。'
}

const setDiff = (state: RenderState, text: string) => {
  const diff = body(state).querySelector<HTMLElement>('[data-role="diff"]')
  if (diff) {
    diff.textContent = text
  }
}

const body = (state: RenderState) => state.content.querySelector<HTMLElement>('[data-role="route-body"]') || state.content

const cssEscape = (value: string) => {
  if ('CSS' in window && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

const kebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

mount()
