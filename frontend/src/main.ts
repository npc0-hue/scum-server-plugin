import { ScumPluginBridge, type BridgeContext } from './bridge'
import { domainRoutes, normalToolRoutes, routeFor, type DomainRoute } from './resources/domainCatalog'

const scumAdminPluginID = 'scum-admin'
const scumAdminFallbackPluginVersion = '0.1.13'

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

type PluginAPIError = Error & {
  code?: string
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
  settingsViewMode: 'structured' | 'raw'
  settingsModeTouched: boolean
}

const pluginVersionFromAssetURL = (locationHref: string) => {
  try {
    const segments = new URL(locationHref).pathname.split('/').filter(Boolean)
    const namespaceIndex = segments.findIndex((segment) => segment === 'plugin-assets')
    if (namespaceIndex >= 0 && segments[namespaceIndex + 1] === scumAdminPluginID && segments[namespaceIndex + 2]) {
      return decodeURIComponent(segments[namespaceIndex + 2])
    }
  } catch {
    // Non-browser or malformed URLs should fall back to the packaged plugin version.
  }
  return scumAdminFallbackPluginVersion
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
  editable?: boolean
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
    --plugin-shadow-soft: 0 16px 36px rgba(0, 0, 0, 0.16);
    --plugin-workspace-bg-image: none;
    min-height: 100%;
    padding: 24px;
    color: var(--plugin-text);
    background: transparent;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
    position: relative;
  }

  .scum-admin-plugin::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: "";
    z-index: 0;
    opacity: 0;
    background-image: var(--plugin-workspace-bg-image);
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    transition: opacity 0.2s ease;
  }

  .scum-admin-plugin.has-backdrop::before {
    opacity: 1;
  }

  .scum-admin-plugin > * {
    position: relative;
    z-index: 1;
  }

  .scum-admin-plugin::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: "";
    z-index: 0;
    background:
      linear-gradient(180deg, rgba(5, 7, 12, 0.38), rgba(5, 7, 12, 0.58)),
      linear-gradient(135deg, color-mix(in srgb, var(--plugin-primary) 20%, transparent), transparent 42%, color-mix(in srgb, var(--plugin-info) 14%, transparent));
  }

  .scum-admin-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 18px 20px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.03)),
      color-mix(in srgb, var(--plugin-panel-strong) 88%, transparent);
    backdrop-filter: blur(22px) saturate(1.22);
    -webkit-backdrop-filter: blur(22px) saturate(1.22);
    box-shadow: var(--plugin-shadow-soft);
  }

  .scum-admin-header h1 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 24px;
    font-weight: 720;
  }

  .scum-admin-header p {
    max-width: 760px;
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
    margin: 18px 0;
    padding: 6px;
    border: 1px solid var(--plugin-border);
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      color-mix(in srgb, var(--plugin-panel) 88%, transparent);
    backdrop-filter: blur(18px) saturate(1.18);
    -webkit-backdrop-filter: blur(18px) saturate(1.18);
  }

  .scum-admin-tabs button {
    min-height: 38px;
    padding: 8px 12px;
    border: 1px solid var(--plugin-border);
    border-radius: 12px;
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
    padding: 0;
    border: 0;
    background: transparent;
  }

  .route-shell {
    display: grid;
    gap: 18px;
    padding: 22px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel-strong) 90%, transparent);
    backdrop-filter: blur(22px) saturate(1.2);
    -webkit-backdrop-filter: blur(22px) saturate(1.2);
    box-shadow: var(--plugin-shadow);
  }

  .surface-body {
    display: grid;
    gap: 16px;
  }

  .surface-title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .surface-title > div {
    display: grid;
    gap: 8px;
  }

  .surface-title h2 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: 20px;
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

  .surface-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--plugin-muted);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .surface-eyebrow::before {
    width: 28px;
    height: 1px;
    background: color-mix(in srgb, var(--plugin-primary) 54%, transparent);
    content: "";
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
    margin: 0;
  }

  .controls-stack {
    display: grid;
    gap: 10px;
    align-items: stretch;
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
    margin: 0;
    padding: 12px 14px;
    border: 1px solid rgba(255, 176, 32, 0.45);
    border-radius: 12px;
    color: #ffd37a;
    background: rgba(255, 176, 32, 0.1);
    line-height: 1.5;
  }

  .notice.compact {
    padding: 10px 12px;
    font-size: 13px;
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
    margin: 0;
  }

  .meta-grid--compact {
    grid-template-columns: 1fr;
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

  .workspace-grid {
    display: grid;
    grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .workspace-sidebar,
  .workspace-main {
    display: grid;
    gap: 16px;
  }

  .workspace-card {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel) 90%, transparent);
    backdrop-filter: blur(18px) saturate(1.16);
    -webkit-backdrop-filter: blur(18px) saturate(1.16);
    box-shadow: var(--plugin-shadow-soft);
  }

  .workspace-card--primary {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--plugin-primary) 16%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel) 90%, transparent);
  }

  .workspace-card-heading {
    display: grid;
    gap: 8px;
  }

  .workspace-card-heading strong {
    color: var(--plugin-text-strong);
    font-size: 18px;
  }

  .workspace-card-heading p {
    margin: 0;
    color: var(--plugin-muted);
    line-height: 1.6;
  }

  .workspace-card-heading .surface-eyebrow {
    letter-spacing: 0.12em;
  }

  .workspace-hint {
    display: grid;
    gap: 8px;
    color: var(--plugin-muted);
    line-height: 1.55;
  }

  .workspace-hint strong {
    color: var(--plugin-text-strong);
    font-size: 14px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
    margin: 0;
  }

  .field-grid label {
    display: grid;
    gap: 6px;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 6px;
    color: var(--plugin-muted);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      var(--plugin-panel);
    backdrop-filter: blur(16px) saturate(1.18);
    -webkit-backdrop-filter: blur(16px) saturate(1.18);
  }

  .field-grid strong {
    color: var(--plugin-text);
    font-size: 13px;
  }

  .field-grid span {
    color: var(--plugin-muted);
    font-size: 12px;
  }

  .settings-editor {
    display: grid;
    gap: 10px;
    margin-top: 0;
    padding: 18px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025)),
      var(--plugin-panel);
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    box-shadow: var(--plugin-shadow);
  }

  .settings-editor-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .settings-editor-header strong {
    color: var(--plugin-text-strong);
  }

  .settings-editor-header p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    font-size: 13px;
  }

  .settings-editor textarea {
    width: 100%;
    min-height: clamp(360px, 58vh, 760px);
    resize: vertical;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    color: #dbeafe;
    background: rgba(6, 10, 20, 0.92);
    font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    outline: none;
    white-space: pre;
  }

  .settings-editor textarea:focus {
    border-color: var(--plugin-primary);
  }

  .settings-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .settings-mode {
    display: inline-flex;
    gap: 6px;
    padding: 4px;
    width: fit-content;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    background: rgba(10, 14, 22, 0.38);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
  }

  .settings-mode button {
    min-height: 30px;
    padding: 6px 10px;
    border: 0;
    border-radius: 999px;
    color: var(--plugin-muted);
    background: transparent;
    cursor: pointer;
    font: inherit;
  }

  .settings-mode button[aria-pressed="true"] {
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 18%, rgba(255, 255, 255, 0.08));
  }

  .settings-mode button:hover {
    color: #ffffff;
  }

  .settings-save-status {
    color: var(--plugin-muted);
    font-size: 13px;
  }

  .settings-frame {
    display: grid;
    gap: 16px;
  }

  .settings-structured-panel {
    display: grid;
    gap: 14px;
  }

  .settings-structured-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .settings-structured-header p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    line-height: 1.55;
  }

  .settings-structured-header strong {
    color: var(--plugin-text-strong);
    font-size: 17px;
  }

  .settings-file-mark {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 10px;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.05);
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
    border-radius: 12px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.025);
    text-align: center;
  }

  .empty.inline {
    padding: 14px;
    text-align: left;
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
    .surface-title,
    .settings-structured-header,
    .settings-editor-header {
      display: grid;
    }

    .controls,
    .controls-stack,
    .workspace-grid {
      display: grid;
    }

    .controls input,
    .controls select,
    .controls button {
      width: 100%;
    }

    .scum-admin-plugin,
    .route-shell {
      padding: 16px;
    }
  }
