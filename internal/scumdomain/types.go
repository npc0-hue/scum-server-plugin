package scumdomain

// CapabilityPlan 表示插件提交给 core 的受控能力计划。
type CapabilityPlan struct {
	// ServerInstanceID 是计划作用的服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Domain 是 SCUM 业务域名称，例如 players、logs 或 update。
	Domain string `json:"domain"`
	// Capability 是需要 core 转发执行的能力键。
	Capability string `json:"capability"`
	// Operation 是能力内的操作名称。
	Operation string `json:"operation"`
	// Permission 是执行该计划前必须获得批准的插件权限键。
	Permission string `json:"permission"`
	// RiskLevel 是该计划的风险等级，用于权限 diff、二次确认和审计。
	RiskLevel string `json:"riskLevel"`
	// Route 是触发该计划的插件 API 路由。
	Route string `json:"route"`
	// Payload 是发送给 core 能力网关的有界载荷。
	Payload map[string]any `json:"payload"`
	// AuditSummary 是可写入审计日志的脱敏摘要。
	AuditSummary string `json:"auditSummary"`
	// SourceStrategy 是该路由声明的执行来源策略。
	SourceStrategy RouteSourceStrategy `json:"sourceStrategy,omitempty"`
}

// PlanRequest 表示构建 SCUM 域能力计划所需的请求上下文。
type PlanRequest struct {
	// Method 是插件 API HTTP 方法。
	Method string `json:"method"`
	// Route 是标准化后的插件 API 路由。
	Route string `json:"route"`
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// Body 是调用方提交的 JSON 对象请求体。
	Body map[string]any `json:"body,omitempty"`
	// Query 是调用方提交的查询参数。
	Query map[string][]string `json:"query,omitempty"`
}

// RouteSpec 表示一个插件 API 路由到 capability plan 的映射。
type RouteSpec struct {
	// Domain 是 SCUM 业务域名称。
	Domain string `json:"domain"`
	// Method 是该路由接受的 HTTP 方法。
	Method string `json:"method"`
	// Route 是插件 API 路由后缀。
	Route string `json:"route"`
	// Title 是前端菜单或诊断中展示的业务名称。
	Title string `json:"title"`
	// Capability 是路由需要 core 支持的能力键。
	Capability string `json:"capability"`
	// Operation 是能力内的操作名称。
	Operation string `json:"operation"`
	// Permission 是执行该路由需要的插件权限键。
	Permission string `json:"permission"`
	// RiskLevel 是路由权限风险等级。
	RiskLevel string `json:"riskLevel"`
	// Template 是读取类数据库路由使用的预定义查询模板。
	Template string `json:"template,omitempty"`
	// RequiresConfirmation 表示高危操作是否需要宿主侧二次确认。
	RequiresConfirmation bool `json:"requiresConfirmation,omitempty"`
	// Summary 是该路由的脱敏用途摘要。
	Summary string `json:"summary"`
	// SourceStrategy 是该路由声明的执行来源策略。
	SourceStrategy RouteSourceStrategy `json:"sourceStrategy,omitempty"`
}

// RouteSourceStrategy 表示一个 SCUM 路由的执行来源策略。
type RouteSourceStrategy struct {
	// Primary 是首选执行来源，例如 scum_run。
	Primary string `json:"primary,omitempty"`
	// Fallback 是可选补充来源标识；为空表示当前只声明单一路径。
	Fallback string `json:"fallback,omitempty"`
	// Summary 是给前端和核心展示的脱敏来源策略摘要。
	Summary string `json:"summary,omitempty"`
}

// ValidationError 表示 SCUM 域能力计划验证错误。
type ValidationError struct {
	// Field 是出错字段路径。
	Field string `json:"field"`
	// Code 是稳定错误码。
	Code string `json:"code"`
	// Message 是可返回给调用方的错误摘要。
	Message string `json:"message"`
}
