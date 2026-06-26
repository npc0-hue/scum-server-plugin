import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(new URL('.', import.meta.url).pathname, '..', '..')
const pluginRoot = path.resolve(frontendRoot, '..')
const catalogSource = fs.readFileSync(path.join(frontendRoot, 'src/resources/domainCatalog.ts'), 'utf8')
const mainSource = fs.readFileSync(path.join(frontendRoot, 'src/main.ts'), 'utf8')
const viteConfigSource = fs.readFileSync(path.join(frontendRoot, 'vite.config.ts'), 'utf8')
const inventorySource = fs.readFileSync(path.join(frontendRoot, 'metadata/migration_inventory.md'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'manifest.json'), 'utf8'))
const frontend = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'metadata/frontend.json'), 'utf8'))
const tradeGoods = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'src/resources/trade-goods.json'), 'utf8'))
const configSchema = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'src/resources/config-schema.json'), 'utf8'))
const assetIndex = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'src/resources/asset-index.json'), 'utf8'))

const routeKeys = ['settings', 'database', 'players', 'vehicles', 'territories', 'locks', 'gifts', 'events', 'economy', 'logs', 'steam', 'update', 'tasks']
const firstTrancheRouteKeys = ['settings', 'players', 'logs', 'update', 'tasks']
const partialDirectRouteKeys = ['database', 'vehicles', 'territories', 'locks']
const unavailableDirectRouteKeys = ['gifts', 'events', 'economy', 'steam']
const manifestRoutes = new Map(manifest.frontend.routes.map((route) => [route.key, route]))
const manifestMenus = new Map(manifest.frontend.menus.map((menu) => [menu.key, menu]))

for (const key of routeKeys) {
  assert.match(catalogSource, new RegExp(`key: '${key}'`), `domain catalog should include ${key}`)
  assert.equal(manifestRoutes.has(key), true, `manifest route should include ${key}`)
  assert.equal(frontend.ownedSurfaces.includes(key), true, `frontend metadata should own ${key}`)
  assert.match(catalogSource, new RegExp(`key: '${key}'[\\s\\S]*?migrationStatus:`), `${key} should declare migration status`)
  assert.match(catalogSource, new RegExp(`key: '${key}'[\\s\\S]*?domainOwner:`), `${key} should declare domain owner`)
  assert.match(catalogSource, new RegExp(`key: '${key}'[\\s\\S]*?unavailable:`), `${key} should declare unavailable state`)
  assert.ok(manifestRoutes.get(key).requiredPermissions.length >= 1, `${key} route should declare required permissions`)
  assert.ok(manifestRoutes.get(key).migrationStatus, `${key} manifest route should declare migration status`)
  assert.ok(manifestRoutes.get(key).domainOwner, `${key} manifest route should declare owner`)
}

for (const key of firstTrancheRouteKeys) {
  assert.equal(manifestMenus.has(key), true, `${key} should be advertised as a first-tranche menu`)
  assert.equal(manifestRoutes.get(key).migrationStatus, 'migrated', `${key} should be marked migrated`)
  assert.equal(manifestRoutes.get(key).visibility, 'normal', `${key} should be normal visible`)
  assert.ok(manifestMenus.get(key).requiredPermissions.length >= 1, `${key} menu should declare permissions`)
}

for (const key of partialDirectRouteKeys) {
  assert.equal(manifestMenus.has(key), false, `${key} should not be a normal menu before full migration`)
  assert.equal(manifestRoutes.get(key).visibility, 'direct', `${key} should remain directly addressable for partial-state rendering`)
  assert.equal(manifestRoutes.get(key).migrationStatus, 'partial', `${key} should be marked partial while detail workflows continue migrating`)
}

for (const key of unavailableDirectRouteKeys) {
  assert.equal(manifestMenus.has(key), false, `${key} should not be a normal menu before migration`)
  assert.equal(manifestRoutes.get(key).visibility, 'direct', `${key} should remain directly addressable for unavailable-state rendering`)
  assert.ok(['not_migrated', 'deferred'].includes(manifestRoutes.get(key).migrationStatus), `${key} should not be marked migrated`)
}

assert.deepEqual(manifestRoutes.get('update').requiredPermissions, ['scum.update.mutate', 'scum.restart.mutate'])
assert.equal(manifestRoutes.get('update').instanceScope.permission, 'manage')
assert.equal(manifestRoutes.get('settings').instanceScope.permission, 'read')
assert.equal(catalogSource.includes('firstTrancheRouteKeys'), true, 'route catalog should expose first tranche metadata')
assert.equal(catalogSource.includes('normalToolRoutes'), true, 'route catalog should expose normal tool routes')
assert.equal(tradeGoods.source, 'plugins/scum-admin/frontend')
assert.equal(configSchema.source, 'plugins/scum-admin/frontend')
assert.equal(frontend.resourceSummary.itemImages.ownedBy, 'scum-admin')
assert.equal(frontend.resourceSummary.mapTiles.ownedBy, 'scum-admin')
assert.equal(assetIndex.source, 'plugins/scum-admin/frontend')
assert.equal(assetIndex.itemImages.ownedBy, 'scum-admin')
assert.equal(assetIndex.mapTiles.ownedBy, 'scum-admin')
assert.equal(assetIndex.icons.ownedBy, 'scum-admin')