`

export const mount = async () => {
  const root = document.getElementById('scum-admin-plugin-root') || document.body
  const initialRoute = new URL(window.location.href).searchParams.get('routeKey') || 'settings'
  const bridge = new ScumPluginBridge(scumAdminPluginID, pluginVersionFromAssetURL(window.location.href), initialRoute)
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
  bridge.onContext((context) => applyPluginTheme(panel, context))

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
    nav,
    settingsViewMode: 'structured',
    settingsModeTouched: false
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

const applyPluginTheme = (panel: HTMLElement, context: BridgeContext) => {
  for (const [key, value] of Object.entries(context.themeTokens || {})) {
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) && typeof value === 'string') {
      panel.style.setProperty(`--plugin-theme-${kebabCase(key)}`, value)
    }
  }
  const backdropImage = typeof context.backdropImage === 'string' ? context.backdropImage.trim() : ''
  if (backdropImage) {
    panel.style.setProperty('--plugin-workspace-bg-image', `url("${backdropImage}")`)
    panel.classList.add('has-backdrop')
    return
  }
  panel.style.setProperty('--plugin-workspace-bg-image', 'none')
  panel.classList.remove('has-backdrop')
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
    const envelope = await state.bridge.api<PluginEnvelope>(pluginAPIPath(state.route.apiPath), state.route.method, requestBodyFor(state.route))
    renderDomainPage(state, normalizeEnvelope(state.route, envelope))
  } catch (error) {
    renderDomainPage(state, failedEnvelope(state.route, error))
  }
}

const pluginAPIPath = (apiPath: string) => `/api/plugins/scum-admin/${String(apiPath || '').replace(/^\/+/, '')}`

const renderShell = (state: RenderState, envelope: PluginEnvelope) => {
  const route = state.route
  const tone = statusTone(envelope)
  const summary = isUsable(envelope)
    ? route.summary
    : envelope.unavailable?.summary || route.unavailable.summary
  state.content.innerHTML = `
    <div class="route-shell">
      <div class="surface-title">
        <div>
          <span class="surface-eyebrow">${escapeHtml(route.domainOwner || 'plugin workspace')}</span>
          <h2>${escapeHtml(route.title)}</h2>
          <p>${escapeHtml(summary)}</p>
        </div>
        <span class="status-pill" data-tone="${tone}">${statusText(route, envelope)}</span>
      </div>
      <div data-role="route-body"><div class="empty">正在加载 ${escapeHtml(route.title)}...</div></div>
    </div>
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
      <strong>${escapeHtml(unavailableHeadline(state.route, envelope))}</strong>
      <p>${escapeHtml(envelope.unavailable?.summary || state.route.unavailable.summary)}</p>
      <p>${escapeHtml(envelope.unavailable?.nextAction || state.route.unavailable.nextAction)}</p>
      ${blockedDiagnostics(envelope)}
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
  state.settingsModeTouched = false
  const blocked = !isUsable(envelope)
  const workspaces = Array.isArray(envelope.data?.workspaces) ? envelope.data.workspaces as ConfigWorkspace[] : []
  const supportedFiles = Array.isArray(envelope.data?.supportedFiles)
    ? envelope.data.supportedFiles.filter((item): item is string => typeof item === 'string')
    : []
  const structuredFields = Array.isArray(envelope.data?.structuredFields) ? envelope.data.structuredFields as StructuredField[] : sampleStructuredFields
  const structuredPath = typeof envelope.data?.structuredPath === 'string' ? envelope.data.structuredPath : ''
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="workspace-grid settings-frame">
      <aside class="workspace-sidebar">
        <section class="workspace-card workspace-card--primary">
          <div class="workspace-card-heading">
            <span class="surface-eyebrow">Config Workspace</span>
            <strong>配置工作区</strong>
            <p>优先打开 ServerSettings.ini 并停留在配置模式，需要时再切到文件模式查看原始内容。</p>
          </div>
          <div class="controls-stack">
            <select data-role="settings-workspace" ${blocked ? 'disabled' : ''}>
              ${workspaces.map((workspace) => `
                <option value="${escapeHtml(workspace.key)}">${escapeHtml(workspace.title)}</option>
              `).join('')}
            </select>
            <select data-role="settings-file" ${blocked ? 'disabled' : ''}></select>
            <button type="button" class="action-button" data-action="reload-settings" ${blocked ? 'disabled' : ''}>重新读取配置</button>
          </div>
          <div class="notice compact" data-role="settings-status">等待读取配置目录。</div>
          <div class="meta-grid meta-grid--compact">
            <div class="meta-item">
              <strong>当前文件</strong>
              <span data-role="settings-current-file">未选择</span>
            </div>
            <div class="meta-item">
              <strong>当前模式</strong>
              <span data-role="settings-mode-note">配置模式</span>
            </div>
          </div>
        </section>

        <section class="workspace-card">
          <div class="workspace-card-heading">
            <span class="surface-eyebrow">View Mode</span>
            <strong>查看方式</strong>
          </div>
          <div class="settings-mode" role="group" aria-label="配置查看模式">
            <button type="button" data-settings-mode="structured" aria-pressed="true">配置模式</button>
            <button type="button" data-settings-mode="raw" aria-pressed="false">文件模式</button>
          </div>
          <div class="workspace-hint">
            <strong>推荐顺序</strong>
            <span>平时修改参数走配置模式，字段更清楚；只有排查原文、复制片段或处理未结构化文件时再进入文件模式。</span>
          </div>
        </section>
      </aside>

      <div class="workspace-main">
        <section class="workspace-card settings-structured-panel" data-role="settings-structured-panel">
          <div class="settings-structured-header">
            <div>
              <strong>结构化配置</strong>
              <p>这里聚焦当前文件里最常改、最容易出错的服务器参数。字段直接回写到右侧原始文件编辑区。</p>
            </div>
            <span class="settings-file-mark" data-role="settings-file-label">未选择文件</span>
          </div>
          <div class="field-grid" data-role="settings-fields"></div>
        </section>

        <section class="settings-editor" data-role="settings-editor-panel">
          <div class="settings-editor-header">
            <div>
              <strong>原始文件</strong>
              <p>保留完整文本视图，适合核对差异、处理暂未结构化的配置项，或直接做一次性调整。</p>
            </div>
            <span class="settings-save-status" data-role="settings-save-status"></span>
          </div>
          <textarea data-role="settings-editor" spellcheck="false"></textarea>
          <div class="settings-actions">
            <button type="button" class="action-button" data-action="save-settings" disabled>提交修改</button>
            <button type="button" class="action-button secondary" data-action="reset-settings" disabled>还原</button>
          </div>
        </section>
      </div>
    </div>
  `
  if (blocked || workspaces.length === 0) {
    return
  }
  bindSettingsModeControls(state)
  const run = () => {
    void loadSettingsWorkspace(state, workspaces, supportedFiles, structuredFields, structuredPath)
  }
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-settings"]')?.addEventListener('click', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.addEventListener('change', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.addEventListener('change', () => {
    void loadSettingsFile(state, structuredFields, structuredPath)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="save-settings"]')?.addEventListener('click', () => {
    void saveSettingsFile(state, structuredPath)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="reset-settings"]')?.addEventListener('click', () => resetSettingsEditor(state, structuredFields, structuredPath))
  body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')?.addEventListener('input', () => syncSettingsEditorState(state, structuredFields, structuredPath))
  setSettingsViewMode(state, state.settingsViewMode)
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
    const entries = normalizeWorkspaceEntries(workspace.directoryPath, await loadDirectoryEntries(state, workspace.directoryPath))
    const scopedSupportedFiles = workspace.supportedFiles && workspace.supportedFiles.length > 0 ? workspace.supportedFiles : supportedFiles
    const filteredEntries = filterEntriesByRelativePath(entries, scopedSupportedFiles)
    const prioritizedEntries = prioritizeFiles(filteredEntries, scopedSupportedFiles)
    populateFileSelect(state, 'settings-file', prioritizedEntries, structuredPath || workspace.defaultFilePath)
    setRouteNotice(state, 'settings-status', prioritizedEntries.length > 0 ? '配置目录已加载。' : '未找到可读取的配置文件。', prioritizedEntries.length === 0)
    await loadSettingsFile(state, structuredFields, structuredPath)
  } catch (error) {
    setRouteNotice(state, 'settings-status', coreErrorMessage(error), true)
    setSettingsFields(state, [])
    setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
  }
}

const loadSettingsFile = async (state: RenderState, structuredFields: StructuredField[], structuredPath: string) => {
  const relativePath = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.value || ''
  if (!relativePath) {
    setRouteNotice(state, 'settings-status', '当前目录下没有可读取的配置文件。', true)
    setSettingsFields(state, [])
    setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
    return
  }
  setRouteNotice(state, 'settings-status', '正在读取配置...')
  try {
    const result = await readFile(state, relativePath)
    const content = typeof result.content === 'string' ? result.content : ''
    const fields = resolveEditableSettingsFields(structuredFields, content, sameRelativePath(relativePath, structuredPath))
    setSettingsFields(state, fields)
    setSettingsEditor(state, relativePath, content, typeof result.checksum === 'string' ? result.checksum : '', structuredFields, structuredPath)
    if (!state.settingsModeTouched) {
      setSettingsViewMode(state, defaultSettingsViewMode(relativePath, structuredPath, fields))
    }
    setRouteNotice(state, 'settings-status', result.truncated ? '配置已读取，但内容被截断，暂不能提交修改。' : '配置已加载。', Boolean(result.truncated))
  } catch (error) {
    setRouteNotice(state, 'settings-status', coreErrorMessage(error), true)
    setSettingsFields(state, [])
    setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
  }
}

const saveSettingsFile = async (state: RenderState, structuredPath: string) => {
  const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
  const status = body(state).querySelector<HTMLElement>('[data-role="settings-save-status"]')
  if (!editor || !status) {
    return
  }
  const relativePath = editor.dataset.path || ''
  const original = editor.dataset.original || ''
  const checksum = editor.dataset.checksum || ''
  if (!sameRelativePath(relativePath, structuredPath)) {
    status.textContent = '当前文件暂不支持提交修改。'
    return
  }
  if (editor.value === original) {
    status.textContent = '没有需要提交的修改。'
    return
  }
  status.textContent = '正在提交修改...'
  try {
    const serverInstanceID = currentServerInstanceID(state)
    const result = await state.bridge.api<PluginEnvelope>(`/api/v1/scum/instances/${encodeURIComponent(serverInstanceID)}/config`, 'PATCH', {
      serverInstanceId: serverInstanceID,
      expectedChecksum: checksum,
      rawContent: editor.value
    })
    const envelope = normalizeEnvelope(state.route, result)
    status.textContent = operationSummary(envelope)
  } catch (error) {
    status.textContent = coreErrorMessage(error)
  }
}

const resetSettingsEditor = (state: RenderState, structuredFields: StructuredField[], structuredPath: string) => {
  const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
  if (!editor) {
    return
  }
  editor.value = editor.dataset.original || ''
  syncSettingsEditorState(state, structuredFields, structuredPath)
}

const syncSettingsEditorState = (state: RenderState, structuredFields: StructuredField[], structuredPath: string) => {
  const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
  const saveButton = body(state).querySelector<HTMLButtonElement>('[data-action="save-settings"]')
  const resetButton = body(state).querySelector<HTMLButtonElement>('[data-action="reset-settings"]')
  const status = body(state).querySelector<HTMLElement>('[data-role="settings-save-status"]')
  if (!editor) {
    return
  }
  const dirty = editor.value !== (editor.dataset.original || '')
  const canSave = dirty && sameRelativePath(editor.dataset.path || '', structuredPath) && Boolean(editor.dataset.checksum)
  if (saveButton) {
    saveButton.disabled = !canSave
  }
  if (resetButton) {
    resetButton.disabled = !dirty
  }
  if (status && dirty) {
    status.textContent = ''
  }
  setSettingsFields(state, resolveEditableSettingsFields(structuredFields, editor.value, sameRelativePath(editor.dataset.path || '', structuredPath)))
}

const setSettingsEditor = (state: RenderState, path: string, content: string, checksum: string, structuredFields: StructuredField[], structuredPath: string) => {
  const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
  const label = body(state).querySelector<HTMLElement>('[data-role="settings-file-label"]')
  const status = body(state).querySelector<HTMLElement>('[data-role="settings-save-status"]')
  if (!editor) {
    return
  }
  editor.value = content
  editor.dataset.original = content
  editor.dataset.path = path
  editor.dataset.checksum = checksum
  editor.dataset.structuredPath = structuredPath
  if (label) {
    label.textContent = path ? fileNameFromPath(path) : ''
  }
  setTextRole(state, 'settings-current-file', path || '未选择')
  if (status) {
    status.textContent = ''
  }
  syncSettingsEditorState(state, structuredFields, structuredPath)
}

const bindSettingsModeControls = (state: RenderState) => {
  body(state).querySelectorAll<HTMLButtonElement>('button[data-settings-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      setSettingsViewMode(state, button.dataset.settingsMode === 'raw' ? 'raw' : 'structured', true)
    })
  })
}

const setSettingsViewMode = (state: RenderState, mode: RenderState['settingsViewMode'], touched = false) => {
  if (touched) {
    state.settingsModeTouched = true
  }
  state.settingsViewMode = mode
  const fields = body(state).querySelector<HTMLElement>('[data-role="settings-fields"]')
  const structuredPanel = body(state).querySelector<HTMLElement>('[data-role="settings-structured-panel"]')
  const editor = body(state).querySelector<HTMLElement>('[data-role="settings-editor-panel"]')
  body(state).querySelectorAll<HTMLButtonElement>('button[data-settings-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.settingsMode === mode ? 'true' : 'false')
  })
  if (structuredPanel) {
    structuredPanel.hidden = mode !== 'structured'
  }
  if (fields) {
    fields.hidden = mode !== 'structured'
  }
  if (editor) {
    editor.hidden = mode !== 'raw'
  }
  setTextRole(state, 'settings-mode-note', mode === 'structured' ? '配置模式' : '文件模式')
}

const defaultSettingsViewMode = (relativePath: string, structuredPath: string, fields: ResolvedStructuredField[]): RenderState['settingsViewMode'] => {
  if (normalizeRelativePath(relativePath) === normalizeRelativePath(structuredPath)) {
    return 'structured'
  }
  return 'raw'
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
    const entries = normalizeWorkspaceEntries(workspace.directoryPath, await loadDirectoryEntries(state, workspace.directoryPath))
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
  const dispatch = await coreJSON<CoreFileDispatchResponse>(state, `/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files?path=${encodeURIComponent(relativePath)}`)
  const operation = await waitForFileOperation(state, dispatch.operation.id)
  return normalizeFileEntries(operation.result?.entries)
}

const readFile = async (state: RenderState, relativePath: string) => {
  const serverInstanceID = currentServerInstanceID(state)
  const dispatch = await coreJSON<CoreFileDispatchResponse>(state, `/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files/read`, 'POST', { path: relativePath, contentMode: 'text' })
  const operation = await waitForFileOperation(state, dispatch.operation.id)
  return {
    content: operation.result?.content,
    checksum: operation.result?.checksum,
    sizeBytes: Number(operation.result?.sizeBytes || 0),
    truncated: Boolean(operation.result?.truncated),
    readOffset: Number(operation.result?.readOffset || 0)
  }
}

const coreJSON = async <T>(state: RenderState, path: string, method = 'GET', body?: unknown) => {
  return await state.bridge.api<T>(path, method, body)
}

const waitForFileOperation = async (state: RenderState, operationID: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const operation = await coreJSON<CoreFileOperation>(state, `/api/v1/file-operations/${encodeURIComponent(operationID)}`)
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

const normalizeFileEntries = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as FileListEntry[]
  }
  return value
    .filter((item): item is FileListEntry => Boolean(item && typeof item === 'object' && typeof (item as FileListEntry).relativePath === 'string'))
    .filter((item) => !item.directory)
}

const normalizeWorkspaceEntries = (workspacePath: string, entries: FileListEntry[]) => {
  return entries.map((entry) => {
    const relativePath = normalizeRelativePath(entry.relativePath)
    return {
      ...entry,
      name: entry.name || fileNameFromPath(relativePath),
      relativePath: relativePathIncludesDirectory(relativePath, workspacePath) ? relativePath : joinRelativePath(workspacePath, relativePath)
    }
  })
}

const populateFileSelect = (state: RenderState, role: string, entries: FileListEntry[], preferredPath?: string) => {
  const select = body(state).querySelector<HTMLSelectElement>(`[data-role="${role}"]`)
  if (!select) {
    return
  }
  const normalizedPreferred = normalizeRelativePath(preferredPath || '')
  const preferred = entries.find((entry) => sameRelativePath(entry.relativePath, normalizedPreferred) || fileNameFromPath(entry.relativePath).toLowerCase() === fileNameFromPath(normalizedPreferred).toLowerCase())?.relativePath || entries[0]?.relativePath || ''
  select.innerHTML = entries.map((entry) => `
    <option value="${escapeHtml(entry.relativePath)}"${entry.relativePath === preferred ? ' selected' : ''}>${escapeHtml(entry.name)}</option>
  `).join('')
}

const prioritizeFiles = (entries: FileListEntry[], preferredFiles: string[]) => {
  if (preferredFiles.length === 0) {
    return entries
  }
  const priority = new Map<string, number>()
  preferredFiles.forEach((name, index) => {
    priority.set(normalizeRelativePath(name).toLowerCase(), index)
    priority.set(fileNameFromPath(name).toLowerCase(), index)
  })
  return [...entries].sort((left, right) => {
    const leftPriority = priority.get(normalizeRelativePath(left.relativePath).toLowerCase()) ?? priority.get(left.name.toLowerCase()) ?? preferredFiles.length + 1
    const rightPriority = priority.get(normalizeRelativePath(right.relativePath).toLowerCase()) ?? priority.get(right.name.toLowerCase()) ?? preferredFiles.length + 1
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
  const allowedSet = new Set<string>()
  for (const path of allowedPaths) {
    allowedSet.add(normalizeRelativePath(path).toLowerCase())
    allowedSet.add(fileNameFromPath(path).toLowerCase())
  }
  return entries.filter((entry) => allowedSet.has(normalizeRelativePath(entry.relativePath).toLowerCase()) || allowedSet.has(entry.name.toLowerCase()))
}

const normalizeRelativePath = (path: string) => String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim()

const joinRelativePath = (basePath: string, path: string) => {
  const base = normalizeRelativePath(basePath)
  const child = normalizeRelativePath(path)
  if (!base) {
    return child
  }
  return child ? `${base}/${child}` : base
}

const relativePathIncludesDirectory = (path: string, directoryPath: string) => {
  const normalizedPath = normalizeRelativePath(path).toLowerCase()
  const normalizedDirectory = normalizeRelativePath(directoryPath).toLowerCase()
  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`)
}

