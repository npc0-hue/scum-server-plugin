import { ScumPluginBridge, type BridgeContext, type PluginToolbarActionPayload } from './bridge'
import { domainRoutes, normalToolRoutes, routeFor, type DomainRoute } from './resources/domainCatalog'
import {
  buildFileSelectOptions,
  fileNameFromPath,
  filterFileEntriesByQuery,
  normalizeRelativePath,
  prioritizeFiles,
  type FileListEntry
} from './fileSelect'
// @ts-expect-error shared JS localization catalog is exercised by node-based frontend tests.
import { localizeSettingKey } from './resources/settingLocalization.js'

const scumAdminPluginID = 'scum-admin'
const scumAdminFallbackPluginVersion = '0.1.18'

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
  routeRenderVersion: number
  content: HTMLElement
  nav: HTMLElement
  settingsViewMode: 'structured' | 'raw'
  settingsModeTouched: boolean
  preferredSettingsWorkspaceKey: string
  preferredSettingsFileByWorkspace: Record<string, string>
  settingsWorkspaceLoadVersion: number
  settingsFileLoadVersion: number
  settingsDirectoryEntriesByWorkspace: Record<string, FileListEntry[]>
  settingsSearchQueryByWorkspace: Record<string, string>
  playerDetailRow: Record<string, unknown> | null
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

type FileDescriptionMap = Record<string, string>

type SettingsWorkspaceOption = {
  key: string
  title: string
  routeKey: 'settings' | 'logs'
}

type StructuredField = {
  section: string
  key: string
  label: string
  validator: string
  sectionLabel?: string
  type?: 'string' | 'integer' | 'float' | 'boolean'
  sensitive?: boolean
}

