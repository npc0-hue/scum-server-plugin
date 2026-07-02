export type FileListEntry = {
  name: string
  relativePath: string
  directory?: boolean
  sizeBytes?: number
  modifiedAt?: string
}

export type FileDescriptionMap = Record<string, string>

export type FileSelectOption = {
  label: string
  value: string
}

const preferredLogFilePrefixes = [
  'admin',
  'chat',
  'economy',
  'event_kill',
  'famepoints',
  'gameplay',
  'kill',
  'login',
  'violations',
  'vehicle_destruction'
]

const defaultLogFileDescription = '日志文件，用于查看服务器运行、聊天、经济和事件记录。'
const defaultConfigFileDescriptions: FileDescriptionMap = {
  'AdminUsers.ini': '管理员白名单，控制哪些玩家拥有服务端管理权限。',
  'BannedUsers.ini': '封禁名单，记录被禁止进入服务器的玩家。',
  'EconomyOverride.json': '经济系统覆盖配置，用于调整商店、价格和经济产出规则。',
  'ExclusiveUsers.ini': '专属访问名单，用于限制只有指定用户可以进入服务器。',
  'GameUserSettings.ini': '游戏客户端/服务端通用设置覆盖文件，通常用于补充基础图形或输入类配置。',
  'Input.ini': '输入映射配置文件，用于自定义按键或控制绑定。',
  'Input.ini.bak': '输入映射备份文件，用于回滚之前的输入配置。',
  'Notifications.json': '通知消息配置，用于控制公告、提示和推送类内容。',
  'RaidTimes.json': '攻防时间配置，用于限制或安排可攻击时段。',
  'ServerSettings.ini': '服务器核心配置文件，包含人数、视角、聊天、僵尸和玩法等主要设置。',
  'ServerSettingsAdminUsers.ini': '服务器管理员配置补充文件，用于维护管理员相关设置。',
  'SilencedUsers.ini': '禁言名单，记录被限制聊天的玩家。',
  'WhitelistedUsers.ini': '白名单配置，控制允许进入服务器的玩家列表。'
}

// normalizeRelativePath normalizes one plugin-scoped relative path for case-insensitive matching.
// path is the relative path or file name to normalize.
// It returns a slash-normalized trimmed path string.
export const normalizeRelativePath = (path: string) => String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim()

// fileNameFromPath extracts the terminal file name from one relative path.
// path is the plugin-scoped relative path or bare file name.
// It returns the last non-empty path segment, or an empty string when unavailable.
export const fileNameFromPath = (path: string) => {
  const normalizedPath = normalizeRelativePath(path)
  if (!normalizedPath) {
    return ''
  }
  const segments = normalizedPath.split('/')
  return segments[segments.length - 1] || ''
}

// modifiedAtValue parses one modified-at timestamp for stable descending sort comparisons.
// value is the optional ISO-like modified timestamp returned by file capabilities.
// It returns the parsed epoch milliseconds, or 0 when parsing fails.
export const modifiedAtValue = (value?: string) => {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

// buildFileOptionLabel builds one user-facing file selector label with optional description text.
// entry is the current file option, fileDescriptions maps known files to summaries, and isLogWorkspace marks the log selector mode.
// It returns "文件名 - 说明" when a description exists, or the plain file name when no description is available.
export const buildFileOptionLabel = (entry: FileListEntry, fileDescriptions: FileDescriptionMap, isLogWorkspace: boolean) => {
  const fileName = entry.name || fileNameFromPath(entry.relativePath)
  if (isLogWorkspace) {
    return fileName
  }
  const description = resolveFileDescription(entry, fileDescriptions, isLogWorkspace)
  return description ? `${fileName} - ${description}` : fileName
}

// buildFileSelectOptions converts ordered file entries into host-safe select options.
// entries is the ordered file list, fileDescriptions maps known file descriptions, and isLogWorkspace marks log mode.
// It returns select options preserving the incoming order for UI rendering and host toolbar publication.
export const buildFileSelectOptions = (entries: FileListEntry[], fileDescriptions: FileDescriptionMap, isLogWorkspace: boolean): FileSelectOption[] =>
  entries.map((entry) => ({
    label: buildFileOptionLabel(entry, fileDescriptions, isLogWorkspace),
    value: entry.relativePath
  }))

// filterFileEntriesByQuery filters one ordered file list by name-first fuzzy matching.
// entries is the current ordered directory file list, query is the raw search string, fileDescriptions maps optional summaries, and isLogWorkspace marks log mode.
// It returns the matching entries while preserving the original order. It never throws and returns the full list for blank queries.
export const filterFileEntriesByQuery = (entries: FileListEntry[], query: string, fileDescriptions: FileDescriptionMap, isLogWorkspace: boolean) => {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return entries
  }
  return entries.filter((entry) => {
    const fileName = (entry.name || fileNameFromPath(entry.relativePath)).toLowerCase()
    if (fileName.includes(normalizedQuery)) {
      return true
    }
    return buildFileOptionLabel(entry, fileDescriptions, isLogWorkspace).toLowerCase().includes(normalizedQuery)
  })
}

