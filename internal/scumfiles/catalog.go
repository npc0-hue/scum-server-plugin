package scumfiles

// ConfigDirectoryPath 是 SCUM WindowsServer 配置目录的实例相对路径。
const ConfigDirectoryPath = "SCUM/Saved/Config/WindowsServer"

// LogsDirectoryPath 是 SCUM 游戏日志目录的实例相对路径。
const LogsDirectoryPath = "SCUM/Saved/SaveFiles/Logs"

// ConfigWorkspace 表示一个插件拥有的配置目录入口。
type ConfigWorkspace struct {
	// Key 是目录入口的稳定标识。
	Key string `json:"key"`
	// Title 是前端展示使用的中文名称。
	Title string `json:"title"`
	// DirectoryPath 是实例作用域内的目录相对路径。
	DirectoryPath string `json:"directoryPath"`
	// SupportedFiles 是该目录下允许优先展示和读取的 SCUM 配置文件相对路径列表。
	SupportedFiles []string `json:"supportedFiles"`
	// DefaultFilePath 是优先读取的默认配置文件路径。
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

// ConfigWorkspaces returns the plugin-owned configuration directory entrypoints.
// It takes no parameters and returns the stable configuration workspace list used by the SCUM admin frontend.
func ConfigWorkspaces() []ConfigWorkspace {
	return []ConfigWorkspace{{
		Key:             "windows-server",
		Title:           "WindowsServer 配置目录",
		DirectoryPath:   ConfigDirectoryPath,
		SupportedFiles:  configFilePaths(ConfigDirectoryPath, windowsServerConfigFileNames),
		DefaultFilePath: ConfigDirectoryPath + "/ServerSettings.ini",
		Summary:         "读取实例配置目录中的实际文件，并支持完整的 SCUM 常用配置文件集合。",
	}}
}

// SupportedConfigFiles 返回插件支持读取的稳定配置文件相对路径列表。
// 它不接收参数，返回 WindowsServer 配置目录下允许优先展示和读取的文件路径。
func SupportedConfigFiles() []string {
	return configFilePaths(ConfigDirectoryPath, windowsServerConfigFileNames)
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
		Key:           "game-logs",
		Title:         "SCUM 游戏日志目录",
		DirectoryPath: LogsDirectoryPath,
		PreferredFiles: []string{
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
		},
		Summary: "读取实例日志目录中的实际文件，并优先展示常见 SCUM 日志。",
	}}
}