type ResolvedStructuredField = StructuredField & {
  value: string
  controlType: 'text' | 'number' | 'boolean' | 'password'
  editable?: boolean
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

type PlayerActionDialogMode = 'send-item' | 'send-gift'

type TerritoryViewMode = 'territories' | 'squads'

type RouteQueryState = {
  focus: 'players' | 'vehicles' | 'supplies'
  playerIds: string[]
  startTime: string
  endTime: string
}

type GiftStatSummary = {
  totalGifts?: number
  activeGifts?: number
  totalDispatches?: number
  todayDispatches?: number
}

const sampleStructuredFields: StructuredField[] = []

const settingsSectionLabels: Record<string, string> = {
  General: '基础配置',
  World: '世界配置',
  Respawn: '重生配置',
  Economy: '经济配置',
  Vehicles: '载具配置',
  Damage: '伤害配置',
  Features: '功能配置',
}

const settingsSectionHints: Record<string, string> = {
  General: '服务器名称、人数、视角和基础玩法。',
  World: '僵尸、刷新、世界资源和环境倍率。',
  Respawn: '角色重生、出生和惩罚相关规则。',
  Economy: '交易、物价和经济循环参数。',
  Vehicles: '载具刷新、数量和使用限制。',
  Damage: '伤害、掉血和战斗相关参数。',
  Features: '建家、资源刷新、技能成长和袭击保护等功能规则。',
}

const settingsWorkspaceOptions: SettingsWorkspaceOption[] = [
  { key: 'windows-server', title: 'WindowsServer 配置', routeKey: 'settings' },
  { key: 'game-logs', title: '游戏日志', routeKey: 'logs' },
]

const defaultLogFileDescription = '日志文件，用于查看服务器运行、聊天、经济和事件记录。'

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
    --plugin-panel: var(--plugin-theme-panel-bg-color, rgba(23, 27, 36, 0.48));
    --plugin-panel-strong: var(--plugin-theme-panel-strong-bg-color, rgba(21, 25, 34, 0.62));
    --plugin-panel-soft: color-mix(in srgb, var(--plugin-theme-hover-color, rgba(255, 255, 255, 0.045)) 88%, transparent);
    --plugin-border: var(--plugin-theme-border-color, rgba(255, 255, 255, 0.12));
    --plugin-border-strong: rgba(255, 255, 255, 0.18);
    --plugin-text: var(--plugin-theme-text-color, #f4f4f5);
    --plugin-text-strong: #f8fafc;
    --plugin-muted: var(--plugin-theme-muted-text-color, #a1a1aa);
    --plugin-control: var(--plugin-theme-control-bg-color, rgba(16, 16, 20, 0.78));
    --plugin-control-focus: var(--plugin-theme-control-focus-bg-color, rgba(16, 16, 20, 0.92));
    --plugin-shadow: 0 18px 38px rgba(0, 0, 0, 0.14);
    --plugin-shadow-soft: 0 12px 28px rgba(0, 0, 0, 0.1);
    --plugin-workspace-bg-image: none;
    min-height: 100%;
    padding: 0;
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
    filter: saturate(0.82) blur(1px);
  }

  .scum-admin-plugin.has-backdrop::before {
    opacity: 0.34;
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
      linear-gradient(180deg, rgba(5, 7, 12, 0.56), rgba(5, 7, 12, 0.78)),
      linear-gradient(135deg, color-mix(in srgb, var(--plugin-primary) 16%, transparent), transparent 38%, color-mix(in srgb, var(--plugin-info) 12%, transparent)),
      radial-gradient(circle at top center, rgba(255, 255, 255, 0.08), transparent 52%);
  }

  .scum-admin-tabs {
    display: grid;
    gap: 6px;
    align-content: start;
    margin: 0;
    padding: 8px;
    border: 1px solid var(--plugin-border);
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015)),
      color-mix(in srgb, var(--plugin-panel) 72%, transparent);
    backdrop-filter: blur(16px) saturate(1.12);
    -webkit-backdrop-filter: blur(16px) saturate(1.12);
  }

  .scum-admin-tabs button {
    width: 100%;
    min-height: 38px;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    color: #d4d4d8;
    background: transparent;
    cursor: pointer;
    font: inherit;
    letter-spacing: 0;
    text-align: left;
  }

  .scum-admin-tabs button:hover {
    border-color: color-mix(in srgb, var(--plugin-primary) 28%, transparent);
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-panel-soft) 90%, transparent);
  }

  .scum-admin-tabs button[aria-current="page"] {
    border-color: color-mix(in srgb, var(--plugin-primary) 40%, transparent);
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 20%, transparent);
  }

  .scum-admin-tabs button[data-status="not_migrated"],
  .scum-admin-tabs button[data-status="deferred"] {
    color: #8b8b94;
  }

  .route-surface {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .scum-admin-layout {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .scum-admin-sidebar {
    position: sticky;
    top: 0;
    min-width: 0;
  }

  .route-shell {
    display: grid;
    gap: 18px;
    padding: 18px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 20px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.018)),
      color-mix(in srgb, var(--plugin-panel-strong) 72%, transparent);
    backdrop-filter: blur(18px) saturate(1.14);
    -webkit-backdrop-filter: blur(18px) saturate(1.14);
    box-shadow: var(--plugin-shadow);
  }

  .route-shell--settings {
    gap: 16px;
    padding: 0;
    border: 0;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;
  }

  .settings-page-header {
    display: grid;
    gap: 12px;
    padding: 22px 24px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025)),
      color-mix(in srgb, var(--plugin-panel-strong) 88%, rgba(8, 10, 18, 0.92));
    backdrop-filter: blur(22px) saturate(1.08);
    -webkit-backdrop-filter: blur(22px) saturate(1.08);
    box-shadow: var(--plugin-shadow);
  }

  .settings-page-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .settings-page-header h2 {
    margin: 0;
    color: var(--plugin-text-strong);
    font-size: clamp(24px, 3vw, 32px);
    font-weight: 760;
    letter-spacing: -0.02em;
  }

  .settings-page-header p {
    margin: 0;
    max-width: 720px;
    color: color-mix(in srgb, var(--plugin-text) 78%, var(--plugin-muted));
    line-height: 1.62;
  }

  .settings-page-header-note {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    min-height: 36px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    color: var(--plugin-muted);
    background: rgba(8, 12, 20, 0.52);
    font-size: 13px;
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
  .field-grid input,
  .field-grid select {
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
  .field-grid input:focus,
  .field-grid select:focus {
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
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .meta-item {
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(9, 13, 21, 0.72);
    backdrop-filter: blur(14px) saturate(1.08);
    -webkit-backdrop-filter: blur(14px) saturate(1.08);
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

  .workspace-card {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      color-mix(in srgb, var(--plugin-panel) 76%, transparent);
    backdrop-filter: blur(16px) saturate(1.12);
    -webkit-backdrop-filter: blur(16px) saturate(1.12);
    box-shadow: var(--plugin-shadow-soft);
  }

  .workspace-card--primary {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--plugin-primary) 12%, rgba(255, 255, 255, 0.07)), rgba(255, 255, 255, 0.02)),
      color-mix(in srgb, var(--plugin-panel) 76%, transparent);
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
    line-height: 1.5;
  }

  .field-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;
  }

  .field-section {
    display: grid;
    gap: 12px;
  }

  .field-section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
    min-width: 0;
    padding: 2px 4px 0;
  }

  .field-section-head > div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .field-section-head strong {
    color: var(--plugin-text-strong);
    font-size: 15px;
  }

  .field-section-head p {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 1.5;
  }

  .field-section-head span {
    color: var(--plugin-muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .field-grid label {
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    min-width: 0;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    color: var(--plugin-muted);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
      rgba(10, 14, 22, 0.78);
    backdrop-filter: blur(16px) saturate(1.08);
    -webkit-backdrop-filter: blur(16px) saturate(1.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .field-grid label[data-editable="false"] {
    opacity: 0.72;
  }

  .settings-field-copy {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .settings-field-key {
    color: var(--plugin-muted);
    font-size: 12px;
    word-break: break-word;
  }

  .field-grid strong {
    color: var(--plugin-text-strong);
    font-size: 14px;
    line-height: 1.4;
  }

  .field-grid span {
    color: var(--plugin-muted);
    font-size: 12px;
  }

  .settings-field-control {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .settings-field-meta {
    color: var(--plugin-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .settings-field-path {
    color: rgba(255, 255, 255, 0.46);
    font-size: 11px;
    line-height: 1.5;
    word-break: break-word;
  }

  .field-grid input,
  .field-grid select {
    width: 100%;
    min-height: 48px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(5, 8, 15, 0.9);
  }

  .field-grid select {
    cursor: pointer;
  }

  .settings-editor {
    display: grid;
    gap: 14px;
    margin-top: 0;
    padding: 20px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 20px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
      rgba(9, 13, 21, 0.84);
    backdrop-filter: blur(18px) saturate(1.08);
    -webkit-backdrop-filter: blur(18px) saturate(1.08);
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
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    color: #dbeafe;
    background: rgba(3, 6, 12, 0.94);
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

  .segmented-control {
    display: inline-flex;
    gap: 6px;
    width: fit-content;
    padding: 4px;
    border: 1px solid var(--plugin-border);
    border-radius: 999px;
    background: rgba(10, 14, 22, 0.38);
  }

  .segmented-control button {
    min-height: 32px;
    padding: 7px 12px;
    border: 0;
    border-radius: 999px;
    color: var(--plugin-muted);
    background: transparent;
    cursor: pointer;
    font: inherit;
  }

  .segmented-control button[aria-pressed="true"] {
    color: #ffffff;
    background: color-mix(in srgb, var(--plugin-primary) 18%, rgba(255, 255, 255, 0.08));
  }

  .segmented-control button:hover {
    color: #ffffff;
  }

  .inline-dialog {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: none;
    align-items: center;
    justify-items: center;
    padding: 18px;
    background: rgba(3, 6, 12, 0.68);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .inline-dialog:not(:empty) {
    display: grid;
  }

  .inline-dialog-panel {
    display: grid;
    gap: 12px;
    width: min(980px, calc(100vw - 36px));
    max-height: calc(100vh - 36px);
    overflow: auto;
    padding: 16px;
    border: 1px solid var(--plugin-border-strong);
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(9, 13, 21, 0.96);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
  }

  .inline-dialog-table {
    min-width: 0;
    overflow-x: auto;
  }

  .inline-dialog-table table {
    min-width: 680px;
  }

  .table-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .settings-save-status {
    color: var(--plugin-muted);
    font-size: 13px;
    min-height: 18px;
  }

  .settings-frame {
    display: grid;
    gap: 12px;
  }

  .settings-section {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.018)),
      rgba(11, 15, 24, 0.82);
    backdrop-filter: blur(18px) saturate(1.08);
    -webkit-backdrop-filter: blur(18px) saturate(1.08);
    box-shadow: var(--plugin-shadow-soft);
  }

  .settings-file-strip {
    position: relative;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: visible;
    padding: 8px;
    border: 1px solid var(--plugin-border);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018)),
      rgba(8, 12, 20, 0.58);
    backdrop-filter: blur(14px) saturate(1.12);
    -webkit-backdrop-filter: blur(14px) saturate(1.12);
  }

  .settings-file-field {
    display: grid;
    gap: 3px;
    min-width: 150px;
    overflow: visible;
    flex: 1 1 210px;
  }

  .settings-file-field span {
    color: var(--plugin-muted);
    font-size: 11px;
    line-height: 1;
  }

  .settings-file-field input,
  .settings-file-field select,
  .settings-file-picker-trigger {
    width: 100%;
    min-height: 34px;
    padding: 6px 28px 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    color: var(--plugin-text);
    background: rgba(5, 9, 16, 0.72);
    outline: none;
  }

  .settings-file-field input:focus,
  .settings-file-field select:focus,
  .settings-file-picker-trigger:focus {
    border-color: var(--plugin-primary);
  }

  .settings-file-picker {
    position: relative;
    overflow: visible;
  }

  .settings-file-picker[open] {
    z-index: 40;
  }

  .settings-file-picker-trigger {
    list-style: none;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .settings-file-picker-trigger::-webkit-details-marker {
    display: none;
  }

  .settings-file-picker-panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: rgba(7, 11, 18, 0.96);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
    min-width: min(520px, calc(100vw - 48px));
    max-width: min(680px, calc(100vw - 48px));
    z-index: 60;
  }

  .settings-file-picker-options {
    display: grid;
    gap: 6px;
    max-height: min(320px, 45vh);
    overflow: auto;
  }

  .settings-file-picker-option {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: var(--plugin-text);
    background: rgba(255, 255, 255, 0.03);
    text-align: left;
    cursor: pointer;
  }

  .settings-file-picker-option.is-active {
    border-color: color-mix(in srgb, var(--plugin-primary) 72%, rgba(255, 255, 255, 0.14));
    background: color-mix(in srgb, var(--plugin-primary) 18%, rgba(255, 255, 255, 0.04));
  }

  .settings-file-picker-empty {
    padding: 8px 10px;
    color: var(--plugin-muted);
    font-size: 12px;
  }

  @media (max-width: 900px) {
    .settings-file-picker-panel {
      min-width: 100%;
      max-width: 100%;
    }
  }

  .settings-file-strip > button {
    min-height: 34px;
    white-space: nowrap;
  }

  .settings-host-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 36px;
  }

  .settings-host-strip .notice {
    flex: 1 1 auto;
  }

  .settings-toolbar-head,
  .settings-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }

  .settings-toolbar-head strong,
  .settings-section-head strong {
    color: var(--plugin-text-strong);
    font-size: 15px;
  }

  .settings-toolbar-head p,
  .settings-section-head p {
    margin: 6px 0 0;
    color: var(--plugin-muted);
    font-size: 13px;
    line-height: 1.55;
  }

  .settings-toolbar-meta {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    color: var(--plugin-muted);
    background: rgba(255, 255, 255, 0.04);
    font-size: 12px;
    white-space: nowrap;
  }

  .settings-toolbar-grid {
    display: grid;
    gap: 8px;
  }

  .settings-toolbar-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .settings-toolbar-row--selectors > * {
    flex: 1 1 180px;
    min-width: 0;
  }

  .settings-toolbar-row--selectors .action-button {
    flex: 0 0 auto;
  }

  .settings-select {
    position: relative;
    display: grid;
    gap: 5px;
    min-width: 0;
    padding: 8px 10px 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.018)),
      rgba(8, 12, 20, 0.82);
    backdrop-filter: blur(16px) saturate(1.08);
    -webkit-backdrop-filter: blur(16px) saturate(1.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .settings-select-label {
    color: var(--plugin-text-strong);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.04em;
  }

  .settings-select select {
    width: 100%;
    min-height: 40px;
    padding: 9px 34px 9px 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: var(--plugin-text-strong);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
      rgba(3, 6, 12, 0.88);
    font: inherit;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }

  .settings-select select:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .settings-select select:focus {
    border-color: color-mix(in srgb, var(--plugin-primary) 72%, white 8%);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02)),
      rgba(4, 8, 16, 0.94);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--plugin-primary) 20%, transparent);
  }

  .settings-select select:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  .settings-select-caret {
    position: absolute;
    right: 14px;
    bottom: 21px;
    color: var(--plugin-muted);
    font-size: 12px;
    pointer-events: none;
  }

  .settings-toolbar-row--modes {
    justify-content: flex-end;
  }

  .settings-toolbar-row--modes > * {
    min-width: 0;
  }

  .settings-toolbar-tip {
    color: var(--plugin-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .settings-main {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 14px;
  }

  .settings-toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .settings-toolbar--minimal {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .settings-toolbar select {
    min-width: 0;
    width: 100%;
  }

  .settings-structured-panel {
    display: grid;
    gap: 16px;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .settings-structured-panel[hidden],
  .settings-editor[hidden] {
    display: none;
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
    .settings-page-header,
    .settings-section,
    .settings-editor {
      padding: 16px;
      border-radius: 18px;
    }

    .settings-page-header-top,
    .surface-title,
    .settings-editor-header,
    .settings-toolbar-head,
    .settings-section-head,
    .settings-toolbar-row--modes {
      display: grid;
    }

    .controls,
    .controls-stack,
    .settings-toolbar,
    .settings-toolbar-row,
    .settings-file-strip {
      display: grid;
    }

    .controls input,
    .controls select,
    .controls button,
    .settings-toolbar select,
    .settings-toolbar button,
    .settings-file-field,
    .settings-file-strip button,
    .settings-mode {
      width: 100%;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }

    .scum-admin-layout {
      grid-template-columns: 1fr;
    }

    .scum-admin-sidebar {
      position: static;
    }

    .scum-admin-tabs {
      display: flex;
      flex-wrap: wrap;
    }

    .scum-admin-tabs button {
      width: auto;
    }

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
    <div class="scum-admin-layout">
      <aside class="scum-admin-sidebar">
        <nav class="scum-admin-tabs" aria-label="插件导航" data-role="nav"></nav>
      </aside>
      <section class="route-surface" data-role="content"></section>
    </div>
  `
  root.appendChild(panel)
  bridge.onContext((context) => applyPluginTheme(panel, context))

  const nav = panel.querySelector<HTMLElement>('[data-role="nav"]')
  const content = panel.querySelector<HTMLElement>('[data-role="content"]')
  if (!nav || !content) {
    return
  }

  const renderState: RenderState = {
    bridge,
    context: null,
    route: routeFor(initialRoute),
    routeRenderVersion: 0,
    content,
    nav,
    settingsViewMode: 'structured',
    settingsModeTouched: false,
    preferredSettingsWorkspaceKey: initialRoute === 'logs' ? 'game-logs' : 'windows-server',
    preferredSettingsFileByWorkspace: {},
    settingsWorkspaceLoadVersion: 0,
    settingsFileLoadVersion: 0,
    settingsDirectoryEntriesByWorkspace: {},
    settingsSearchQueryByWorkspace: {},
    playerDetailRow: null
  }

  bridge.onToolbarAction((payload) => handleHostToolbarAction(renderState, payload))
  renderNav(renderState)
  renderShell(renderState, { state: 'loading', title: renderState.route.title, summary: renderState.route.summary })

  try {
    const context = await bridge.init()
    renderState.context = context
    renderState.route = routeFor(context.routeKey || initialRoute)
    renderNav(renderState)
    await renderRoute(renderState, renderState.route.key)
    bridge.ready({ surface: renderState.route.key, routes: domainRoutes.map((route) => route.key) })
    bridge.height(document.documentElement.scrollHeight)
  } catch (error) {
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
  if (route.key === 'logs') {
    return normalToolRoutes.filter((item) => item.key !== 'logs')
  }
  if (normalToolRoutes.some((item) => item.key === route.key)) {
    return normalToolRoutes
  }
  return [route, ...normalToolRoutes]
}

const renderRoute = async (state: RenderState, routeKey: string, options: { syncWorkspace?: boolean } = {}) => {
  const routeRenderVersion = state.routeRenderVersion + 1
  state.routeRenderVersion = routeRenderVersion
  state.settingsWorkspaceLoadVersion += 1
  state.settingsFileLoadVersion += 1
  state.route = routeFor(routeKey)
  if (options.syncWorkspace !== false) {
    syncPreferredWorkspaceForRoute(state, state.route.key)
  }
  renderNav(state)
  if (state.route.key !== 'settings' && state.route.key !== 'logs') {
    clearHostToolbar(state)
  }
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
    if (state.routeRenderVersion !== routeRenderVersion) {
      return
    }
    renderDomainPage(state, normalizeEnvelope(state.route, envelope))
  } catch (error) {
    if (state.routeRenderVersion !== routeRenderVersion) {
      return
    }
    renderDomainPage(state, failedEnvelope(state.route, error))
  }
}

const pluginAPIPath = (apiPath: string) => `/api/plugins/scum-admin/${String(apiPath || '').replace(/^\/+/, '')}`

const renderShell = (state: RenderState, envelope: PluginEnvelope) => {
  const route = state.route
  const tone = statusTone(envelope)
  const chrome = route.key === 'settings'
    ? ''
    : `
      <div class="surface-title">
        <div>
          <h2>${escapeHtml(route.title)}</h2>
        </div>
        <span class="status-pill" data-tone="${tone}">${statusText(route, envelope)}</span>
      </div>
    `
  state.content.innerHTML = `
    <div class="route-shell${route.key === 'settings' ? ' route-shell--settings' : ''}">
      ${chrome}
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
    case 'trajectory-map':
      renderTrajectoryMapPage(state, envelope)
      return
    case 'gifts':
      void renderGiftsPage(state, envelope)
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
      void renderTerritoriesPage(state, envelope)
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
  const fileDescriptions = typeof envelope.data?.fileDescriptions === 'object' && envelope.data?.fileDescriptions
    ? Object.fromEntries(Object.entries(envelope.data.fileDescriptions).filter(([key, value]) => typeof key === 'string' && typeof value === 'string')) as FileDescriptionMap
    : {}
  const structuredFields = Array.isArray(envelope.data?.structuredFields) ? envelope.data.structuredFields as StructuredField[] : sampleStructuredFields
  const structuredPath = typeof envelope.data?.structuredPath === 'string' ? envelope.data.structuredPath : ''
  const activeWorkspaceOption = preferredWorkspaceOptionForCurrentRoute(state)
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="settings-frame">
      <div class="settings-file-strip" aria-label="配置文件选择">
        <label class="settings-file-field">
          <span>目录</span>
          <select data-role="settings-workspace" ${blocked ? 'disabled' : ''}>
            ${settingsWorkspaceOptions.map((workspace) => `
              <option value="${escapeHtml(workspace.key)}" ${workspace.key === activeWorkspaceOption?.key ? 'selected' : ''}>${escapeHtml(settingsWorkspaceLabel(workspace, workspaces))}</option>
            `).join('')}
          </select>
        </label>
        <label class="settings-file-field">
          <span>文件</span>
          <details class="settings-file-picker" data-role="settings-file-picker">
            <summary class="settings-file-picker-trigger" data-role="settings-file-trigger">请选择文件</summary>
            <div class="settings-file-picker-panel">
              <input data-role="settings-file-search" type="search" placeholder="搜索文件名或说明" ${blocked ? 'disabled' : ''} />
              <div class="settings-file-picker-options" data-role="settings-file-options"></div>
            </div>
            <select data-role="settings-file" ${blocked ? 'disabled' : ''} hidden></select>
          </details>
        </label>
        <button type="button" class="action-button secondary" data-action="reload-settings" ${blocked ? 'disabled' : ''}>刷新目录</button>
      </div>
      <div class="settings-host-strip">
        <div class="settings-mode" role="group" aria-label="配置查看模式">
          <button type="button" data-settings-mode="structured" aria-pressed="true">字段</button>
          <button type="button" data-settings-mode="raw" aria-pressed="false">原文</button>
        </div>
        <div class="notice compact" data-role="settings-status" hidden></div>
      </div>

      <div class="settings-main">
        <section class="settings-section settings-structured-panel" data-role="settings-structured-panel">
          <div class="settings-section-head">
            <div>
              <strong>快速配置</strong>
              <p>优先展示中文字段名，适合直接查看和修改常用配置。</p>
            </div>
          </div>
          <div class="field-grid" data-role="settings-fields"></div>
        </section>

        <section class="settings-editor" data-role="settings-editor-panel">
          <div class="settings-editor-header">
            <div>
              <strong>原文编辑</strong>
              <p>需要查看完整 INI 内容或日志原文时，切到这里即可。</p>
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
    publishSettingsToolbar(state, true)
    return
  }
  const workspaceSelect = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')
  if (workspaceSelect && activeWorkspaceOption) {
    workspaceSelect.value = activeWorkspaceOption.key
  }
  bindSettingsModeControls(state)
  const run = () => {
    void loadSettingsWorkspace(state, workspaces, supportedFiles, fileDescriptions, structuredFields, structuredPath)
  }
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-settings"]')?.addEventListener('click', run)
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.addEventListener('change', (event) => {
    const nextWorkspaceKey = (event.target as HTMLSelectElement).value
    const nextWorkspace = settingsWorkspaceOptions.find((workspace) => workspace.key === nextWorkspaceKey)
    if (!nextWorkspace) {
      run()
      return
    }
    state.preferredSettingsWorkspaceKey = nextWorkspace.key
    rememberSettingsFileSelection(state, nextWorkspace.key, '')
    if (nextWorkspace.routeKey !== state.route.key) {
      void renderRoute(state, nextWorkspace.routeKey, { syncWorkspace: false })
      return
    }
    run()
  })
  body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.addEventListener('change', (event) => {
    rememberSettingsFileSelection(state, state.preferredSettingsWorkspaceKey, (event.target as HTMLSelectElement).value)
    syncFilePickerUI(state)
    publishSettingsToolbar(state)
    void loadSettingsFile(state, fileDescriptions, structuredFields, structuredPath)
  })
  body(state).querySelector<HTMLInputElement>('[data-role="settings-file-search"]')?.addEventListener('input', (event) => {
    state.settingsSearchQueryByWorkspace = {
      ...state.settingsSearchQueryByWorkspace,
      [state.preferredSettingsWorkspaceKey]: (event.target as HTMLInputElement).value
    }
    rememberSettingsFileSelection(state, state.preferredSettingsWorkspaceKey, syncFilteredFileSelect(state, fileDescriptions))
    void loadSettingsFile(state, fileDescriptions, structuredFields, structuredPath)
  })
  body(state).querySelector<HTMLDetailsElement>('[data-role="settings-file-picker"]')?.addEventListener('toggle', (event) => {
    const picker = event.currentTarget as HTMLDetailsElement
    if (!picker.open) {
      return
    }
    const searchInput = picker.querySelector<HTMLInputElement>('[data-role="settings-file-search"]')
    if (searchInput) {
      searchInput.value = state.settingsSearchQueryByWorkspace[state.preferredSettingsWorkspaceKey] || ''
      window.setTimeout(() => searchInput.focus(), 0)
    }
    syncFilePickerUI(state)
  })
  body(state).querySelector<HTMLElement>('[data-role="settings-file-options"]')?.addEventListener('click', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="select-settings-file"]')
    if (!option) {
      return
    }
    const select = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')
    if (!select) {
      return
    }
    select.value = option.dataset.value || ''
    select.dispatchEvent(new Event('change', { bubbles: true }))
    body(state).querySelector<HTMLDetailsElement>('[data-role="settings-file-picker"]')?.removeAttribute('open')
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="save-settings"]')?.addEventListener('click', () => {
    void saveSettingsFile(state, structuredPath)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="reset-settings"]')?.addEventListener('click', () => resetSettingsEditor(state, structuredFields, structuredPath))
  body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')?.addEventListener('input', () => syncSettingsEditorState(state, structuredFields, structuredPath))
  setSettingsViewMode(state, state.settingsViewMode)
  publishSettingsToolbar(state)
  run()
}

const renderPlayersPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const rows = rowsFromEnvelope(envelope, [
    { id: 'sample-1', name: 'Prisoner One', steamId: '7656******0001', lastLoginIp: '待本地库同步', lastSeen: '待本地库同步', status: blocked ? '不可用' : '在线' }
  ])
  const source = sourceSummary(envelope)
  const routeQuery = parsedRouteQuery(state)
  let visibleRows = rows
  let selectedIDs = routeQuery.playerIds.filter((value) => rows.some((row) => String(row.playerId || row.id || '') === value))
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    ${source ? `<div class="notice"><strong>数据来源</strong><p>${escapeHtml(source)}</p></div>` : ''}
    <div class="controls">
      <input type="search" data-role="player-search" placeholder="搜索玩家、SteamID 或状态" />
      <button type="button" class="action-button secondary" data-action="bulk-open-map" ${blocked ? 'disabled' : ''}>地图</button>
      <button type="button" class="action-button secondary" data-action="bulk-send-item" ${blocked ? 'disabled' : ''}>发物品</button>
      <button type="button" class="action-button secondary" data-action="bulk-send-gift" ${blocked ? 'disabled' : ''}>发礼包</button>
    </div>
    <div class="task-row" data-role="player-selection-summary">已选择 ${selectedIDs.length} 名玩家。</div>
    <div data-role="players-table">${playersTable(rows, selectedIDs)}</div>
    <div data-role="player-detail-modal"></div>
    <div data-role="player-action-modal"></div>
  `
  const syncSelectionSummary = () => {
    const summary = body(state).querySelector<HTMLElement>('[data-role="player-selection-summary"]')
    if (summary) {
      summary.textContent = selectedIDs.length > 0 ? `已选择 ${selectedIDs.length} 名玩家。` : '当前未选择玩家。'
    }
  }
  body(state).querySelector<HTMLInputElement>('[data-role="player-search"]')?.addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value.toLowerCase()
    const filtered = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)))
    visibleRows = filtered
    const table = body(state).querySelector<HTMLElement>('[data-role="players-table"]')
    if (table) {
      table.innerHTML = playersTable(filtered, selectedIDs)
    }
  })
  body(state).querySelector<HTMLElement>('[data-role="players-table"]')?.addEventListener('click', (event) => {
    const toggle = (event.target as HTMLElement).closest<HTMLInputElement>('[data-role="player-select"]')
    if (toggle) {
      const playerID = String(toggle.value || '')
      selectedIDs = toggle.checked
        ? uniqueStrings([...selectedIDs, playerID])
        : selectedIDs.filter((value) => value !== playerID)
      syncSelectionSummary()
      return
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="select-player"]')
    if (!button) {
      return
    }
    const selected = rowByID(visibleRows, button.dataset.playerId || '')
    if (selected) {
      renderPlayerDetail(state, selected)
    }
  })
  body(state).querySelector<HTMLInputElement>('[data-role="player-select-all"]')?.addEventListener('change', (event) => {
    const checked = (event.target as HTMLInputElement).checked
    selectedIDs = checked ? uniqueStrings(visibleRows.map((row) => String(row.playerId || row.id || '')).filter(Boolean)) : []
    const table = body(state).querySelector<HTMLElement>('[data-role="players-table"]')
    if (table) {
      table.innerHTML = playersTable(visibleRows, selectedIDs)
    }
    syncSelectionSummary()
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="bulk-open-map"]')?.addEventListener('click', () => {
    const ids = selectedIDs.length > 0 ? selectedIDs : visibleRows.slice(0, 1).map((row) => String(row.playerId || row.id || '')).filter(Boolean)
    openTrajectoryMap(state, ids, routeQuery)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="bulk-send-item"]')?.addEventListener('click', () => {
    openPlayerActionDialog(state, 'send-item', visibleRows, selectedIDs)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="bulk-send-gift"]')?.addEventListener('click', () => {
    openPlayerActionDialog(state, 'send-gift', visibleRows, selectedIDs)
  })
  syncSelectionSummary()
}

const renderPlayerDetail = (state: RenderState, row: Record<string, unknown>) => {
  state.playerDetailRow = row
  const target = body(state).querySelector<HTMLElement>('[data-role="player-detail-modal"]')
  if (!target) {
    return
  }
  target.innerHTML = `
    <div class="notice">
      <div class="surface-title">
        <div>
          <h3>${escapeHtml(String(row.name || row.id || '玩家详情'))}</h3>
        </div>
        <button type="button" class="action-button secondary" data-action="close-player-detail">关闭</button>
      </div>
      <p>SteamID: ${escapeHtml(String(row.steamId || row.steamID || row.uuid || '-'))}</p>
      <p>最近登录 IP: ${escapeHtml(String(row.lastLoginIp || row.last_login_ip || '-'))}</p>
      <p>同 IP 预警: ${escapeHtml(duplicateIPText(row))}</p>
      <p>最近活动: ${escapeHtml(String(row.lastSeen || row.updatedAt || '-'))}</p>
      <div class="controls">
        <button type="button" class="action-button secondary" data-action="single-open-map" data-player-id="${escapeHtml(String(row.playerId || row.id || ''))}">地图</button>
      </div>
      <div class="controls">
        <input type="text" data-role="player-title" placeholder="头衔" value="${escapeHtml(String(row.title || ''))}" />
        <input type="text" data-role="player-qq" placeholder="QQ" value="${escapeHtml(String(row.qq || ''))}" />
        <input type="text" data-role="player-status" placeholder="状态" value="${escapeHtml(String(row.status || 'active'))}" />
        <input type="number" data-role="player-fame" placeholder="声望" value="${escapeHtml(String(row.fame ?? ''))}" />
        <input type="number" data-role="player-account" placeholder="余额" value="${escapeHtml(String(row.account ?? ''))}" />
        <input type="number" data-role="player-gold" placeholder="黄金" value="${escapeHtml(String(row.gold ?? ''))}" />
        <button type="button" class="action-button" data-action="save-player-local" data-player-id="${escapeHtml(String(row.playerId || row.id || ''))}">保存</button>
      </div>
      <div data-role="player-save-result"></div>
      <details>
        <summary>查看结构化数据</summary>
        <pre>${escapeHtml(JSON.stringify(row, null, 2))}</pre>
      </details>
    </div>
  `
  target.querySelector<HTMLButtonElement>('[data-action="close-player-detail"]')?.addEventListener('click', () => {
    state.playerDetailRow = null
    target.innerHTML = ''
  })
  target.querySelector<HTMLButtonElement>('[data-action="single-open-map"]')?.addEventListener('click', () => {
    openTrajectoryMap(state, [String(row.playerId || row.id || '')].filter(Boolean), parsedRouteQuery(state))
  })
  target.querySelector<HTMLButtonElement>('[data-action="save-player-local"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement
    const output = target.querySelector<HTMLElement>('[data-role="player-save-result"]')
    const playerId = Number(button.dataset.playerId || 0)
    const bodyPayload = {
      confirmed: true,
      action: 'update-local-player',
      playerId,
      title: target.querySelector<HTMLInputElement>('[data-role="player-title"]')?.value || '',
      qq: target.querySelector<HTMLInputElement>('[data-role="player-qq"]')?.value || '',
      status: target.querySelector<HTMLInputElement>('[data-role="player-status"]')?.value || '',
      fame: optionalNumber(target.querySelector<HTMLInputElement>('[data-role="player-fame"]')?.value),
      account: optionalNumber(target.querySelector<HTMLInputElement>('[data-role="player-account"]')?.value),
      gold: optionalNumber(target.querySelector<HTMLInputElement>('[data-role="player-gold"]')?.value)
    }
    if (!playerId) {
      if (output) output.textContent = '缺少玩家 ID。'
      return
    }
    if (output) output.textContent = '正在保存...'
    const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('players/action'), 'POST', bodyPayload).catch((error) => failedEnvelope(state.route, error))
    if (output) output.textContent = operationSummary(normalizeEnvelope(state.route, result))
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

const renderTerritoriesPage = async (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const query = new URLSearchParams(state.context?.routeQuery || '')
  const activeView = query.get('view') === 'squads' ? 'squads' : 'territories'
  const source = sourceSummary(envelope)
  const blocked = !isUsable(envelope)
  const territoryRows = rowsFromEnvelope(envelope, blocked ? [] : [sampleRow(territoryColumns)])
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    ${source ? `<div class="notice"><strong>数据来源</strong><p>${escapeHtml(source)}</p></div>` : ''}
    <div class="controls">
      <div class="segmented-control" role="group" aria-label="领地视图切换">
        <button type="button" data-territory-view="territories" aria-pressed="${activeView === 'territories'}">领地</button>
        <button type="button" data-territory-view="squads" aria-pressed="${activeView === 'squads'}" ${blocked ? 'disabled' : ''}>小队</button>
      </div>
      <button type="button" class="action-button secondary" data-action="reload-territories" ${blocked ? 'disabled' : ''}>刷新</button>
    </div>
    <div data-role="territory-view-body"></div>
    <div data-role="squad-detail-dialog" class="inline-dialog"></div>
  `
  body(state).querySelectorAll<HTMLButtonElement>('[data-territory-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = (button.dataset.territoryView || 'territories') as TerritoryViewMode
      const params = new URLSearchParams(state.context?.routeQuery || '')
      params.set('view', nextView)
      state.bridge.navigate({ kind: 'plugin-route', target: `/plugins/${scumAdminPluginID}/territories?${params.toString()}` })
    })
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-territories"]')?.addEventListener('click', () => {
    void renderTerritoriesPage(state, envelope)
  })
  if (activeView === 'squads' && !blocked) {
    await renderSquadListView(state)
    return
  }
  renderTerritoryListView(state, territoryRows)
}