// prioritizeFiles sorts config or log entries according to the SCUM plugin selector rules.
// entries is the raw filtered file list, preferredFiles is the supported/preferred file order, and preferNewest toggles log-style ordering.
// It returns a newly sorted array and leaves the input unmodified.
export const prioritizeFiles = (entries: FileListEntry[], preferredFiles: string[], preferNewest = false) => {
  if (preferNewest) {
    return [...entries].sort(compareLogEntries)
  }
  if (preferredFiles.length === 0) {
    return [...entries].sort((left, right) => left.name.localeCompare(right.name))
  }
  const priority = new Map<string, number>()
  preferredFiles.forEach((name, index) => {
    priority.set(normalizeRelativePath(name).toLowerCase(), index)
    priority.set(fileNameFromPath(name).toLowerCase(), index)
  })
  return [...entries].sort((left, right) => {
    const leftPriority = resolvePreferredFilePriority(left, priority, preferredFiles.length)
    const rightPriority = resolvePreferredFilePriority(right, priority, preferredFiles.length)
    if (leftPriority === rightPriority) {
      return left.name.localeCompare(right.name)
    }
    return leftPriority - rightPriority
  })
}

// compareEntriesByModifiedAtDesc sorts generic file entries by modification time descending.
// left and right are file entries from the same directory listing.
// It returns a negative number when left should appear earlier, or falls back to file name ordering for ties.
export const compareEntriesByModifiedAtDesc = (left: FileListEntry, right: FileListEntry) => {
  const leftTime = modifiedAtValue(left.modifiedAt)
  const rightTime = modifiedAtValue(right.modifiedAt)
  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }
  return left.name.localeCompare(right.name)
}

// resolvePreferredFilePriority resolves one config entry against the configured supported file order.
// entry is the file candidate, priority maps normalized paths and names to order indexes, and fallbackPriority is the group order for unmatched files.
// It returns the stable numeric priority used by config sorting.
export const resolvePreferredFilePriority = (entry: FileListEntry, priority: Map<string, number>, fallbackPriority: number) => {
  const normalizedPath = normalizeRelativePath(entry.relativePath).toLowerCase()
  const normalizedName = entry.name.toLowerCase()
  const directPriority = priority.get(normalizedPath) ?? priority.get(normalizedName)
  if (typeof directPriority === 'number') {
    return directPriority
  }
  for (const [candidate, value] of priority.entries()) {
    const candidateName = fileNameFromPath(candidate)
    const preferredStem = candidateName.replace(/\.[^.]+$/, '')
    if (preferredStem && (normalizedName === preferredStem || normalizedName.startsWith(`${preferredStem}_`) || normalizedName.startsWith(`${preferredStem}.`))) {
      return value
    }
  }
  return fallbackPriority + 1
}

// resolveFileDescription finds the display description for one file entry.
// entry is the current file, fileDescriptions maps known config descriptions, and isLogWorkspace toggles default log copy.
// It returns the matching description text, or an empty string when nothing should be shown.
export const resolveFileDescription = (entry: FileListEntry, fileDescriptions: FileDescriptionMap, isLogWorkspace: boolean) => {
  const normalizedPath = normalizeRelativePath(entry.relativePath)
  const fileName = entry.name || fileNameFromPath(normalizedPath)
  return fileDescriptions[normalizedPath]
    || fileDescriptions[fileName]
    || defaultConfigFileDescriptions[fileName]
    || (isLogWorkspace ? defaultLogFileDescription : '')
}

const compareLogEntries = (left: FileListEntry, right: FileListEntry) => {
  const leftPriority = resolveLogPrefixPriority(left.name || fileNameFromPath(left.relativePath))
  const rightPriority = resolveLogPrefixPriority(right.name || fileNameFromPath(right.relativePath))
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }
  return compareEntriesByModifiedAtDesc(left, right)
}

const resolveLogPrefixPriority = (fileName: string) => {
  const normalizedName = String(fileName || '').trim().toLowerCase()
  const matchedIndex = preferredLogFilePrefixes.findIndex((prefix) => matchesLogPrefix(normalizedName, prefix))
  return matchedIndex >= 0 ? matchedIndex : preferredLogFilePrefixes.length
}

const matchesLogPrefix = (fileName: string, prefix: string) => {
  return fileName === `${prefix}.log`
    || fileName.startsWith(`${prefix}_`)
    || fileName.startsWith(`${prefix}.`)
    || fileName === prefix
}