const sameRelativePath = (left: string, right: string) => normalizeRelativePath(left).toLowerCase() === normalizeRelativePath(right).toLowerCase()

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
    target.innerHTML = '<div class="empty inline">当前文件没有可渲染的结构化配置项，可切换到文件模式直接查看原文。</div>'
    return
  }
  target.innerHTML = fields.map((field) => `
    <label data-section="${escapeHtml(field.section)}" data-key="${escapeHtml(field.key)}">
      <strong>${escapeHtml(field.label)}</strong>
      <input value="${escapeHtml(field.value)}" ${field.editable ? '' : 'readonly'} data-setting-section="${escapeHtml(field.section)}" data-setting-key="${escapeHtml(field.key)}" />
      <span>${escapeHtml(field.validator)}</span>
    </label>
  `).join('')
  target.querySelectorAll<HTMLInputElement>('input[data-setting-section]').forEach((input) => {
    input.addEventListener('input', () => {
      const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
      if (!editor || input.readOnly) {
        return
      }
      editor.value = updateIniValue(editor.value, input.dataset.settingSection || '', input.dataset.settingKey || '', input.value)
      syncSettingsEditorState(state, fields, editor.dataset.structuredPath || '')
    })
  })
}

const resolveEditableSettingsFields = (definitions: StructuredField[], content: string, editable: boolean) => {
  const known = new Map(definitions.map((definition) => [`${definition.section}.${definition.key}`, definition]))
  const values = parseIniValues(content)
  const fields: ResolvedStructuredField[] = []
  for (const [id, value] of Object.entries(values)) {
    const definition = known.get(id)
    if (definition) {
      fields.push({ ...definition, value: definition.sensitive ? (value ? '已设置' : '') : value, editable: editable && !definition.sensitive })
      continue
    }
    const dotIndex = id.lastIndexOf('.')
    if (dotIndex <= 0) {
      continue
    }
    const section = id.slice(0, dotIndex)
    const key = id.slice(dotIndex + 1)
    fields.push({ section, key, label: key, validator: section, value, editable })
  }
  return fields.slice(0, 80)
}