const territoryColumns = [
  { key: 'territoryId', label: '领地 ID' },
  { key: 'ownerName', label: '归属角色' },
  { key: 'ownerSteamId', label: 'SteamID' },
  { key: 'squadName', label: '所属小队' },
  { key: 'locationX', label: 'X' },
  { key: 'locationY', label: 'Y' }
]

const squadColumns = [
  { key: 'squadId', label: '小队 ID' },
  { key: 'squadName', label: '小队名称' },
  { key: 'memberCount', label: '人数' },
  { key: 'leaderName', label: '队长' },
  { key: 'leaderSteamId', label: '队长 SteamID' },
  { key: 'lastSeen', label: '最近活动' }
]

const squadMemberColumns = [
  { key: 'playerId', label: '玩家 ID' },
  { key: 'name', label: '名称' },
  { key: 'steamId', label: 'SteamID' },
  { key: 'squadRole', label: '身份' },
  { key: 'status', label: '状态' },
  { key: 'locationX', label: 'X' },
  { key: 'locationY', label: 'Y' },
  { key: 'lastSeen', label: '最近活动' }
]

const squadVehicleColumns = [
  { key: 'id', label: '载具 ID' },
  { key: 'vehicleType', label: '载具类型' },
  { key: 'ownerName', label: '归属角色' },
  { key: 'ownerPrisonerId', label: '归属玩家' },
  { key: 'locationX', label: 'X' },
  { key: 'locationY', label: 'Y' }
]

