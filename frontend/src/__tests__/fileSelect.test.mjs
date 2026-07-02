import assert from 'node:assert/strict'
import {
  buildFileOptionLabel,
  buildFileSelectOptions,
  filterFileEntriesByQuery,
  prioritizeFiles
} from '../fileSelect.ts'

const configDescriptions = {
  'ServerSettings.ini': '服务器核心配置文件，包含人数、视角、聊天、僵尸和玩法等主要设置。',
  'AdminUsers.ini': '管理员白名单，控制哪些玩家拥有服务端管理权限。'
}

const configEntries = [
  {
    name: 'AdminUsers.ini',
    relativePath: 'SCUM/Saved/Config/WindowsServer/AdminUsers.ini'
  },
  {
    name: 'ServerSettings.ini',
    relativePath: 'SCUM/Saved/Config/WindowsServer/ServerSettings.ini'
  }
]

const sortedLogEntries = prioritizeFiles([
  {
    name: 'misc.log',
    relativePath: 'SCUM/Saved/SaveFiles/Logs/misc.log',
    modifiedAt: '2026-06-29T06:00:00.000Z'
  },
  {
    name: 'chat_2026-06-28.log',
    relativePath: 'SCUM/Saved/SaveFiles/Logs/chat_2026-06-28.log',
    modifiedAt: '2026-06-28T06:00:00.000Z'
  },
  {
    name: 'gameplay_2026-06-27.log',
    relativePath: 'SCUM/Saved/SaveFiles/Logs/gameplay_2026-06-27.log',
    modifiedAt: '2026-06-27T06:00:00.000Z'
  },
  {
    name: 'chat_2026-06-29.log',
    relativePath: 'SCUM/Saved/SaveFiles/Logs/chat_2026-06-29.log',
    modifiedAt: '2026-06-29T07:00:00.000Z'
  }
], [], true)

assert.equal(sortedLogEntries[0]?.name, 'chat_2026-06-29.log', 'newer chat logs should sort ahead of older same-prefix files')
assert.equal(sortedLogEntries[1]?.name, 'chat_2026-06-28.log', 'older chat logs should remain after newer same-prefix files')
assert.equal(sortedLogEntries[2]?.name, 'gameplay_2026-06-27.log', 'preferred gameplay prefix should sort ahead of non-priority logs')
assert.equal(sortedLogEntries[3]?.name, 'misc.log', 'non-priority logs should sort after preferred log prefixes')

assert.equal(
  buildFileOptionLabel(configEntries[1], configDescriptions, false),
  'ServerSettings.ini - 服务器核心配置文件，包含人数、视角、聊天、僵尸和玩法等主要设置。',
  'config file labels should include description text'
)
assert.equal(
  buildFileOptionLabel(configEntries[0], configDescriptions, false),
  'AdminUsers.ini - 管理员白名单，控制哪些玩家拥有服务端管理权限。',
  'known config file descriptions should appear in option labels'
)

const labeledOptions = buildFileSelectOptions(configEntries, configDescriptions, false)
assert.equal(labeledOptions[0]?.label.includes('管理员白名单'), true, 'generated options should carry config descriptions')

const filteredByName = filterFileEntriesByQuery(configEntries, 'server', configDescriptions, false)
assert.deepEqual(filteredByName.map((entry) => entry.name), ['ServerSettings.ini'], 'search should match file names case-insensitively')

const filteredByDescription = filterFileEntriesByQuery(configEntries, '管理权限', configDescriptions, false)
assert.deepEqual(filteredByDescription.map((entry) => entry.name), ['AdminUsers.ini'], 'search should also match description text')

console.log('file select checks passed')