const updateIniValue = (content: string, section: string, key: string, value: string) => {
  const lines = content.split(/\r?\n/)
  let currentSection = ''
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim()
      continue
    }
    if (currentSection !== section || line.startsWith(';') || line.startsWith('#')) {
      continue
    }
    const separatorIndex = rawLine.indexOf('=')
    if (separatorIndex < 0) {
      continue
    }
    const currentKey = rawLine.slice(0, separatorIndex).trim()
    if (currentKey !== key) {
      continue
    }
    lines[index] = `${rawLine.slice(0, separatorIndex + 1)}${value}`
    return lines.join('\n')
  }
  return content
}

const fileNameFromPath = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || path
}

const setLogText = (state: RenderState, text: string) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="logs"]')
  if (target) {
    target.textContent = text
  }
}

const setTextRole = (state: RenderState, role: string, text: string) => {
  const target = body(state).querySelector<HTMLElement>(`[data-role="${role}"]`)
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

const pluginErrorCode = (error: unknown) => {
  const candidate = error as PluginAPIError | undefined
  return typeof candidate?.code === 'string' ? candidate.code.trim() : ''
}

const pluginErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || 'plugin api request failed')
  return message.trim().slice(0, 180)
}

const routeFailurePresentation = (route: DomainRoute, error: unknown) => {
  const code = pluginErrorCode(error) || 'api_error'
  const message = pluginErrorMessage(error)
  if (code === 'session_unavailable' || /plugin api gateway session is unavailable/i.test(message)) {
    return {
      state: 'failed' as const,
      reasonCode: 'plugin_session_unavailable',
      summary: `${route.title} 当前无法连接到 SCUM 管理服务会话，通常是插件运行时、执行端或桥接会话尚未恢复。`,
      nextAction: '请先刷新服务器状态；如果仍未恢复，请让具备管理权限的协作者修复服务或重启 SCUM 管理插件。',
      code,
      message
    }
  }
  if (code === 'unauthorized' || /platform session expired/i.test(message)) {
    return {
      state: 'denied' as const,
      reasonCode: 'platform_session_expired',
      summary: '平台登录状态已过期，当前无法继续访问这个 SCUM 管理页面。',
      nextAction: '请重新登录平台后重试。',
      code,
      message
    }
  }
  if (code === 'api_error' && /api timeout|bridge timeout/i.test(message)) {
    return {
      state: 'failed' as const,
      reasonCode: 'plugin_request_timeout',
      summary: `${route.title} 请求超时，当前服务没有在预期时间内返回结果。`,
      nextAction: '请刷新服务器状态后重试；如果多次超时，请让具备管理权限的协作者检查服务恢复状态。',
      code,
      message
    }
  }
  return {
    state: message.includes('403') ? 'denied' as const : 'failed' as const,
    reasonCode: route.unavailable.reasonCode,
    summary: route.unavailable.summary,
    nextAction: route.unavailable.nextAction,
    code,
    message
  }
}