const renderTerritoryListView = (state: RenderState, rows: Record<string, unknown>[]) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="territory-view-body"]')
  if (!target) {
    return
  }
  target.innerHTML = genericTable(rows, territoryColumns, '暂无领地数据。')
}

const renderSquadListView = async (state: RenderState) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="territory-view-body"]')
  if (!target) {
    return
  }
  target.innerHTML = '<div class="empty">正在加载小队...</div>'
  const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('squads'), 'GET').catch((error) => failedEnvelope(state.route, error))
  const envelope = normalizeEnvelope(state.route, result)
  if (!isUsable(envelope)) {
    target.innerHTML = blockedNotice(state.route, envelope)
    return
  }
  const rows = rowsFromEnvelope(envelope, [])
  target.innerHTML = squadTable(rows)
  target.querySelector<HTMLElement>('table')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="squad-detail"]')
    if (!button) {
      return
    }
    const squadId = button.dataset.squadId || ''
    const row = rows.find((item) => String(item.squadId || item.id || '') === squadId) || {}
    void openSquadDetailDialog(state, row)
  })
}

const squadTable = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return '<div class="empty">暂无小队数据。</div>'
  }
  return `
    <table>
      <thead><tr>${squadColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}<th>操作</th></tr></thead>
      <tbody>
        ${rows.map((row) => {
          const squadId = String(row.squadId || row.id || '')
          return `
            <tr>
              ${squadColumns.map((column) => `<td>${escapeHtml(String(row[column.key] ?? '-'))}</td>`).join('')}
              <td><button type="button" class="action-button secondary" data-action="squad-detail" data-squad-id="${escapeHtml(squadId)}">详情</button></td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
  `
}

const openSquadDetailDialog = async (state: RenderState, squad: Record<string, unknown>) => {
  const dialog = body(state).querySelector<HTMLElement>('[data-role="squad-detail-dialog"]')
  const squadId = String(squad.squadId || squad.id || '')
  if (!dialog || !squadId) {
    return
  }
  dialog.innerHTML = '<div class="notice">正在加载小队详情...</div>'
  const [memberResult, vehicleResult] = await Promise.all([
    state.bridge.api<PluginEnvelope>(pluginAPIPath('squads/members'), 'GET', undefined, { squadId }).catch((error) => failedEnvelope(state.route, error)),
    state.bridge.api<PluginEnvelope>(pluginAPIPath('squads/vehicles'), 'GET', undefined, { squadId }).catch((error) => failedEnvelope(state.route, error))
  ])
  const memberEnvelope = normalizeEnvelope(state.route, memberResult)
  const vehicleEnvelope = normalizeEnvelope(state.route, vehicleResult)
  const members = isUsable(memberEnvelope) ? rowsFromEnvelope(memberEnvelope, []) : []
  const vehicles = isUsable(vehicleEnvelope) ? rowsFromEnvelope(vehicleEnvelope, []) : []
  const playerIds = members.map((member) => String(member.playerId || member.id || '')).filter(Boolean)
  dialog.innerHTML = `
    <div class="inline-dialog-panel" role="dialog" aria-modal="true" aria-label="小队详情">
      <div class="notice">
        <div class="surface-title">
          <div>
            <h3>${escapeHtml(String(squad.squadName || `小队 #${squadId}`))}</h3>
            <p>${escapeHtml(`成员 ${members.length} 人，载具 ${vehicles.length} 台。`)}</p>
          </div>
          <button type="button" class="action-button secondary" data-action="close-squad-detail">关闭</button>
        </div>
        <div class="table-actions">
          <button type="button" class="action-button secondary" data-action="open-squad-map" ${playerIds.length === 0 ? 'disabled' : ''}>整队轨迹</button>
          <span class="status-pill" data-tone="ok">小队详情</span>
        </div>
      </div>
      ${!isUsable(memberEnvelope) ? blockedNotice(state.route, memberEnvelope) : ''}
      <div class="task-row">
        <strong>队员</strong>
        <div class="inline-dialog-table">${genericTable(members, squadMemberColumns, '暂无队员数据。')}</div>
      </div>
      ${!isUsable(vehicleEnvelope) ? blockedNotice(state.route, vehicleEnvelope) : ''}
      <div class="task-row">
        <strong>载具</strong>
        <div class="inline-dialog-table">${genericTable(vehicles, squadVehicleColumns, '暂无整队载具数据。')}</div>
      </div>
    </div>
  `
  dialog.onclick = (event) => {
    if (event.target === dialog) {
      dialog.innerHTML = ''
    }
  }
  dialog.querySelector<HTMLButtonElement>('[data-action="close-squad-detail"]')?.addEventListener('click', () => {
    dialog.innerHTML = ''
  })
  dialog.querySelector<HTMLButtonElement>('[data-action="open-squad-map"]')?.addEventListener('click', () => {
    openTrajectoryMap(state, playerIds, parsedRouteQuery(state))
  })
}

const renderLogsPage = (state: RenderState, envelope: PluginEnvelope) => {
  syncPreferredWorkspaceForRoute(state, 'logs')
  renderSettingsPage(state, envelope)
}

const loadSettingsWorkspace = async (state: RenderState, workspaces: ConfigWorkspace[], supportedFiles: string[], fileDescriptions: FileDescriptionMap, structuredFields: StructuredField[], structuredPath: string) => {
  const workspaceLoadVersion = state.settingsWorkspaceLoadVersion + 1
  state.settingsWorkspaceLoadVersion = workspaceLoadVersion
  const workspaceKey = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.value || workspaces[0]?.key || ''
  const workspace = workspaces.find((item) => item.key === workspaceKey) || workspaces[0]
  if (!workspace) {
    setRouteNotice(state, 'settings-status', '未找到配置目录。', true)
    return
  }
  state.preferredSettingsWorkspaceKey = workspace.key
  setRouteNotice(state, 'settings-status', '')
  const searchInput = body(state).querySelector<HTMLInputElement>('[data-role="settings-file-search"]')
  if (searchInput) {
    searchInput.value = state.settingsSearchQueryByWorkspace[workspace.key] || ''
  }
  if (!state.settingsModeTouched) {
    setSettingsViewMode(state, defaultSettingsViewMode('', structuredPath, [], workspace.key))
  }
  setFileSelectLoading(state, 'settings-file')
  setSettingsFields(state, [])
  setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
  publishSettingsToolbar(state, true)
  try {
    const entriesResult = await loadDirectoryEntries(state, workspace.directoryPath, () => state.settingsWorkspaceLoadVersion !== workspaceLoadVersion)
    if (!entriesResult) {
      return
    }
    const entries = normalizeWorkspaceEntries(workspace.directoryPath, entriesResult)
    if (state.settingsWorkspaceLoadVersion !== workspaceLoadVersion) {
      return
    }
    const scopedSupportedFiles = workspace.supportedFiles && workspace.supportedFiles.length > 0 ? workspace.supportedFiles : supportedFiles
    const filteredEntries = workspace.key === 'game-logs' ? entries : filterEntriesByRelativePath(entries, scopedSupportedFiles)
    const prioritizedEntries = prioritizeFiles(filteredEntries, scopedSupportedFiles, workspace.key === 'game-logs')
    state.settingsDirectoryEntriesByWorkspace = {
      ...state.settingsDirectoryEntriesByWorkspace,
      [workspace.key]: prioritizedEntries
    }
    const preferredPath = state.preferredSettingsFileByWorkspace[workspace.key]
      || (workspace.key === 'windows-server' ? structuredPath : '')
      || workspace.defaultFilePath
    populateFileSelect(state, 'settings-file', prioritizedEntries, preferredPath, fileDescriptions, workspace.key === 'game-logs')
    syncFilteredFileSelect(state, fileDescriptions)
    rememberSettingsFileSelection(state, workspace.key, body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.value || '')
    publishSettingsToolbar(state)
    const emptyText = workspace.key === 'game-logs' ? '当前日志目录下暂未发现可读取的日志文件。' : '未找到可读取的配置文件。'
    setRouteNotice(state, 'settings-status', prioritizedEntries.length > 0 ? '' : emptyText, prioritizedEntries.length === 0)
    if (state.settingsWorkspaceLoadVersion !== workspaceLoadVersion) {
      return
    }
    await loadSettingsFile(state, fileDescriptions, structuredFields, structuredPath)
  } catch (error) {
    if (state.settingsWorkspaceLoadVersion !== workspaceLoadVersion) {
      return
    }
    setRouteNotice(state, 'settings-status', coreErrorMessage(error), true)
    setSettingsFields(state, [])
    setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
    publishSettingsToolbar(state)
  }
}

const loadSettingsFile = async (state: RenderState, fileDescriptions: FileDescriptionMap, structuredFields: StructuredField[], structuredPath: string) => {
  const fileLoadVersion = state.settingsFileLoadVersion + 1
  state.settingsFileLoadVersion = fileLoadVersion
  const workspace = selectedSettingsWorkspace(state)
  const relativePath = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.value || ''
  if (workspace) {
    rememberSettingsFileSelection(state, workspace.key, relativePath)
  }
  if (!relativePath) {
    const emptyText = workspace?.key === 'game-logs' ? '当前日志目录下暂未发现可读取的日志文件。' : '当前目录下没有可读取的配置文件。'
    setRouteNotice(state, 'settings-status', emptyText, true)
    setSettingsFields(state, [])
    setSettingsEditor(state, '', '', '', structuredFields, structuredPath)
    return
  }
  setRouteNotice(state, 'settings-status', '')
  try {
    const result = await readFile(state, relativePath, () => state.settingsFileLoadVersion !== fileLoadVersion)
    if (!result) {
      return
    }
    if (state.settingsFileLoadVersion !== fileLoadVersion) {
      return
    }
    const content = typeof result.content === 'string' ? result.content : ''
    const editable = sameRelativePath(relativePath, structuredPath)
    const fields = editable ? resolveEditableSettingsFields(structuredFields, content, true) : []
    setSettingsFields(state, fields)
    setSettingsEditor(state, relativePath, content, typeof result.checksum === 'string' ? result.checksum : '', structuredFields, structuredPath)
    if (!state.settingsModeTouched) {
      setSettingsViewMode(state, defaultSettingsViewMode(relativePath, structuredPath, fields, workspace?.key || ''))
    }
    setRouteNotice(state, 'settings-status', result.truncated ? '内容过长，当前只显示截断后的末尾片段。' : '', Boolean(result.truncated))
  } catch (error) {
    if (state.settingsFileLoadVersion !== fileLoadVersion) {
      return
    }
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
  const status = body(state).querySelector<HTMLElement>('[data-role="settings-save-status"]')
  if (!editor) {
    return
  }
  editor.value = content
  editor.dataset.original = content
  editor.dataset.path = path
  editor.dataset.checksum = checksum
  editor.dataset.structuredPath = structuredPath
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
}

const defaultSettingsViewMode = (relativePath: string, structuredPath: string, fields: ResolvedStructuredField[], workspaceKey = ''): RenderState['settingsViewMode'] => {
  if (workspaceKey === 'game-logs') {
    return 'raw'
  }
  if (normalizeRelativePath(relativePath) === normalizeRelativePath(structuredPath) && fields.some((field) => field.editable)) {
    return 'structured'
  }
  return 'raw'
}

const rememberSettingsFileSelection = (state: RenderState, workspaceKey: string, relativePath: string) => {
  const normalizedWorkspaceKey = String(workspaceKey || '').trim()
  if (!normalizedWorkspaceKey) {
    return
  }
  const normalizedPath = normalizeRelativePath(relativePath)
  if (!normalizedPath) {
    state.preferredSettingsFileByWorkspace = Object.fromEntries(
      Object.entries(state.preferredSettingsFileByWorkspace).filter(([key]) => key !== normalizedWorkspaceKey)
    )
    return
  }
  state.preferredSettingsFileByWorkspace = {
    ...state.preferredSettingsFileByWorkspace,
    [normalizedWorkspaceKey]: normalizedPath,
  }
}

const syncPreferredWorkspaceForRoute = (state: RenderState, routeKey: string) => {
  const workspace = settingsWorkspaceOptions.find((option) => option.routeKey === routeKey)
  if (!workspace) {
    return
  }
  state.preferredSettingsWorkspaceKey = workspace.key
}

const preferredWorkspaceOptionForCurrentRoute = (state: RenderState) => {
  const routeWorkspace = settingsWorkspaceOptions.find((workspace) => workspace.routeKey === state.route.key)
  if (routeWorkspace) {
    return routeWorkspace
  }
  return settingsWorkspaceOptions.find((workspace) => workspace.key === state.preferredSettingsWorkspaceKey) || settingsWorkspaceOptions[0]
}

const settingsWorkspaceLabel = (option: SettingsWorkspaceOption, workspaces: ConfigWorkspace[]) => {
  return workspaces.find((workspace) => workspace.key === option.key)?.title || option.title
}

const selectedSettingsWorkspace = (state: RenderState) => {
  const workspaceKey = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.value || state.preferredSettingsWorkspaceKey
  const title = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')?.selectedOptions?.[0]?.textContent?.trim() || ''
  return {
    key: workspaceKey,
    title
  }
}

const publishSettingsToolbar = (state: RenderState, disabled = false) => {
  if (state.route.key !== 'settings' && state.route.key !== 'logs') {
    clearHostToolbar(state)
    return
  }
  const workspaceSelect = body(state).querySelector<HTMLSelectElement>('[data-role="settings-workspace"]')
  const fileSelect = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')
  state.bridge.toolbar({
    visible: true,
    controls: [
      {
        key: 'settings-workspace',
        kind: 'select',
        label: '目录',
        value: workspaceSelect?.value || state.preferredSettingsWorkspaceKey,
        disabled: disabled || Boolean(workspaceSelect?.disabled),
        options: selectOptions(workspaceSelect)
      },
      {
        key: 'settings-file',
        kind: 'select',
        label: '文件',
        value: fileSelect?.value || '',
        disabled: disabled || Boolean(fileSelect?.disabled) || (fileSelect ? fileSelect.options.length === 0 : true),
        options: selectOptions(fileSelect)
      }
    ],
    actions: [
      {
        key: 'reload-settings',
        label: '刷新目录',
        disabled: disabled || Boolean(workspaceSelect?.disabled)
      }
    ]
  })
}

const clearHostToolbar = (state: RenderState) => {
  state.bridge.toolbar({ visible: false, controls: [], actions: [] })
}

const handleHostToolbarAction = (state: RenderState, payload: PluginToolbarActionPayload) => {
  if (state.route.key !== 'settings' && state.route.key !== 'logs') {
    return
  }
  const key = String(payload.key || '')
  if (payload.kind === 'click' && key === 'reload-settings') {
    body(state).querySelector<HTMLButtonElement>('[data-action="reload-settings"]')?.click()
    return
  }
  if (payload.kind !== 'change') {
    return
  }
  const selector = key === 'settings-workspace' ? '[data-role="settings-workspace"]' : key === 'settings-file' ? '[data-role="settings-file"]' : ''
  const select = selector ? body(state).querySelector<HTMLSelectElement>(selector) : null
  if (!select) {
    return
  }
  select.value = String(payload.value || '')
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

const selectOptions = (select?: HTMLSelectElement | null) => {
  if (!select) {
    return []
  }
  return Array.from(select.options).map((option) => ({
    label: option.textContent?.trim() || option.value,
    value: option.value
  }))
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

const playersTable = (rows: Record<string, unknown>[], selectedIDs: string[]) => {
  if (rows.length === 0) {
    return '<div class="empty">没有匹配的玩家。</div>'
  }
  const allSelected = rows.length > 0 && rows.every((row) => selectedIDs.includes(String(row.playerId || row.id || '')))
  return `
    <table>
      <thead><tr><th><input type="checkbox" data-role="player-select-all" ${allSelected ? 'checked' : ''} /></th><th>玩家</th><th>SteamID</th><th>最近登录 IP</th><th>同 IP 预警</th><th>状态</th><th>最近活动</th><th>操作</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><input type="checkbox" data-role="player-select" value="${escapeHtml(String(row.playerId || row.id || ''))}" ${selectedIDs.includes(String(row.playerId || row.id || '')) ? 'checked' : ''} /></td>
            <td>${escapeHtml(String(row.name || row.id || '-'))}</td>
            <td>${escapeHtml(String(row.steamId || row.steamID || '-'))}</td>
            <td>${escapeHtml(String(row.lastLoginIp || row.last_login_ip || '-'))}</td>
            <td>${duplicateIPCell(row)}</td>
            <td>${escapeHtml(String(row.status || '-'))}</td>
            <td>${escapeHtml(String(row.lastSeen || row.updatedAt || '-'))}</td>
            <td>
              <button type="button" class="action-button secondary" data-action="select-player" data-player-id="${escapeHtml(String(row.playerId || row.id || ''))}">详情</button>
              <button type="button" class="action-button secondary" data-action="row-open-map" data-player-id="${escapeHtml(String(row.playerId || row.id || ''))}">地图</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

