export type MigrationStatus = 'migrated' | 'partial' | 'not_migrated' | 'deferred'

export type RouteVisibility = 'normal' | 'direct' | 'hidden'

export type DomainRoute = {
  key: string
  title: string
  path: string
  method: 'GET' | 'PATCH' | 'POST'
  apiPath: string
  permissions: string[]
  capability: string
  riskLevel: 'low' | 'medium' | 'high'
  summary: string
  domainOwner: 'plugins/scum-admin backend' | 'plugins/scum-admin/frontend' | 'scum_server core' | 'scum_web shell' | 'deferred'
  migrationStatus: MigrationStatus
  visibility: RouteVisibility
  unavailable: {
    capability: string
    reasonCode: string
    summary: string
    nextAction: string
  }
}

const unavailable = (capability: string, reasonCode: string, summary: string, nextAction = '请刷新服务器状态，或联系具备管理权限的协作者处理。') => ({
  capability,
  reasonCode,
  summary,
  nextAction
})

export const firstTrancheRouteKeys = ['settings', 'players', 'trajectory-map', 'gifts', 'update', 'tasks']

export const domainRoutes: DomainRoute[] = [
  {
    key: 'settings',
    title: '配置',
    path: '/settings',
    method: 'GET',
    apiPath: 'settings',
    permissions: ['scum.config.read'],
    capability: 'file.read',
    riskLevel: 'medium',
    summary: '读取并编辑 ServerSettings.ini。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('file.read', 'file_capability_unavailable', '配置文件读取能力暂不可用。')
  },
  {
    key: 'database',
    title: '数据库视图',
    path: '/database',
    method: 'POST',
    apiPath: 'database/query',
    permissions: ['scum.database.query'],
    capability: 'db.query',
    riskLevel: 'medium',
    summary: '提交只读 SCUM.db 查询计划，由绑定 run 执行端返回有界结果。',
    domainOwner: 'plugins/scum-admin backend',
    migrationStatus: 'partial',
    visibility: 'direct',
    unavailable: unavailable('db.query', 'database_direct_only', '数据库视图已作为玩家等业务页的数据来源，独立查询页暂不作为日常入口。')
  },
  {
    key: 'players',
    title: '玩家',
    path: '/players',
    method: 'GET',
    apiPath: 'players',
    permissions: ['scum.players.read'],
    capability: 'local.players.read',
    riskLevel: 'medium',
    summary: '玩家列表、搜索、登录历史和权限感知操作入口。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('local.players.read', 'local_player_database_unavailable', '玩家数据需要平台本地玩家库可用。')
  },
  {
    key: 'trajectory-map',
    title: '轨迹地图',
    path: '/trajectory-map',
    method: 'GET',
    apiPath: 'map/timeline',
    permissions: ['scum.players.read', 'scum.vehicles.read'],
    capability: 'db.query',
    riskLevel: 'medium',
    summary: '查看玩家轨迹，并按时间切片查看载具和物资状态。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('db.query', 'map_timeline_unavailable', '轨迹地图需要绑定执行端或平台本地数据源提供时间线查询能力。')
  },
  {
    key: 'vehicles',
    title: '载具',
    path: '/vehicles',
    method: 'GET',
    apiPath: 'vehicles',
    permissions: ['scum.vehicles.read'],
    capability: 'db.query',
    riskLevel: 'medium',
    summary: '载具列表、归属和状态视图。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'partial',
    visibility: 'direct',
    unavailable: unavailable('db.query', 'database_capability_unavailable', '载具数据需要绑定执行端提供只读数据库能力。')
  },
  {
    key: 'territories',
    title: '领地',
    path: '/territories',
    method: 'GET',
    apiPath: 'territories',
    permissions: ['scum.territories.read'],
    capability: 'db.query',
    riskLevel: 'medium',
    summary: '领地、区域、小队和地图资源视图。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'partial',
    visibility: 'direct',
    unavailable: unavailable('db.query', 'database_capability_unavailable', '领地、区域和小队数据需要绑定执行端提供只读数据库能力。')
  },
  {
    key: 'locks',
    title: '开锁',
    path: '/locks',
    method: 'GET',
    apiPath: 'locks',
    permissions: ['scum.locks.read'],
    capability: 'db.query',
    riskLevel: 'medium',
    summary: '锁具和开锁记录视图。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'partial',
    visibility: 'direct',
    unavailable: unavailable('db.query', 'database_capability_unavailable', '锁具和开锁记录数据需要绑定执行端提供只读数据库能力。')
  },
  {
    key: 'gifts',
    title: '礼包',
    path: '/gifts',
    method: 'GET',
    apiPath: 'gifts',
    permissions: ['scum.gifts.read'],
    capability: 'task.query',
    riskLevel: 'medium',
    summary: '礼包规则、发放记录和统计。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('task.query', 'gift_management_unavailable', '礼包管理需要任务查询和本地礼包配置能力可用。')
  },
  {
    key: 'events',
    title: '事件',
    path: '/events',
    method: 'GET',
    apiPath: 'events',
    permissions: ['scum.events.read'],
    capability: 'task.query',
    riskLevel: 'medium',
    summary: '事件规则、活动配置和事件产物。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'not_migrated',
    visibility: 'direct',
    unavailable: unavailable('task.query', 'not_migrated', '事件管理仍在迁移，当前仅保留直接不可用页。')
  },
  {
    key: 'economy',
    title: '交易物品',
    path: '/economy',
    method: 'GET',
    apiPath: 'economy/items',
    permissions: ['scum.economy.read'],
    capability: 'artifact.read',
    riskLevel: 'low',
    summary: '交易物品常量、价格分类和插件自有图片资源。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'not_migrated',
    visibility: 'direct',
    unavailable: unavailable('artifact.read', 'not_migrated', '交易物品资源已归插件所有，经济管理页暂未迁移。')
  },
  {
    key: 'logs',
    title: '日志',
    path: '/logs',
    method: 'GET',
    apiPath: 'logs',
    permissions: ['scum.logs.read'],
    capability: 'file.read',
    riskLevel: 'medium',
    summary: '通过配置页切换到日志目录查看日志文件。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'direct',
    unavailable: unavailable('file.read', 'file_capability_unavailable', '日志读取需要绑定执行端提供文件目录与文件读取能力。')
  },
  {
    key: 'steam',
    title: 'Steam',
    path: '/steam',
    method: 'GET',
    apiPath: 'steam/news',
    permissions: ['scum.steam.read'],
    capability: 'steam.news',
    riskLevel: 'low',
    summary: 'Steam 新闻、版本元数据和发布提示。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'deferred',
    visibility: 'direct',
    unavailable: unavailable('steam.news', 'deferred', 'Steam 新闻和版本面板已记录但不属于首批日常管理入口。')
  },
  {
    key: 'update',
    title: '更新与重启',
    path: '/update',
    method: 'POST',
    apiPath: 'update/server',
    permissions: ['scum.update.mutate', 'scum.restart.mutate'],
    capability: 'steamcmd.update',
    riskLevel: 'high',
    summary: 'SteamCMD 安装、服务端更新和受控重启任务。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('steamcmd.update', 'update_capability_unavailable', '更新与重启需要可用的任务、进程和 SteamCMD 能力。')
  },
  {
    key: 'tasks',
    title: '任务',
    path: '/tasks',
    method: 'GET',
    apiPath: 'tasks',
    permissions: ['scum.tasks.read'],
    capability: 'task.query',
    riskLevel: 'medium',
    summary: 'SCUM 插件任务状态、结果摘要和稳定错误。',
    domainOwner: 'plugins/scum-admin/frontend',
    migrationStatus: 'migrated',
    visibility: 'normal',
    unavailable: unavailable('task.query', 'task_capability_unavailable', '任务列表需要任务状态查询能力。')
  }
]

export const migratedRouteKeys = domainRoutes.filter((route) => route.migrationStatus === 'migrated').map((route) => route.key)

export const normalToolRoutes = domainRoutes.filter((route) => route.visibility === 'normal')

export const resourceSummary = {
  configSchemas: ['resources/config-schema.json'],
  businessConstants: ['resources/trade-goods.json', 'resources/domainCatalog.ts'],
  assetIndex: 'resources/asset-index.json',
  itemImages: '/assets/items/',
  mapTiles: '/assets/maps/',
  icons: '/assets/icons/',
  legacySource: 'scum_new_web inventory only; no implementation targets that directory'
}

export const routeFor = (routeKey: string | undefined) =>
  domainRoutes.find((route) => route.key === routeKey) || domainRoutes[0]
