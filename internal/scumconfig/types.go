package scumconfig

// SettingsPath 是 SCUM 服务端配置文件在实例作用域内的相对路径。
const SettingsPath = "SCUM/Saved/Config/WindowsServer/ServerSettings.ini"

// Document 表示解析后的 ServerSettings.ini 文档。
type Document struct {
	// Sections 是按文件顺序解析出的配置分组。
	Sections []Section `json:"sections"`
}

// Section 表示 INI 文件中的一个配置分组。
type Section struct {
	// Name 是分组名称，不包含方括号。
	Name string `json:"name"`
	// Entries 是该分组下按文件顺序解析出的键值项。
	Entries []Entry `json:"entries"`
}

// Entry 表示 INI 分组中的一个键值配置。
type Entry struct {
	// Key 是配置键名称。
	Key string `json:"key"`
	// Value 是配置键对应的原始字符串值。
	Value string `json:"value"`
}

// FieldDefinition 表示前端可展示的结构化配置字段定义。
type FieldDefinition struct {
	// Section 是字段所属的配置分组名称。
	Section string `json:"section"`
	// Key 是字段对应的配置键名称。
	Key string `json:"key"`
	// Label 是前端展示使用的中文标签。
	Label string `json:"label"`
	// Validator 是给前端展示的校验规则摘要。
	Validator string `json:"validator"`
	// Sensitive 表示该字段是否包含敏感值。
	Sensitive bool `json:"sensitive"`
}

// ReadRequest 表示 SCUM 配置读取命令请求。
type ReadRequest struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
}

// ReadResponse 表示 SCUM 配置读取命令响应。
type ReadResponse struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Path 是实例作用域内的配置文件相对路径。
	Path string `json:"path"`
	// Checksum 是 core/host agent 返回的配置文件版本校验和。
	Checksum string `json:"checksum"`
	// Document 是结构化后的配置内容。
	Document Document `json:"document"`
}

// FileReadResult 表示 core 返回给插件的受控文件读取结果。
type FileReadResult struct {
	// Path 是实例作用域内的文件相对路径。
	Path string `json:"path"`
	// Checksum 是读取到的文件版本校验和。
	Checksum string `json:"checksum"`
	// Content 是文件文本内容。
	Content string `json:"content"`
}

// PatchRequest 表示 SCUM 配置 diff 更新命令请求。
type PatchRequest struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// ExpectedChecksum 是调用方读取配置时看到的文件校验和。
	ExpectedChecksum string `json:"expectedChecksum"`
	// Changes 是请求修改的配置键列表。
	Changes []Change `json:"changes"`
}

// PatchPlan 表示插件验证后的配置 patch 计划。
type PatchPlan struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Path 是实例作用域内的配置文件相对路径。
	Path string `json:"path"`
	// ExpectedChecksum 是写入前必须匹配的文件校验和。
	ExpectedChecksum string `json:"expectedChecksum"`
	// Changes 是已经过验证的配置修改列表。
	Changes []Change `json:"changes"`
	// Summary 是可用于审计和变更预览的短摘要。
	Summary string `json:"summary"`
}

// PatchResponse 表示 SCUM 配置 diff 更新命令响应。
type PatchResponse struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Path 是实例作用域内的配置文件相对路径。
	Path string `json:"path"`
	// ExpectedChecksum 是请求使用的旧文件校验和。
	ExpectedChecksum string `json:"expectedChecksum"`
	// OperationID 是 core 创建的文件操作 ID。
	OperationID string `json:"operationId"`
	// ChangeSetID 是 core 创建或复用的文件变更集 ID。
	ChangeSetID string `json:"changeSetId,omitempty"`
	// Status 是文件操作状态，例如 pending、succeeded、conflict 或 failed。
	Status string `json:"status"`
	// AfterChecksum 是写入成功后的新文件校验和。
	AfterChecksum string `json:"afterChecksum,omitempty"`
}

// Change 表示一个 SCUM 配置键修改。
type Change struct {
	// Section 是配置分组名称。
	Section string `json:"section"`
	// Key 是配置键名称。
	Key string `json:"key"`
	// Value 是要写入的配置值。
	Value string `json:"value"`
}

// ValidationError 表示配置请求验证错误。
type ValidationError struct {
	// Field 是出错字段路径。
	Field string `json:"field"`
	// Code 是稳定错误码。
	Code string `json:"code"`
	// Message 是可返回给调用方的错误摘要。
	Message string `json:"message"`
}