const parsedRouteQuery = (state: RenderState): RouteQueryState => {
  const search = new URLSearchParams(state.context?.routeQuery || '')
  const focus = search.get('focus') === 'vehicles' || search.get('focus') === 'supplies' ? search.get('focus') as RouteQueryState['focus'] : 'players'
  const startTime = search.get('startTime') || defaultStartTime()
  const endTime = search.get('endTime') || defaultEndTime()
  const playerIDs = String(search.get('playerIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return { focus, playerIds: playerIDs, startTime, endTime }
}

const defaultEndTime = () => new Date().toISOString().slice(0, 16)

const defaultStartTime = () => {
  const value = new Date(Date.now() - 6 * 60 * 60 * 1000)
  return value.toISOString().slice(0, 16)
}

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const openTrajectoryMap = (state: RenderState, playerIDs: string[], routeQuery: RouteQueryState) => {
  const target = `/plugins/${scumAdminPluginID}/trajectory-map?focus=players&playerIds=${encodeURIComponent(playerIDs.join(','))}&startTime=${encodeURIComponent(routeQuery.startTime)}&endTime=${encodeURIComponent(routeQuery.endTime)}`
  state.bridge.navigate({ kind: 'plugin-route', target })
}

const openPlayerActionDialog = (state: RenderState, mode: PlayerActionDialogMode, rows: Record<string, unknown>[], selectedIDs: string[]) => {
  const modal = body(state).querySelector<HTMLElement>('[data-role="player-action-modal"]')
  if (!modal) {
    return
  }
  const effectiveIDs = selectedIDs.length > 0 ? selectedIDs : rows.slice(0, 1).map((row) => String(row.playerId || row.id || '')).filter(Boolean)
  if (effectiveIDs.length === 0) {
    modal.innerHTML = '<div class="notice error">请先选择至少一名玩家。</div>'
    return
  }
  modal.innerHTML = `
    <div class="notice">
      <div class="surface-title">
        <div>
          <h3>${mode === 'send-item' ? '批量发物品' : '批量发礼包'}</h3>
        </div>
        <button type="button" class="action-button secondary" data-action="close-player-action">关闭</button>
      </div>
      <p>将向 ${effectiveIDs.length} 名玩家提交受控发放任务。</p>
      <div class="controls">
        ${mode === 'send-item'
          ? `
            <input type="text" data-role="dispatch-item-code" placeholder="物品代码" />
            <input type="number" data-role="dispatch-item-quantity" placeholder="数量" value="1" min="1" />
          `
          : `
            <input type="number" data-role="dispatch-gift-id" placeholder="礼包 ID" min="1" />
          `}
      </div>
      <label class="controls">
        <input type="checkbox" data-role="dispatch-confirmed" />
        <span>我确认这是高风险发放操作</span>
      </label>
      <div class="controls">
        <button type="button" class="action-button" data-action="submit-player-action">提交任务</button>
      </div>
      <div data-role="dispatch-result"></div>
    </div>
  `
  modal.querySelector<HTMLButtonElement>('[data-action="close-player-action"]')?.addEventListener('click', () => {
    modal.innerHTML = ''
  })
  modal.querySelector<HTMLButtonElement>('[data-action="submit-player-action"]')?.addEventListener('click', async () => {
    const confirmed = modal.querySelector<HTMLInputElement>('[data-role="dispatch-confirmed"]')?.checked || false
    const resultNode = modal.querySelector<HTMLElement>('[data-role="dispatch-result"]')
    if (!confirmed) {
      if (resultNode) {
        resultNode.textContent = '请先确认本次高风险发放操作。'
      }
      return
    }
    const payload: Record<string, unknown> = {
      confirmed: true,
      action: mode,
      serverInstanceId: currentServerInstanceID(state),
      playerIds: effectiveIDs.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    }
    if (mode === 'send-item') {
      payload.itemCode = modal.querySelector<HTMLInputElement>('[data-role="dispatch-item-code"]')?.value || ''
      payload.quantity = Number(modal.querySelector<HTMLInputElement>('[data-role="dispatch-item-quantity"]')?.value || '1') || 1
    } else {
      payload.giftId = Number(modal.querySelector<HTMLInputElement>('[data-role="dispatch-gift-id"]')?.value || '0') || 0
    }
    if (resultNode) {
      resultNode.textContent = '正在提交 operation handle...'
    }
    const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('players/action'), 'POST', payload).catch((error) => failedEnvelope(state.route, error))
    if (resultNode) {
      resultNode.textContent = operationSummary(normalizeEnvelope(state.route, result))
    }
  })
}

const openGiftDetailDialog = async (state: RenderState, giftID: number) => {
  const dialog = body(state).querySelector<HTMLElement>('[data-role="gift-dialog"]')
  if (!dialog || !giftID) {
    return
  }
  dialog.innerHTML = '<div class="notice">正在加载礼包详情...</div>'
  const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('gifts/detail'), 'GET', undefined, { giftId: giftID }).catch((error) => failedEnvelope(state.route, error))
  const envelope = normalizeEnvelope(state.route, result)
  const detail = envelope.data?.gift as Record<string, unknown> | undefined
  dialog.innerHTML = `
    <div class="notice">
      <div class="surface-title">
        <div>
          <h3>${escapeHtml(String(detail?.name || `礼包 #${giftID}`))}</h3>
        </div>
        <button type="button" class="action-button secondary" data-action="close-gift-dialog">关闭</button>
      </div>
      <p>编码：${escapeHtml(String(detail?.code || '-'))}</p>
      <p>状态：${escapeHtml(String(detail?.status || '-'))}</p>
      <p>说明：${escapeHtml(String(detail?.description || '暂无说明'))}</p>
      <details>
        <summary>物品明细</summary>
        <pre>${escapeHtml(String(detail?.itemsJson || '[]'))}</pre>
      </details>
    </div>
  `
  dialog.querySelector<HTMLButtonElement>('[data-action="close-gift-dialog"]')?.addEventListener('click', () => {
    dialog.innerHTML = ''
  })
}

const openGiftMutationDialog = (state: RenderState, action: 'create' | 'update' | 'delete', giftID: number, rows: Record<string, unknown>[]) => {
  const dialog = body(state).querySelector<HTMLElement>('[data-role="gift-dialog"]')
  if (!dialog) {
    return
  }
  const row = rows.find((item) => Number(item.giftId || item.id || 0) === giftID) || {}
  dialog.innerHTML = `
    <div class="notice">
      <div class="surface-title">
        <div>
          <h3>${action === 'create' ? '新增礼包' : action === 'update' ? '编辑礼包' : '删除礼包'}</h3>
        </div>
        <button type="button" class="action-button secondary" data-action="close-gift-dialog">关闭</button>
      </div>
      ${action === 'delete'
        ? `<p>将删除礼包 <strong>${escapeHtml(String(row.name || giftID || ''))}</strong>。</p>`
        : `
          <div class="controls">
            <input type="text" data-role="gift-name" placeholder="礼包名称" value="${escapeHtml(String(row.name || ''))}" />
            <input type="text" data-role="gift-code" placeholder="礼包编码" value="${escapeHtml(String(row.code || ''))}" />
            <input type="text" data-role="gift-status" placeholder="状态" value="${escapeHtml(String(row.status || 'active'))}" />
          </div>
          <div class="controls">
            <input type="text" data-role="gift-description" placeholder="礼包说明" value="${escapeHtml(String(row.description || ''))}" />
          </div>
          <div class="controls">
            <textarea data-role="gift-items-json" rows="6" placeholder='[{"itemCode":"","quantity":1}]'>${escapeHtml(String(row.itemsJson || '[]'))}</textarea>
          </div>
        `}
      <label class="controls">
        <input type="checkbox" data-role="gift-confirmed" />
        <span>我确认这是高风险礼包配置操作</span>
      </label>
      <div class="controls">
        <button type="button" class="action-button" data-action="submit-gift-mutation">提交</button>
      </div>
      <div data-role="gift-mutation-result"></div>
    </div>
  `
  dialog.querySelector<HTMLButtonElement>('[data-action="close-gift-dialog"]')?.addEventListener('click', () => {
    dialog.innerHTML = ''
  })
  dialog.querySelector<HTMLButtonElement>('[data-action="submit-gift-mutation"]')?.addEventListener('click', async () => {
    const confirmed = dialog.querySelector<HTMLInputElement>('[data-role="gift-confirmed"]')?.checked || false
    const resultNode = dialog.querySelector<HTMLElement>('[data-role="gift-mutation-result"]')
    if (!confirmed) {
      if (resultNode) {
        resultNode.textContent = '请先确认本次高风险礼包操作。'
      }
      return
    }
    const payload: Record<string, unknown> = {
      confirmed: true,
      action,
      giftId: giftID,
      name: dialog.querySelector<HTMLInputElement>('[data-role="gift-name"]')?.value || '',
      code: dialog.querySelector<HTMLInputElement>('[data-role="gift-code"]')?.value || '',
      status: dialog.querySelector<HTMLInputElement>('[data-role="gift-status"]')?.value || 'active',
      description: dialog.querySelector<HTMLInputElement>('[data-role="gift-description"]')?.value || '',
      itemsJson: dialog.querySelector<HTMLTextAreaElement>('[data-role="gift-items-json"]')?.value || '[]'
    }
    if (resultNode) {
      resultNode.textContent = '正在提交 operation handle...'
    }
    const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('gifts/action'), 'POST', payload).catch((error) => failedEnvelope(state.route, error))
    if (resultNode) {
      resultNode.textContent = operationSummary(normalizeEnvelope(state.route, result))
    }
  })
}

const openGiftSendDialog = (state: RenderState, giftID: number) => {
  const dialog = body(state).querySelector<HTMLElement>('[data-role="gift-dialog"]')
  if (!dialog || !giftID) {
    return
  }
  dialog.innerHTML = `
    <div class="notice">
      <div class="surface-title">
        <div>
          <h3>发送礼包给玩家</h3>
        </div>
        <button type="button" class="action-button secondary" data-action="close-gift-dialog">关闭</button>
      </div>
      <div class="controls">
        <input type="text" data-role="gift-send-player-ids" placeholder="玩家 ID，逗号分隔" />
      </div>
      <label class="controls">
        <input type="checkbox" data-role="gift-send-confirmed" />
        <span>我确认这是高风险礼包发放操作</span>
      </label>
      <div class="controls">
        <button type="button" class="action-button" data-action="submit-gift-send">提交任务</button>
      </div>
      <div data-role="gift-send-result"></div>
    </div>
  `
  dialog.querySelector<HTMLButtonElement>('[data-action="close-gift-dialog"]')?.addEventListener('click', () => {
    dialog.innerHTML = ''
  })
  dialog.querySelector<HTMLButtonElement>('[data-action="submit-gift-send"]')?.addEventListener('click', async () => {
    const confirmed = dialog.querySelector<HTMLInputElement>('[data-role="gift-send-confirmed"]')?.checked || false
    const resultNode = dialog.querySelector<HTMLElement>('[data-role="gift-send-result"]')
    if (!confirmed) {
      if (resultNode) {
        resultNode.textContent = '请先确认本次高风险礼包发放操作。'
      }
      return
    }
    const playerIDs = String(dialog.querySelector<HTMLInputElement>('[data-role="gift-send-player-ids"]')?.value || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
    const result = await state.bridge.api<PluginEnvelope>(pluginAPIPath('players/action'), 'POST', {
      confirmed: true,
      action: 'send-gift',
      serverInstanceId: currentServerInstanceID(state),
      playerIds: playerIDs,
      giftId: giftID
    }).catch((error) => failedEnvelope(state.route, error))
    if (resultNode) {
      resultNode.textContent = operationSummary(normalizeEnvelope(state.route, result))
    }
  })
}

const renderTrajectoryMapPage = (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const query = parsedRouteQuery(state)
  const layers = typeof envelope.data?.layers === 'object' && envelope.data?.layers ? envelope.data.layers as Record<string, unknown> : {}
  const focus = (String(layers.focus || query.focus || 'players').trim() as RouteQueryState['focus']) || 'players'
  const playerRows = Array.isArray(layers.players) ? layers.players as Record<string, unknown>[] : []
  const vehicleRows = Array.isArray(layers.vehicles) ? layers.vehicles as Record<string, unknown>[] : []
  const supplyRows = Array.isArray(layers.supplies) ? layers.supplies as Record<string, unknown>[] : []
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="controls">
      <select data-role="map-focus" ${blocked ? 'disabled' : ''}>
        <option value="players" ${focus === 'players' ? 'selected' : ''}>玩家轨迹</option>
        <option value="vehicles" ${focus === 'vehicles' ? 'selected' : ''}>载具状态</option>
        <option value="supplies" ${focus === 'supplies' ? 'selected' : ''}>物资状态</option>
      </select>
      <input type="datetime-local" data-role="map-start" value="${escapeHtml(query.startTime)}" ${blocked ? 'disabled' : ''} />
      <input type="datetime-local" data-role="map-end" value="${escapeHtml(query.endTime)}" ${blocked ? 'disabled' : ''} />
      <input type="text" data-role="map-player-ids" value="${escapeHtml(query.playerIds.join(','))}" placeholder="玩家 ID，逗号分隔" ${blocked ? 'disabled' : ''} />
      <button type="button" class="action-button secondary" data-action="reload-map" ${blocked ? 'disabled' : ''}>刷新</button>
    </div>
    <div class="notice">
      <strong>当前视图</strong>
      <p>${escapeHtml(focus === 'players' ? '玩家轨迹按时间点显示；载具和物资当前以时间切片快照方式展示。' : focus === 'vehicles' ? '载具页展示当前时间范围内最近快照。' : '物资页展示当前时间范围内最近快照。')}</p>
    </div>
    <div class="task-row">
      <strong>玩家轨迹</strong>
      <p>${playerRows.length > 0 ? `已返回 ${playerRows.length} 条轨迹点或轨迹记录。` : '当前时间范围没有玩家轨迹数据。'}</p>
    </div>
    ${genericTable(
      focus === 'players' ? playerRows : focus === 'vehicles' ? vehicleRows : supplyRows,
      focus === 'players'
        ? [
          { key: 'playerId', label: '玩家 ID' },
          { key: 'name', label: '名称' },
          { key: 'locationX', label: 'X' },
          { key: 'locationY', label: 'Y' },
          { key: 'locationZ', label: 'Z' },
          { key: 'observedAt', label: '时间' }
        ]
        : focus === 'vehicles'
          ? [
            { key: 'id', label: '载具 ID' },
            { key: 'vehicleType', label: '载具类型' },
            { key: 'ownerPrisonerId', label: '归属玩家' },
            { key: 'locationX', label: 'X' },
            { key: 'locationY', label: 'Y' },
            { key: 'locationZ', label: 'Z' }
          ]
          : [
            { key: 'id', label: '物资 ID' },
            { key: 'name', label: '名称' },
            { key: 'locationX', label: 'X' },
            { key: 'locationY', label: 'Y' },
            { key: 'locationZ', label: 'Z' },
            { key: 'observedAt', label: '时间' }
          ],
      focus === 'players' ? '暂无玩家轨迹数据。' : focus === 'vehicles' ? '暂无载具快照数据。' : '暂无物资快照数据。'
    )}
  `
  body(state).querySelector<HTMLButtonElement>('[data-action="reload-map"]')?.addEventListener('click', async () => {
    const nextFocus = (body(state).querySelector<HTMLSelectElement>('[data-role="map-focus"]')?.value || 'players') as RouteQueryState['focus']
    const nextStart = body(state).querySelector<HTMLInputElement>('[data-role="map-start"]')?.value || defaultStartTime()
    const nextEnd = body(state).querySelector<HTMLInputElement>('[data-role="map-end"]')?.value || defaultEndTime()
    const nextPlayerIDs = String(body(state).querySelector<HTMLInputElement>('[data-role="map-player-ids"]')?.value || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    state.bridge.navigate({
      kind: 'plugin-route',
      target: `/plugins/${scumAdminPluginID}/trajectory-map?focus=${encodeURIComponent(nextFocus)}&playerIds=${encodeURIComponent(nextPlayerIDs.join(','))}&startTime=${encodeURIComponent(nextStart)}&endTime=${encodeURIComponent(nextEnd)}`
    })
  })
}

const renderGiftsPage = async (state: RenderState, envelope: PluginEnvelope) => {
  renderShell(state, envelope)
  const blocked = !isUsable(envelope)
  const rows = rowsFromEnvelope(envelope, [])
  body(state).innerHTML = `
    ${blockedNotice(state.route, envelope)}
    <div class="controls">
      <input type="search" data-role="gift-search" placeholder="搜索礼包名称或编码" />
      <button type="button" class="action-button secondary" data-action="gift-create" ${blocked ? 'disabled' : ''}>新增礼包</button>
      <button type="button" class="action-button secondary" data-action="gift-refresh" ${blocked ? 'disabled' : ''}>刷新</button>
    </div>
    <div data-role="gift-stats"></div>
    <div data-role="gift-table"></div>
    <div data-role="gift-records"></div>
    <div data-role="gift-dialog"></div>
  `
  const statsResult = blocked ? null : await state.bridge.api<PluginEnvelope>(`${pluginAPIPath('gifts/stats')}`, 'GET').catch(() => null)
  const recordsResult = blocked ? null : await state.bridge.api<PluginEnvelope>(`${pluginAPIPath('gifts/dispatch-records')}`, 'GET').catch(() => null)
  const stats = (statsResult && normalizeEnvelope(state.route, statsResult).data?.stats || {}) as GiftStatSummary
  const records = recordsResult ? rowsFromEnvelope(normalizeEnvelope(state.route, recordsResult), []) : []
  const renderGiftRows = (items: Record<string, unknown>[]) => {
    const table = body(state).querySelector<HTMLElement>('[data-role="gift-table"]')
    if (!table) {
      return
    }
    table.innerHTML = genericTable(items, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '礼包名称' },
      { key: 'code', label: '编码' },
      { key: 'status', label: '状态' },
      { key: 'dispatchCount', label: '发放次数' },
      { key: 'updatedAt', label: '更新时间' }
    ], '暂无礼包配置。')
    const actionRows = items.length === 0 ? '' : `
      <div class="task-list">
        ${items.map((row) => `
          <article class="task-row">
            <strong>${escapeHtml(String(row.name || row.id || '礼包'))}</strong>
            <p>${escapeHtml(String(row.description || '暂无说明'))}</p>
            <div class="controls">
              <button type="button" class="action-button secondary" data-action="gift-detail" data-gift-id="${escapeHtml(String(row.giftId || row.id || ''))}">详情</button>
              <button type="button" class="action-button secondary" data-action="gift-edit" data-gift-id="${escapeHtml(String(row.giftId || row.id || ''))}">编辑</button>
              <button type="button" class="action-button secondary" data-action="gift-send" data-gift-id="${escapeHtml(String(row.giftId || row.id || ''))}">发送</button>
              <button type="button" class="action-button secondary" data-action="gift-delete" data-gift-id="${escapeHtml(String(row.giftId || row.id || ''))}">删除</button>
            </div>
          </article>
        `).join('')}
      </div>
    `
    table.innerHTML += actionRows
    table.querySelectorAll<HTMLButtonElement>('[data-action^="gift-"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const giftID = Number(button.dataset.giftId || '0') || 0
        const action = button.dataset.action || ''
        if (action === 'gift-detail') {
          await openGiftDetailDialog(state, giftID)
          return
        }
        if (action === 'gift-send') {
          openGiftSendDialog(state, giftID)
          return
        }
        openGiftMutationDialog(state, action === 'gift-create' ? 'create' : action === 'gift-edit' ? 'update' : 'delete', giftID, items)
      })
    })
  }
  body(state).querySelector<HTMLElement>('[data-role="gift-stats"]')!.innerHTML = `
    <div class="controls">
      <div class="task-row"><strong>礼包总数</strong><p>${escapeHtml(String(stats.totalGifts ?? 0))}</p></div>
      <div class="task-row"><strong>启用礼包</strong><p>${escapeHtml(String(stats.activeGifts ?? 0))}</p></div>
      <div class="task-row"><strong>累计发放</strong><p>${escapeHtml(String(stats.totalDispatches ?? 0))}</p></div>
      <div class="task-row"><strong>今日发放</strong><p>${escapeHtml(String(stats.todayDispatches ?? 0))}</p></div>
    </div>
  `
  body(state).querySelector<HTMLElement>('[data-role="gift-records"]')!.innerHTML = `
    <details>
      <summary>发放记录入口</summary>
      ${genericTable(records, [
        { key: 'action', label: '动作' },
        { key: 'giftNameSnapshot', label: '礼包' },
        { key: 'itemCode', label: '物品代码' },
        { key: 'quantity', label: '数量' },
        { key: 'status', label: '状态' },
        { key: 'createdAt', label: '时间' }
      ], '暂无发放记录。')}
    </details>
  `
  renderGiftRows(rows)
  body(state).querySelector<HTMLInputElement>('[data-role="gift-search"]')?.addEventListener('input', (event) => {
    const query = String((event.target as HTMLInputElement).value || '').trim().toLowerCase()
    renderGiftRows(rows.filter((row) => String(row.name || '').toLowerCase().includes(query) || String(row.code || '').toLowerCase().includes(query)))
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="gift-create"]')?.addEventListener('click', () => {
    openGiftMutationDialog(state, 'create', 0, rows)
  })
  body(state).querySelector<HTMLButtonElement>('[data-action="gift-refresh"]')?.addEventListener('click', () => {
    void renderRoute(state, 'gifts')
  })
}

