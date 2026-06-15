# SCUM Workflow Migration Matrix

`scum_new_web` is a read-only migration reference. New SCUM management UI,
resources, schemas, constants, and route metadata target
`plugins/scum-admin/frontend`; platform hosting and selected-server context stay in
`scum_web`; generic capability dispatch and instance readiness stay in
`scum_server`.

## Owner Classes

- `scum_server core`: generic instance, auth, audit, plugin gateway, capability,
  readiness, and operation boundaries.
- `plugins/scum-admin backend`: SCUM route planning, permission contracts, safe
  result envelopes, and plugin-owned domain API behavior.
- `plugins/scum-admin/frontend`: SCUM pages, labels, schemas, constants, images,
  maps, and unavailable states.
- `scum_web shell`: normal server entry, controlled plugin route host, selected
  server context, and role-gated diagnostics.
- `deferred`: old workflow recorded but not exposed as a normal usable route yet.

## Matrix

| Domain | Old backend baseline | Old frontend reference | New owner | Target route or resource | Status | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Server management | `scum_robot/router/server.go`, `api/v1/server.go`, `server/server_manage.go` for list/detail/create/update/admin invite/token | `scum_new_web/src/views/server/List.vue`, `src/api/server.ts`, `ServerForm.vue`, `ServerControlTable.vue` | `scum_server core`, `scum_web shell` | `/api/v1/server-instances`, `scum_web/src/views/instances/*`, plugin host links | partially migrated | `scum_web` tests cover selected server context, plugin host route builder, service-first readiness, and no copied SCUM pages |
| SCUM config | `api/v1/server.go` config handlers, auth file config helpers | `ScumConfigModal.vue`, `src/api/server.ts`, file editor components | `plugins/scum-admin backend`, `plugins/scum-admin/frontend`, `scum_server core` | `settings`, `scum.config.read`, `scum.config.patch`, `file.read`, `file.patch`, `src/resources/config-schema.json` | migrated first tranche | Frontend route renders editable fields/diff states; plugin backend returns safe result/unavailable envelopes; SCUM slice dispatches file plans through core |
| Database views | `api/v1/scum_run_control.go`, `api/v1/run.go`, `server/user.go`, `server/vehicles.go`, `server/area.go`, `server/squad.go` | `DatabaseQueryPanel.vue`, player/list and server database panels | `plugins/scum-admin backend`, `scum_server core` | `database/query`, players and other read routes via `db.query` | partially migrated | Planner covers route specs and read-only templates; database capability tests prove bounded agent-side execution |
| Players | `router/user.go`, `api/v1/user.go`, `server/user.go`, `server/send/send.go` for list, profile, track, duplicate IP, login history, skills, assets, body status, gifts | `src/views/player/List.vue`, `Trajectory.vue`, `src/api/player.ts`, `src/api/user.ts`, `TrackMap.vue` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `players`, `players/action`, `scum.players.read`, `scum.players.mutate` | migrated first tranche for read surface; actions deferred | Frontend table/search/denied/unavailable states; backend read route returns domain envelope and mutation route requires confirmation |
| Vehicles | `router/server.go` vehicle list, `server/vehicles.go`, related send/admin command services | Vehicle selectors in server/player actions | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `vehicles`, `vehicles/action`, `scum.vehicles.*` | not migrated | Route catalog marks not migrated; plugin UI shows unavailable state instead of raw plan JSON |
| Territories and area | `router/server.go` area routes, `api/v1/area.go`, `api/v1/squad.go`, `server/area.go`, `server/squad.go` | `AreaManage.vue`, `AreaFormModal.vue`, `src/constants/area.ts`, `TrackMap.vue` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `territories`, `territories/action`, map resources under plugin assets | not migrated | Matrix records plugin ownership; shell boundary test prevents map/constants copying into `scum_web` |
| Locks and unlock | `router/unlock.go`, `api/v1/unlock.go`, `api/v1/run.go`, `api/v1/send.go` | `src/views/unlock/Index.vue` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `locks`, `locks/action`, `scum.locks.*` | not migrated | Route catalog unavailable metadata and backend route planner coverage |
| Gifts | `router/gift.go`, `api/v1/gift.go`, `server/gift.go`, send service | `src/views/gift/Index.vue`, gift modals, `src/api/gift.ts` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `gifts`, `gifts/action`, plugin item resources | not migrated | High-risk route requires confirmation and returns safe operation handle envelope |
| Events | `router/event.go`, `api/v1/event.go`, `server/event.go` | `EventManage.vue`, event detail/form/produce modals, `src/api/event.ts` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | `events`, `events/action` | not migrated | Manifest/catalog/backend route consistency tests |
| Economy and trade goods | `router/trade_goods.go`, `api/v1/trade_goods.go`, `server/trade_goods.go` | `TradeGoodsSelector.vue`, `src/constants/trade-goods.ts`, `src/api/trade-goods.ts`, item images | `plugins/scum-admin/frontend`, `plugins/scum-admin backend` | `economy`, `economy/action`, `src/resources/trade-goods.json`, `public/assets/items/` | not migrated | Frontend metadata and catalog tests prove plugin-owned constants/assets |
| Logs and monitor logs | `router/log.go`, `api/v1/log.go`, `router/monitor.go`, `api/v1/monitor.go`, `performance_monitor.go` | `src/views/logs/Index.vue`, monitor components | `plugins/scum-admin backend`, `plugins/scum-admin/frontend`, `scum_server core` | `logs`, `scum.logs.read`, `log.read` | migrated first tranche as bounded log request UI; execution pending stable unavailable | Frontend route renders bounded controls and redacted output states; backend response avoids raw plan as primary UI |
| Steam and update | `api/v1/proxy.go` Steam news, `api/v1/scum_run_control.go` update/install/control/status, executor generator | `ScumInstallModal.vue`, `ScumRunClientList.vue`, update/status copy | `plugins/scum-admin backend`, `plugins/scum-admin/frontend`, `scum_server core` | `steam/news`, `update/install`, `update/server`, `steamcmd.update` | update migrated first tranche; Steam news deferred | Frontend update page returns operation handle states; mutation routes require confirmation |
| Restart and run control | `api/v1/scum_run_control.go`, `api/v1/scum_run_ws.go`, `server/server_manage.go` | `ImmediateRestartModal.vue`, `ScheduledRestartManageModal.vue`, `ServerControlTable.vue` | `plugins/scum-admin backend`, `plugins/scum-admin/frontend`, `scum_server core` | `server/restart`, `tasks`, `process.control`, `task.run`, `task.query` | migrated first tranche for update/restart/tasks entry | Backend operation envelopes and frontend confirmation/status-polling entry |
| File management | `router/file_management.go`, `api/v1/file_management.go`, `api/v1/file_edit.go`, auth file helpers | `FileManager.vue`, `FileList.vue`, `CompactFileList.vue`, `FileEditor.vue`, `ServerTerminal.vue` | `scum_server core`, `plugins/scum-admin/frontend` | generic file capability plus SCUM settings/log workflows | partially migrated | File capability tests and settings/logs first-tranche routes; full file browser deferred |
| Backup and restore | `router/backup.go`, `api/v1/backup_management.go`, `service/backup_management.go`, cloud storage service | `BackupManageModal.vue`, `BackupManager.vue`, `BackupManagerModal.vue`, `src/api/backup*.ts` | `scum_server core`, deferred plugin evidence UI | operation/evidence services; optional SCUM plugin backup settings later | deferred | Core operations/backup tests; matrix marks no first-tranche plugin UI yet |
| Admin commands | `router/admin.go`, `api/v1/admin.go`, command/send services | `AdminCommands.vue`, item selector resources | `plugins/scum-admin backend`, `plugins/scum-admin/frontend` | future admin-command and item workflows | deferred | Plugin resources already own item images/constants; route not exposed as usable |
| Security | `router/security.go`, `api/v1/security.go`, `service/security.go` | system/security admin references | `scum_server core`, deferred plugin diagnostics | RBAC/audit/security summaries | deferred | Core auth/audit tests; no SCUM business page in `scum_web` |
| Provider/proxy/system | `router/provider.go`, `router/proxy.go`, `router/system_settings.go`, corresponding API/service files | `src/views/system/*`, `src/api/system.ts` | `scum_server core` for platform settings; deferred SCUM plugin where domain-specific | platform/system APIs, no SCUM shell page | deferred | Boundary tests prevent direct SCUM platform pages in `scum_web` |
| Executor/client/system agents | `router/executor.go`, `api/v1/executor_generator.go`, `client_status.go`, `scum_client_ws.go`, `terminal_ws.go` | `src/api/executor.ts`, client and operations views | `scum_server core`, role-gated diagnostics | host/execution agent, plugin runtime, operations evidence | partially migrated | Diagnostics remain secondary/role-gated in `scum_web`; fleet/runtime tests cover platform internals |
| MCP and automation | `router/mcp.go`, `api/v1/mcp.go` | no first-tranche user page | `scum_server core`, deferred plugin tooling | platform automation/gateway only | deferred | Not a normal SCUM management route in this tranche |

