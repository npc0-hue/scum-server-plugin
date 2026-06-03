package scumdb

// DefaultDatabaseRef 是 SCUM 插件请求 core 查询的数据库引用名。
const DefaultDatabaseRef = "scum-main"

// QueryRequest 表示 SCUM.db 查询命令请求。
type QueryRequest struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Template 是可选的预定义查询模板键。
	Template string `json:"template,omitempty"`
	// SQL 是可选的临时只读 SQL；生产策略可禁用该字段。
	SQL string `json:"sql,omitempty"`
	// Args 是 SQL 位置参数。
	Args []any `json:"args,omitempty"`
	// Limit 是调用方请求的最大返回行数。
	Limit int `json:"limit,omitempty"`
}

// QueryPlan 表示通过验证后的 SCUM.db 查询计划。
type QueryPlan struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// DatabaseRef 是 core 内部解析的数据库引用名，不是宿主路径。
	DatabaseRef string `json:"databaseRef"`
	// Template 是使用的预定义查询模板键。
	Template string `json:"template,omitempty"`
	// SQL 是通过验证的只读 SQL。
	SQL string `json:"sql"`
	// Args 是 SQL 位置参数。
	Args []any `json:"args,omitempty"`
	// MaxRows 是本次查询允许的最大行数。
	MaxRows int `json:"maxRows"`
	// MaxBytes 是本次查询允许的最大响应字节数。
	MaxBytes int `json:"maxBytes"`
	// TimeoutMS 是本次查询允许的超时时间毫秒数。
	TimeoutMS int `json:"timeoutMs"`
	// Summary 是可用于审计的脱敏 SQL 摘要。
	Summary string `json:"summary"`
}

// QueryResponse 表示 SCUM.db 查询命令响应。
type QueryResponse struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Template 是使用的预定义查询模板键。
	Template string `json:"template,omitempty"`
	// Columns 是结果列名。
	Columns []Column `json:"columns"`
	// Rows 是结构化结果行。
	Rows []Row `json:"rows"`
	// RowCount 是返回的行数。
	RowCount int `json:"rowCount"`
	// Truncated 表示结果是否被限制截断。
	Truncated bool `json:"truncated"`
	// TruncatedBy 是触发截断的限制类型。
	TruncatedBy string `json:"truncatedBy,omitempty"`
	// DurationMS 是执行耗时毫秒数。
	DurationMS int64 `json:"durationMs"`
}

// Column 表示 SCUM.db 查询结果中的一个列。
type Column struct {
	// Name 是列名。
	Name string `json:"name"`
}

// Row 表示 SCUM.db 查询结果中的一行。
type Row struct {
	// Values 是按列名组织的单行值。
	Values map[string]any `json:"values"`
}

// ValidationError 表示 SCUM.db 查询验证错误。
type ValidationError struct {
	// Field 是出错字段路径。
	Field string `json:"field"`
	// Code 是稳定错误码。
	Code string `json:"code"`
	// Message 是可返回给调用方的错误摘要。
	Message string `json:"message"`
}