const rowByID = (rows: Record<string, unknown>[], id: string) => {
  return rows.find((row) => String(row.playerId || row.id || '') === id)
}

const optionalNumber = (value: string | undefined) => {
  const trimmed = String(value || '').trim()
  if (trimmed === '') {
    return undefined
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const duplicateIPText = (row: Record<string, unknown>) => {
  const duplicate = row.duplicateIp || row.duplicate_ip
  const count = Number(row.duplicateIpCount || row.duplicate_ip_count || 0)
  if (!duplicate || count <= 1) {
    return '正常'
  }
  return `${count} 个账号`
}

const duplicateIPCell = (row: Record<string, unknown>) => {
  const text = duplicateIPText(row)
  if (text === '正常') {
    return '<span class="status-pill" data-tone="ok">正常</span>'
  }
  return `<span class="status-pill" data-tone="warn">${escapeHtml(text)}</span>`
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

const loadDirectoryEntries = async (state: RenderState, relativePath: string, isStale: () => boolean = () => false) => {
  const serverInstanceID = currentServerInstanceID(state)
  const dispatch = await coreJSON<CoreFileDispatchResponse>(state, `/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files?path=${encodeURIComponent(relativePath)}`)
  if (dispatch.operation?.status === 'succeeded') {
    return normalizeFileEntries(dispatch.operation.result?.entries)
  }
  const operation = await waitForFileOperation(state, dispatch.operation.id, isStale)
  if (!operation) {
    return null
  }
  return normalizeFileEntries(operation.result?.entries)
}

const readFile = async (state: RenderState, relativePath: string, isStale: () => boolean = () => false) => {
  const serverInstanceID = currentServerInstanceID(state)
  const dispatch = await coreJSON<CoreFileDispatchResponse>(state, `/api/v1/server-instances/${encodeURIComponent(serverInstanceID)}/files/read`, 'POST', { path: relativePath, contentMode: 'text' })
  if (dispatch.operation?.status === 'succeeded') {
    return {
      content: dispatch.operation.result?.content,
      checksum: dispatch.operation.result?.checksum,
      sizeBytes: Number(dispatch.operation.result?.sizeBytes || 0),
      truncated: Boolean(dispatch.operation.result?.truncated),
      readOffset: Number(dispatch.operation.result?.readOffset || 0)
    }
  }
  const operation = await waitForFileOperation(state, dispatch.operation.id, isStale)
  if (!operation) {
    return null
  }
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

const waitForFileOperation = async (state: RenderState, operationID: string, isStale: () => boolean = () => false) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (isStale()) {
      return null
    }
    const operation = await coreJSON<CoreFileOperation>(state, `/api/v1/file-operations/${encodeURIComponent(operationID)}`)
    if (operation.status === 'succeeded') {
      return operation
    }
    if (operation.status === 'failed' || operation.status === 'rejected' || operation.status === 'conflicted') {
      throw new Error(operation.errorMessage || operation.errorCode || 'file operation failed')
    }
    if (isStale()) {
      return null
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

const populateFileSelect = (state: RenderState, role: string, entries: FileListEntry[], preferredPath?: string, fileDescriptions: FileDescriptionMap = {}, isLogWorkspace = false) => {
  const select = body(state).querySelector<HTMLSelectElement>(`[data-role="${role}"]`)
  if (!select) {
    return
  }
  select.disabled = entries.length === 0
  const normalizedPreferred = normalizeRelativePath(preferredPath || '')
  const preferred = entries.find((entry) => sameRelativePath(entry.relativePath, normalizedPreferred) || fileNameFromPath(entry.relativePath).toLowerCase() === fileNameFromPath(normalizedPreferred).toLowerCase())?.relativePath || entries[0]?.relativePath || ''
  const options = buildFileSelectOptions(entries, fileDescriptions, isLogWorkspace)
  select.innerHTML = entries.map((entry, index) => `
    <option value="${escapeHtml(entry.relativePath)}"${entry.relativePath === preferred ? ' selected' : ''}>${escapeHtml(options[index]?.label || entry.name)}</option>
  `).join('')
  syncFilePickerUI(state)
}

const setFileSelectLoading = (state: RenderState, role: string, label = '正在加载文件...') => {
  const select = body(state).querySelector<HTMLSelectElement>(`[data-role="${role}"]`)
  if (!select) {
    return
  }
  select.disabled = true
  select.innerHTML = `<option value="">${escapeHtml(label)}</option>`
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

// syncFilteredFileSelect refreshes the file selector from cached ordered entries and the current search query.
// state is the active route render state, and fileDescriptions carries optional per-file summaries.
// It returns after updating the selector options and publishing the synchronized host toolbar state.
const syncFilteredFileSelect = (state: RenderState, fileDescriptions: FileDescriptionMap) => {
  const workspaceKey = state.preferredSettingsWorkspaceKey
  const cachedEntries = state.settingsDirectoryEntriesByWorkspace[workspaceKey] || []
  const query = state.settingsSearchQueryByWorkspace[workspaceKey] || ''
  const isLogWorkspace = workspaceKey === 'game-logs'
  const filteredEntries = filterFileEntriesByQuery(cachedEntries, query, fileDescriptions, isLogWorkspace)
  const preferredPath = state.preferredSettingsFileByWorkspace[workspaceKey] || ''
  populateFileSelect(state, 'settings-file', filteredEntries, preferredPath, fileDescriptions, isLogWorkspace)
  publishSettingsToolbar(state)
  return body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')?.value || ''
}

// syncFilePickerUI mirrors the hidden select state into the custom dropdown trigger and option list.
// state is the active render state and the function reads the current hidden select to rebuild visible dropdown content.
// It returns after updating the trigger text and option button list, or silently exits when the picker DOM is unavailable.
const syncFilePickerUI = (state: RenderState) => {
  const select = body(state).querySelector<HTMLSelectElement>('[data-role="settings-file"]')
  const trigger = body(state).querySelector<HTMLElement>('[data-role="settings-file-trigger"]')
  const optionsRoot = body(state).querySelector<HTMLElement>('[data-role="settings-file-options"]')
  if (!select || !trigger || !optionsRoot) {
    return
  }
  const selectedOption = select.selectedOptions?.[0]
  trigger.textContent = selectedOption?.textContent?.trim() || '请选择文件'
  const options = Array.from(select.options)
  if (options.length === 0) {
    optionsRoot.innerHTML = '<div class="settings-file-picker-empty">当前没有可选文件。</div>'
    return
  }
  optionsRoot.innerHTML = options.map((option) => `
    <button
      type="button"
      class="settings-file-picker-option${option.selected ? ' is-active' : ''}"
      data-action="select-settings-file"
      data-value="${escapeHtml(option.value)}"
    >${escapeHtml(option.textContent?.trim() || option.value)}</button>
  `).join('')
}

const structuredFieldID = (section: string, key: string) => `${String(section || '').trim()}\u0000${String(key || '').trim()}`

const resolveStructuredFields = (definitions: StructuredField[], content: string) => {
  const values = parseIniValues(content)
  return definitions.map((definition) => {
    const value = values[structuredFieldID(definition.section, definition.key)] || ''
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
    values[structuredFieldID(currentSection, key)] = value
  }
  return values
}

const parseIniEntries = (content: string) => {
  const entries: Array<{ section: string; key: string; value: string }> = []
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
    entries.push({
      section: currentSection,
      key: line.slice(0, separatorIndex).trim(),
      value: line.slice(separatorIndex + 1).trim(),
    })
  }
  return entries
}

const setRouteNotice = (state: RenderState, role: string, message: string, error = false) => {
  const target = body(state).querySelector<HTMLElement>(`[data-role="${role}"]`)
  if (!target) {
    return
  }
  target.hidden = message.trim() === ''
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

const normalizedBooleanLiteral = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') {
    return 'True'
  }
  if (normalized === 'false' || normalized === '0') {
    return 'False'
  }
  return ''
}

const resolveFieldControlType = (field: StructuredField, value: string): ResolvedStructuredField['controlType'] => {
  if (field.sensitive) {
    return 'password'
  }
  if (field.type === 'boolean') {
    return 'boolean'
  }
  if (field.type === 'integer' || field.type === 'float') {
    return 'number'
  }
  if (/^-?\d+(?:\.\d+)?$/.test(String(value || '').trim())) {
    return 'number'
  }
  if (normalizedBooleanLiteral(value)) {
    return 'boolean'
  }
  return 'text'
}

const renderSettingsFieldControl = (field: ResolvedStructuredField) => {
  if (field.controlType === 'boolean') {
    const value = normalizedBooleanLiteral(field.value) || 'False'
    return `
      <select ${field.editable ? '' : 'disabled'} data-setting-section="${escapeHtml(field.section)}" data-setting-key="${escapeHtml(field.key)}">
        <option value="True" ${value === 'True' ? 'selected' : ''}>开启</option>
        <option value="False" ${value === 'False' ? 'selected' : ''}>关闭</option>
      </select>
    `
  }
  if (field.controlType === 'password') {
    return `<input type="password" value="${escapeHtml(field.value)}" ${field.editable ? '' : 'readonly'} data-setting-section="${escapeHtml(field.section)}" data-setting-key="${escapeHtml(field.key)}" />`
  }
  const inputMode = field.controlType === 'number' ? 'decimal' : 'text'
  return `<input value="${escapeHtml(field.value)}" inputmode="${inputMode}" ${field.editable ? '' : 'readonly'} data-setting-section="${escapeHtml(field.section)}" data-setting-key="${escapeHtml(field.key)}" />`
}

const prettySettingSection = (section: string) => {
  const normalizedSection = String(section || '').trim()
  if (!normalizedSection) {
    return '未分组'
  }
  return settingsSectionLabels[normalizedSection] || normalizedSection
}

const prettySettingLabel = (field: ResolvedStructuredField) => {
  const normalizedKey = String(field.key || '').trim()
  const localizedLabel = normalizedKey ? localizeSettingKey(normalizedKey) : ''
  if (localizedLabel) {
    return localizedLabel
  }
  const label = String(field.label || '').trim()
  if (label && label !== field.key) {
    return label
  }
  if (!normalizedKey) {
    return '未命名配置'
  }
  return prettySettingKey(normalizedKey)
}

const prettySettingDescription = (field: ResolvedStructuredField) => {
  const hints: string[] = []
  const sectionLabel = prettySettingSection(field.section)
  if (sectionLabel) {
    hints.push(`所属分组：${sectionLabel}`)
  }
  const validator = String(field.validator || '').trim()
  if (validator) {
    hints.push(`取值规则：${validator}`)
  }
  return hints.join(' · ')
}

const setSettingsFields = (state: RenderState, fields: ResolvedStructuredField[]) => {
  const target = body(state).querySelector<HTMLElement>('[data-role="settings-fields"]')
  if (!target) {
    return
  }
  if (fields.length === 0) {
    const workspace = selectedSettingsWorkspace(state)
    const message = workspace?.key === 'game-logs'
      ? '日志目录默认使用原文模式，只读查看内容即可。'
      : '这个文件没有可编辑字段，直接看原文即可。'
    target.innerHTML = `<div class="empty inline">${escapeHtml(message)}</div>`
    return
  }
  const groupedFields = fields.reduce<Array<{ section: string; sectionLabel: string; fields: ResolvedStructuredField[] }>>((groups, field) => {
    const currentGroup = groups[groups.length - 1]
    if (currentGroup && currentGroup.section === field.section) {
      currentGroup.fields.push(field)
      return groups
    }
    groups.push({ section: field.section, sectionLabel: field.sectionLabel || prettySettingSection(field.section), fields: [field] })
    return groups
  }, [])
  target.innerHTML = groupedFields.map((group) => `
    <section class="field-section" data-section="${escapeHtml(group.section)}">
      <div class="field-section-head">
        <div>
          <strong>${escapeHtml(group.sectionLabel)}</strong>
          <p>${escapeHtml(settingsSectionHints[group.section] || '按中文字段名快速查看和调整当前分组配置。')}</p>
        </div>
        <span>${escapeHtml(`${group.fields.length} 项配置`)}</span>
      </div>
      ${group.fields.map((field) => `
        <label data-section="${escapeHtml(field.section)}" data-key="${escapeHtml(field.key)}" data-editable="${field.editable ? 'true' : 'false'}">
          <div class="settings-field-copy">
            <strong>${escapeHtml(prettySettingLabel(field))}</strong>
            <span class="settings-field-meta">${escapeHtml(prettySettingDescription(field))}</span>
          </div>
          <div class="settings-field-control">
            ${renderSettingsFieldControl(field)}
            <span class="settings-field-path">${escapeHtml(`配置键：${field.key}`)}</span>
          </div>
        </label>
      `).join('')}
    </section>
  `).join('')
  const bindFieldMutation = (element: HTMLInputElement | HTMLSelectElement) => {
    element.addEventListener('input', () => {
      const editor = body(state).querySelector<HTMLTextAreaElement>('[data-role="settings-editor"]')
      const readOnly = element instanceof HTMLInputElement ? element.readOnly : element.disabled
      if (!editor || readOnly) {
        return
      }
      editor.value = updateIniValue(editor.value, element.dataset.settingSection || '', element.dataset.settingKey || '', element.value)
      syncSettingsEditorState(state, fields, editor.dataset.structuredPath || '')
    })
  }
  target.querySelectorAll<HTMLInputElement>('input[data-setting-section]').forEach(bindFieldMutation)
  target.querySelectorAll<HTMLSelectElement>('select[data-setting-section]').forEach((select) => {
    bindFieldMutation(select)
    select.addEventListener('change', () => select.dispatchEvent(new Event('input')))
  })
}

const resolveEditableSettingsFields = (definitions: StructuredField[], content: string, editable: boolean) => {
  const definitionByID = new Map<string, StructuredField>()
  for (const definition of definitions) {
    definitionByID.set(structuredFieldID(definition.section, definition.key), definition)
  }
  const entries = parseIniEntries(content)
  const fields: ResolvedStructuredField[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const fieldID = structuredFieldID(entry.section, entry.key)
    if (seen.has(fieldID)) {
      continue
    }
    seen.add(fieldID)
    const definition = definitionByID.get(fieldID)
    const baseField: StructuredField = definition || {
      section: entry.section,
      sectionLabel: prettySettingSection(entry.section),
      key: entry.key,
      label: localizeSettingKey(entry.key) || prettySettingKey(entry.key),
      validator: '',
    }
    fields.push({
      ...baseField,
      value: entry.value,
      controlType: resolveFieldControlType(baseField, entry.value),
      editable: editable,
    })
  }
  return fields
}

const prettySettingKey = (key: string) => {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return '-'
  }
  const withoutPrefix = normalizedKey.replace(/^scum\./i, '')
  return withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
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
      summary: `${route.title} 当前无法连接到服务会话，通常是插件运行时、执行端或桥接会话尚未恢复。`,
      nextAction: '请先刷新服务器状态；如果仍未恢复，请让具备管理权限的协作者修复服务或重启插件运行时。',
      code,
      message
    }
  }
  if (code === 'unauthorized' || /platform session expired/i.test(message)) {
    return {
      state: 'denied' as const,
      reasonCode: 'platform_session_expired',
      summary: '平台登录状态已过期，当前无法继续访问这个页面。',
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
  if (envelope.state === 'available' && envelope.summary) {
    return envelope.summary
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