const unavailableHeadline = (route: DomainRoute, envelope: PluginEnvelope) => {
  const reasonCode = envelope.unavailable?.reasonCode || route.unavailable.reasonCode
  if (reasonCode === 'platform_session_expired') {
    return '登录状态已过期'
  }
  if (reasonCode === 'plugin_request_timeout') {
    return `${route.title} 响应超时`
  }
  return `${route.title} 当前不可用`
}

const blockedDiagnostics = (envelope: PluginEnvelope) => {
  const message = envelope.error?.message?.trim()
  if (!message) {
    return ''
  }
  return `
    <details class="diagnostic-details">
      <summary>查看诊断信息</summary>
      <p><strong>错误码</strong> ${escapeHtml(envelope.error?.code || envelope.unavailable?.code || 'api_error')}</p>
      <p><strong>详情</strong> ${escapeHtml(message)}</p>
    </details>
  `
}

const failedEnvelope = (route: DomainRoute, error: unknown): PluginEnvelope => {
  const presentation = routeFailurePresentation(route, error)
  return {
    ...emptyEnvelope(route, presentation.state),
    error: { code: presentation.code, message: presentation.message },
    unavailable: {
      code: presentation.code,
      reasonCode: presentation.reasonCode,
      summary: presentation.summary,
      nextAction: presentation.nextAction
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
      <strong>${escapeHtml(unavailableHeadline(route, envelope))}</strong>
      <p>${escapeHtml(envelope.unavailable?.summary || route.unavailable.summary)}</p>
      <p>${escapeHtml(envelope.unavailable?.nextAction || route.unavailable.nextAction)}</p>
      ${blockedDiagnostics(envelope)}
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