const itemFiles = fs.readdirSync(path.join(frontendRoot, 'public/assets/items')).filter((name) => imageResource(name))
const mapTiles = listFiles(path.join(frontendRoot, 'public/assets/maps')).filter((name) => imageResource(name))
assert.equal(itemFiles.length, assetIndex.itemImages.count)
assert.equal(mapTiles.length, assetIndex.mapTiles.count)

for (const sample of assetIndex.itemImages.samples) {
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/assets/items', sample)), true, `item sample should exist: ${sample}`)
}
for (const sample of assetIndex.mapTiles.samples) {
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/assets/maps', sample)), true, `map tile sample should exist: ${sample}`)
}
for (const sample of assetIndex.icons.samples) {
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/assets/icons', sample)), true, `icon sample should exist: ${sample}`)
}

for (const marker of ['renderSettingsPage', 'renderPlayersPage', 'renderLogsPage', 'renderUpdatePage', 'renderTasksPage']) {
  assert.equal(mainSource.includes(marker), true, `frontend shell should include ${marker}`)
}
for (const marker of ['settingsViewMode', 'data-settings-mode="structured"', '配置模式', '文件模式', 'defaultSettingsViewMode']) {
  assert.equal(mainSource.includes(marker), true, `settings route should default to explicit config mode marker: ${marker}`)
}
for (const marker of ['backdropImage', '--plugin-workspace-bg-image', 'has-backdrop']) {
  assert.equal(mainSource.includes(marker), true, `plugin theme bridge should preserve platform backdrop marker: ${marker}`)
}
for (const marker of ['normalizeWorkspaceEntries', 'normalizeRelativePath', 'sameRelativePath']) {
  assert.equal(mainSource.includes(marker), true, `file capability paths should stay normalized for mixed agent results: ${marker}`)
}
for (const marker of ['sourceSummary(envelope)', '数据来源', 'source.kind', 'source.mode']) {
  assert.equal(mainSource.includes(marker), true, `frontend shell should preserve SCUM read source summary marker: ${marker}`)
}
assert.equal(viteConfigSource.includes("base: './'"), true, 'plugin bundle must use relative asset URLs under /plugin-assets')
assert.ok(
  mainSource.indexOf('const context = await bridge.init()') < mainSource.indexOf('await renderRoute(renderState, renderState.route.key)'),
  'plugin bridge must initialize before route API rendering'
)
assert.equal(mainSource.includes('pluginVersionFromAssetURL(window.location.href)'), true, 'plugin bridge version should come from the served /plugin-assets namespace')
assert.equal(mainSource.includes("new ScumPluginBridge('scum-admin', '"), false, 'plugin bridge must not hard-code package version in handshake')
assert.equal(mainSource.includes('scum-admin-pre'), false, 'primary plugin UI must not be the old raw JSON demo panel')
assert.equal(mainSource.includes('capability-plan JSON'), false, 'primary plugin UI must not describe raw plan JSON as product UI')

for (const row of inventorySource.split('\n').filter((line) => line.startsWith('|') && line.includes('scum_new_web'))) {
  const cells = row.split('|').map((cell) => cell.trim())
  const newOwner = cells[4] || ''
  const target = cells[5] || ''
  assert.equal(newOwner.includes('scum_new_web') || target.includes('scum_new_web'), false, `inventory row targets deprecated frontend: ${row}`)
}

const changeTasks = fs.readFileSync(path.join(frontendRoot, '..', '..', '..', 'openspec/changes/realign-scum-platform-to-robot-workflows/tasks.md'), 'utf8')
for (const line of changeTasks.split('\n').filter((candidate) => candidate.includes('scum_new_web'))) {
  assert.match(line, /read-only|Inventory|inventory|reference|guard check/i, `OpenSpec task must not target scum_new_web implementation: ${line}`)
}

console.log('scum-admin frontend domain catalog ok')

function listFiles(root) {
  const output = []
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, item.name)
    if (item.isDirectory()) {
      output.push(...listFiles(fullPath))
      continue
    }
    output.push(fullPath)
  }
  return output
}

function imageResource(name) {
  return /\.(jpe?g|png|webp|svg)$/i.test(name)
}