## Guardrails

- No row targets implementation in `scum_new_web`; every old frontend path is a
  reference-only baseline.
- New SCUM pages, constants, images, maps, schemas, and route catalogs must land
  in `plugins/scum-admin/frontend`.
- `scum_web` may add only generic shell, selected-server context, controlled route
  host, authorization, and safe fallback state support.
- Migrated plugin routes must show domain UI, a useful result, an operation
  handle, or a stable unavailable state; raw capability-plan JSON is diagnostic
  only.

## Verification Notes

- Plugin backend: `go test ./internal/...` from `plugins/scum-admin`.
- Plugin frontend: `npm test`, `npm run typecheck`, and `npm run build` from
  `plugins/scum-admin/frontend`.
- Platform shell: `npm run verify` from `scum_web`; Vite still reports the
  existing large chunk warning.
- Core platform: `go test ./internal/service -run
  'TestSCUMSlice|TestWebShellPluginLoader|TestPluginAPIGateway|TestServerInstanceService'
  -count=1`, `go test ./internal/httpapi -run
  'TestWebShellPluginLoader|TestPluginAPIGateway|TestServer|TestPlatformCapabilityReadiness'
  -count=1`, and `go test ./internal/manifest -count=1` from `scum_server`.
- Browser smoke: local mock shell verified `scum_web` login/dashboard to
  `我的服务器`, server detail tool readiness, and hosted `SCUM 配置` plugin UI
  with selected instance context. The smoke uncovered and fixed plugin relative
  asset URLs, bridge-before-API initialization, route-keyed iframe URLs, and
  JSON-serializable bridge payloads; Browser policy stopped additional direct
  `127.0.0.1` route repetition after the settings route, while automated shell
  route tests cover the remaining first-tranche route contracts.
