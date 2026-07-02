package scumfiles

// ConfigDirectoryPath 是 SCUM WindowsServer 配置目录的实例相对路径。
const ConfigDirectoryPath = "SCUM/Saved/Config/WindowsServer"

// LogsDirectoryPath 是 SCUM 游戏日志目录的实例相对路径。
const LogsDirectoryPath = "SCUM/Saved/SaveFiles/Logs"

// ConfigWorkspace 表示一个插件拥有的文件目录入口。
type ConfigWorkspace struct {
	// Key 是目录入口的稳定标识。
	Key string `json:"key"`
	// Title 是前端展示使用的中文名称。
	Title string `json:"title"`
	// DirectoryPath 是实例作用域内的目录相对路径。
	DirectoryPath string `json:"directoryPath"`
	// SupportedFiles 是该目录下允许优先展示和读取的文件相对路径列表。
	SupportedFiles []string `json:"supportedFiles"`
	// DefaultFilePath 是优先读取的默认文件路径。
	DefaultFilePath string `json:"defaultFilePath"`
	// Summary 是给前端展示的目录摘要。
	Summary string `json:"summary"`
}

var windowsServerConfigFileNames = []string{
	"AdminUsers.ini",
	"BannedUsers.ini",
	"EconomyOverride.json",
	"ExclusiveUsers.ini",
	"GameUserSettings.ini",
	"Input.ini",
	"Input.ini.bak",
	"Notifications.json",
	"RaidTimes.json",
	"ServerSettings.ini",
	"ServerSettingsAdminUsers.ini",
	"SilencedUsers.ini",
	"WhitelistedUsers.ini",
}

var configFileDescriptions = map[string]string{
	"AdminUsers.ini":               "管理员白名单，控制哪些玩家拥有服务端管理权限。",
	"BannedUsers.ini":              "封禁名单，记录被禁止进入服务器的玩家。",
	"EconomyOverride.json":         "经济系统覆盖配置，用于调整商店、价格和经济产出规则。",
	"ExclusiveUsers.ini":           "专属访问名单，用于限制只有指定用户可以进入服务器。",
	"GameUserSettings.ini":         "游戏客户端/服务端通用设置覆盖文件，通常用于补充基础图形或输入类配置。",
	"Input.ini":                    "输入映射配置文件，用于自定义按键或控制绑定。",
	"Input.ini.bak":                "输入映射备份文件，用于回滚之前的输入配置。",
	"Notifications.json":           "通知消息配置，用于控制公告、提示和推送类内容。",
	"RaidTimes.json":               "攻防时间配置，用于限制或安排可攻击时段。",
	"ServerSettings.ini":           "服务器核心配置文件，包含人数、视角、聊天、僵尸和玩法等主要设置。",
	"ServerSettingsAdminUsers.ini": "服务器管理员配置补充文件，用于维护管理员相关设置。",
	"SilencedUsers.ini":            "禁言名单，记录被限制聊天的玩家。",
	"WhitelistedUsers.ini":         "白名单配置，控制允许进入服务器的玩家列表。",
}

var preferredLogFileNames = []string{
	"admin.log",
	"chat.log",
	"economy.log",
	"event_kill.log",
	"famepoints.log",
	"gameplay.log",
	"kill.log",
	"login.log",
	"violations.log",
	"vehicle_destruction.log",
}

var preferredLogFilePaths = configFilePaths(LogsDirectoryPath, preferredLogFileNames)

// LogWorkspace 表示一个插件拥有的日志目录入口。
type LogWorkspace struct {
	// Key 是目录入口的稳定标识。
	Key string `json:"key"`
	// Title 是前端展示使用的中文名称。
	Title string `json:"title"`
	// DirectoryPath 是实例作用域内的目录相对路径。
	DirectoryPath string `json:"directoryPath"`
	// PreferredFiles 是前端优先展示的日志文件名列表。
	PreferredFiles []string `json:"preferredFiles"`
	// Summary 是给前端展示的目录摘要。
	Summary string `json:"summary"`
}

// ConfigWorkspaces returns the plugin-owned file directory entrypoints shown from the settings route.
// It takes no parameters and returns the stable workspace list used by the SCUM admin frontend settings page.
func ConfigWorkspaces() []ConfigWorkspace {
	return []ConfigWorkspace{{
		Key:             "windows-server",
		Title:           "SCUM/Saved/Config/WindowsServer",
		DirectoryPath:   ConfigDirectoryPath,
		SupportedFiles:  configFilePaths(ConfigDirectoryPath, windowsServerConfigFileNames),
		DefaultFilePath: ConfigDirectoryPath + "/ServerSettings.ini",
		Summary:         "读取并编辑常用配置文件。",
	}}
}

// BrowseWorkspaces returns the directory choices shown on the shared settings and logs page.
// It takes no parameters, and returns the stable directory list for browsing config and log files.
func BrowseWorkspaces() []ConfigWorkspace {
	return []ConfigWorkspace{
		{
			Key:             "windows-server",
			Title:           "SCUM/Saved/Config/WindowsServer",
			DirectoryPath:   ConfigDirectoryPath,
			SupportedFiles:  configFilePaths(ConfigDirectoryPath, windowsServerConfigFileNames),
			DefaultFilePath: ConfigDirectoryPath + "/ServerSettings.ini",
			Summary:         "读取并编辑常用配置文件。",
		},
		{
			Key:             "game-logs",
			Title:           "SCUM/Saved/SaveFiles/Logs",
			DirectoryPath:   LogsDirectoryPath,
			SupportedFiles:  preferredLogFilePaths,
			DefaultFilePath: LogsDirectoryPath + "/gameplay.log",
			Summary:         "读取常用日志文件。",
		},
	}
}

// SupportedConfigFiles 返回插件支持读取的稳定配置文件相对路径列表。
// 它不接收参数，返回 WindowsServer 配置目录下允许优先展示和读取的文件路径。
func SupportedConfigFiles() []string {
	return configFilePaths(ConfigDirectoryPath, windowsServerConfigFileNames)
}

// ConfigFileDescriptions returns the human-readable descriptions for WindowsServer config files.
// It takes no parameters, and returns a filename-to-description map for frontend file guidance.
func ConfigFileDescriptions() map[string]string {
	descriptions := make(map[string]string, len(configFileDescriptions))
	for fileName, summary := range configFileDescriptions {
		descriptions[fileName] = summary
		descriptions[ConfigDirectoryPath+"/"+fileName] = summary
	}
	return descriptions
}

// configFilePaths builds stable relative paths for one configuration directory.
// directoryPath is the instance-scoped directory path, fileNames is the supported file name list, and the function returns joined relative paths for capability reads.
func configFilePaths(directoryPath string, fileNames []string) []string {
	paths := make([]string, 0, len(fileNames))
	for _, fileName := range fileNames {
		paths = append(paths, directoryPath+"/"+fileName)
	}
	return paths
}

// LogWorkspaces returns the plugin-owned log directory entrypoints.
// It takes no parameters and returns the stable log workspace list used by the SCUM admin frontend.
func LogWorkspaces() []LogWorkspace {
	return []LogWorkspace{{
		Key:            "game-logs",
		Title:          "日志文件",
		DirectoryPath:  LogsDirectoryPath,
		PreferredFiles: preferredLogFileNames,
		Summary:        "读取常用日志文件。",
	}}
}
