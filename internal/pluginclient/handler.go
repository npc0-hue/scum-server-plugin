package pluginclient

import (
	"encoding/json"
	"net/http"
	"strings"

	"scum_admin_plugin/internal/scumconfig"
	"scum_admin_plugin/internal/scumdb"
	"scum_admin_plugin/internal/scumdomain"
	"scum_admin_plugin/internal/scumfiles"
)

type domainSourceSummary struct {
	// Kind 是当前结果的执行端来源类型，例如 scum_run。
	Kind string `json:"kind"`
	// Mode 表示该来源是主执行端还是回退执行端。
	Mode string `json:"mode"`
	// Summary 是给前端展示的脱敏来源摘要。
	Summary string `json:"summary"`
	// Fallback 是声明的可选补充来源；为空表示当前仅支持单一来源。
	Fallback string `json:"fallback,omitempty"`
}

// CapabilityPlanResponse 表示插件请求 core 执行受控能力后的计划响应。
type CapabilityPlanResponse struct {
	// Capability 是请求 core 执行的能力键。
	Capability string `json:"capability"`
	// Operation 是能力内的操作名称。
	Operation string `json:"operation"`
	// Payload 是能力请求载荷。
	Payload any `json:"payload"`
}

// DomainAPIResponse 表示插件返回给前端的业务级响应。
type DomainAPIResponse struct {
	// Kind 是响应类别，例如 domain_result、operation_handle 或 unavailable。
	Kind string `json:"kind"`
	// State 是当前业务状态，例如 available、unavailable 或 pending_dispatch。
	State string `json:"state"`
	// Route 是触发响应的插件 API 路由。
	Route string `json:"route"`
	// Domain 是 SCUM 业务域名称。
	Domain string `json:"domain"`
	// Title 是前端可以展示的中文业务标题。
	Title string `json:"title"`
	// Summary 是脱敏业务摘要。
	Summary string `json:"summary"`
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId,omitempty"`
	// RequiredPermission 是执行该路由需要的插件权限键。
	RequiredPermission string `json:"requiredPermission,omitempty"`
	// RequiredCapability 是执行该路由需要的 core 能力键。
	RequiredCapability string `json:"requiredCapability,omitempty"`
	// Data 是读取类路由返回的业务数据或空状态。
	Data any `json:"data,omitempty"`
	// Operation 是高危或异步路由返回的操作句柄。
	Operation *DomainOperationHandle `json:"operation,omitempty"`
	// Unavailable 是不可用或阻塞状态的稳定说明。
	Unavailable *DomainUnavailableState `json:"unavailable,omitempty"`
	// DispatchPlan 是 core 内部继续执行能力时使用的计划，前端只可作为诊断证据。
	DispatchPlan *CapabilityPlanResponse `json:"dispatchPlan,omitempty"`
}

// DomainOperationHandle 表示插件提交的受治理操作句柄。
type DomainOperationHandle struct {
	// ID 是操作句柄 ID，用于后续状态查询。
	ID string `json:"id"`
	// Type 是操作类型，例如 update 或 restart。
	Type string `json:"type"`
	// Status 是操作当前状态。
	Status string `json:"status"`
	// Summary 是可展示的脱敏操作摘要。
	Summary string `json:"summary"`
	// PollPath 是前端可用于查询状态的插件 API 路径。
	PollPath string `json:"pollPath"`
	// RiskLevel 是该操作的风险等级。
	RiskLevel string `json:"riskLevel"`
	// RequiresConfirmation 表示创建该操作前是否要求显式确认。
	RequiresConfirmation bool `json:"requiresConfirmation"`
}

// DomainUnavailableState 表示插件业务路由的稳定不可用状态。
type DomainUnavailableState struct {
	// Code 是稳定错误码。
	Code string `json:"code"`
	// ReasonCode 是不可用原因码。
	ReasonCode string `json:"reasonCode"`
	// Summary 是可展示的脱敏原因摘要。
	Summary string `json:"summary"`
	// NextAction 是建议用户采取的下一步。
	NextAction string `json:"nextAction"`
	// Retryable 表示该状态是否可能通过刷新重试恢复。
	Retryable bool `json:"retryable"`
}

// ErrorResponse 表示插件返回给 core 网关的结构化错误。
type ErrorResponse struct {
	// Code 是稳定错误码。
	Code string `json:"code"`
	// Message 是可返回给调用方的错误摘要。
	Message string `json:"message"`
	// Details 是验证错误明细。
	Details any `json:"details,omitempty"`
}

// Handler 处理 SCUM plugin gateway 命令。
type Handler struct {
	// AllowAdHocSQL 表示是否允许临时只读 SQL。
	AllowAdHocSQL bool
}

// NewHandler creates the SCUM plugin command handler.
// allowAdHocSQL controls whether requests may submit validated ad hoc SQL, and the function returns a reusable handler.
func NewHandler(allowAdHocSQL bool) Handler {
	return Handler{AllowAdHocSQL: allowAdHocSQL}
}

// Handle converts one plugin API command into a plugin API response.
// command contains the gateway route, actor, instance, and body payload, and the method returns a structured response or validation error.
func (h Handler) Handle(command APICommand) APICommandResponse {
	route := normalizeRoute(command.RouteSuffix)
	switch {
	case command.Method == http.MethodGet && route == "settings":
		return h.handleSettingsRead(command)
	case command.Method == http.MethodPatch && route == "settings":
		return h.handleSettingsPatch(command)
	case command.Method == http.MethodGet && route == "logs":
		return h.handleLogsRead(command)
	case command.Method == http.MethodPost && route == "database/query":
		return h.handleDatabaseQuery(command)
	default:
		return h.handleDomainPlan(command, route)
	}
}

// handleSettingsRead returns plugin-owned configuration workspace metadata for frontend-driven file browsing.
// command contains the instance context from the gateway, and the method returns a domain envelope or a stable missing-instance error.
func (h Handler) handleSettingsRead(command APICommand) APICommandResponse {
	instanceID := commandInstanceID(command)
	if instanceID == "" {
		return pluginError(command, http.StatusBadRequest, "missing_instance", "server instance context is required", nil)
	}
	body := domainResult(command, "settings", "settings", "SCUM 配置", "读取实例配置目录中的真实文件，并支持完整的 SCUM 常用配置文件集合。", instanceID, "scum.config.read", "file.read", map[string]any{
		"workspaces":       scumfiles.ConfigWorkspaces(),
		"supportedFiles":   scumfiles.SupportedConfigFiles(),
		"structuredFields": scumconfig.FieldDefinitions(),
		"structuredPath":   scumconfig.SettingsPath,
	}, nil)
	return jsonResponse(command, http.StatusOK, body)
}

// handleLogsRead returns plugin-owned log workspace metadata for frontend-driven file browsing.
// command contains the instance context from the gateway, and the method returns a domain envelope or a stable missing-instance error.
func (h Handler) handleLogsRead(command APICommand) APICommandResponse {
	instanceID := commandInstanceID(command)
	if instanceID == "" {
		return pluginError(command, http.StatusBadRequest, "missing_instance", "server instance context is required", nil)
	}
	body := domainResult(command, "logs", "logs", "日志", "读取实例日志目录中的真实文件，并优先展示常见 SCUM 游戏日志。", instanceID, "scum.logs.read", "file.read", map[string]any{
		"workspaces": scumfiles.LogWorkspaces(),
	}, nil)
	return jsonResponse(command, http.StatusOK, body)
}

// handleSettingsPatch validates a SCUM settings patch and returns an operation handle plus a core file.patch dispatch plan.
// command contains a PatchRequest JSON body, and the method returns a governed operation envelope or validation errors.
func (h Handler) handleSettingsPatch(command APICommand) APICommandResponse {
	var request scumconfig.PatchRequest
	if err := json.Unmarshal(command.Body, &request); err != nil {
		return pluginError(command, http.StatusBadRequest, "bad_json", "request body is not valid JSON", nil)
	}
	if request.ServerInstanceID == "" {
		request.ServerInstanceID = commandInstanceID(command)
	}
	plan, validationErrors := scumconfig.ValidateChanges(request)
	if len(validationErrors) > 0 {
		return pluginError(command, http.StatusBadRequest, "validation_failed", "SCUM configuration patch is invalid", validationErrors)
	}
	planResponse := CapabilityPlanResponse{
		Capability: "file.patch",
		Operation:  "patch",
		Payload:    plan,
	}
	body := operationResponse(command, "settings", "settings", "SCUM 配置", "提交 ServerSettings.ini 配置修改。", request.ServerInstanceID, "scum.config.patch", "file.patch", "settings.patch", "SCUM 配置修改已提交至受控文件能力。", &planResponse)
	return jsonResponse(command, http.StatusAccepted, body)
}

// handleDatabaseQuery validates a SCUM.db read request and returns a business envelope plus core db.query dispatch plan.
// command contains a QueryRequest JSON body, and the method returns a read-only database envelope or validation errors.
func (h Handler) handleDatabaseQuery(command APICommand) APICommandResponse {
	var request scumdb.QueryRequest
	if err := json.Unmarshal(command.Body, &request); err != nil {
		return pluginError(command, http.StatusBadRequest, "bad_json", "request body is not valid JSON", nil)
	}
	if request.ServerInstanceID == "" {
		request.ServerInstanceID = commandInstanceID(command)
	}
	plan, validationErrors := scumdb.BuildPlan(request, h.AllowAdHocSQL)
	if len(validationErrors) > 0 {
		return pluginError(command, http.StatusBadRequest, "validation_failed", "SCUM database query is invalid", validationErrors)
	}
	planResponse := CapabilityPlanResponse{
		Capability: "db.query",
		Operation:  "query",
		Payload:    plan,
	}
	body := domainResult(command, "database/query", "database", "数据库视图", "提交只读 SCUM.db 查询。", request.ServerInstanceID, "scum.database.query", "db.query", map[string]any{
		"columns":   []string{},
		"rows":      []map[string]any{},
		"rowCount":  0,
		"truncated": false,
		"summary":   plan.Summary,
	}, &planResponse)
	return jsonResponse(command, http.StatusOK, body)
}

// handleDomainPlan validates a non-settings SCUM domain route and returns a business envelope around scoped dispatch metadata.
// command carries gateway actor, instance, query, and body metadata, route is the normalized route suffix, and the method returns a domain result, operation handle, unavailable state, or validation error.
func (h Handler) handleDomainPlan(command APICommand, route string) APICommandResponse {
	requestBody, err := decodeObjectBody(command.Body)
	if err != nil {
		return pluginError(command, http.StatusBadRequest, "bad_json", "request body is not a JSON object", nil)
	}
	spec, specOK := scumdomain.FindRouteSpec(command.Method, route)
	if !specOK {
		return pluginError(command, http.StatusNotFound, "validation_failed", "SCUM domain request is invalid", []scumdomain.ValidationError{{Field: "route", Code: "unsupported_route", Message: "SCUM domain route is not implemented"}})
	}
	plan, validationErrors := scumdomain.BuildPlan(scumdomain.PlanRequest{
		Method:           command.Method,
		Route:            route,
		ServerInstanceID: commandInstanceID(command),
		Body:             requestBody,
		Query:            command.Query,
	})
	if len(validationErrors) > 0 {
		status := http.StatusBadRequest
		if len(validationErrors) == 1 && validationErrors[0].Code == "unsupported_route" {
			status = http.StatusNotFound
		}
		return pluginError(command, status, "validation_failed", "SCUM domain request is invalid", validationErrors)
	}
	planResponse := CapabilityPlanResponse{
		Capability: plan.Capability,
		Operation:  plan.Operation,
		Payload:    plan,
	}
	if spec.RiskLevel == "high" {
		body := operationResponse(command, spec.Route, spec.Domain, spec.Title, spec.Summary, plan.ServerInstanceID, spec.Permission, spec.Capability, spec.Operation, spec.Summary, &planResponse)
		return jsonResponse(command, http.StatusAccepted, body)
	}
	body := domainUnavailable(command, spec.Route, spec.Domain, spec.Title, spec.Summary, plan.ServerInstanceID, spec.Permission, spec.Capability, "capability_execution_unavailable", "该工作流需要 core 能力执行结果，当前返回稳定不可用状态。", &planResponse)
	body.Data = readRoutePlaceholder(spec, plan)
	if spec.Route == "tasks" {
		body.State = "available"
		body.Kind = "domain_result"
		body.Unavailable = nil
		body.Data = map[string]any{"tasks": []map[string]any{}}
	}
	return jsonResponse(command, http.StatusOK, body)
}

// readRoutePlaceholder builds stable placeholder metadata for read routes before core hydration executes the query.
// spec describes the SCUM route, plan contains the scoped capability plan, and the function returns a renderable placeholder payload.
func readRoutePlaceholder(spec scumdomain.RouteSpec, plan scumdomain.CapabilityPlan) map[string]any {
	source := domainSourceSummary{
		Kind:    firstNonEmpty(strings.TrimSpace(plan.SourceStrategy.Primary), "scum_run"),
		Mode:    "primary",
		Summary: firstNonEmpty(strings.TrimSpace(plan.SourceStrategy.Summary), "当前由 scum_run 提供结构化读结果。"),
	}
	if fallback := strings.TrimSpace(plan.SourceStrategy.Fallback); fallback != "" {
		source.Fallback = fallback
	}
	placeholder := map[string]any{
		"items":   []map[string]any{},
		"rows":    []map[string]any{},
		"summary": plan.AuditSummary,
		"source":  source,
	}
	if spec.Template != "" {
		placeholder["template"] = spec.Template
	}
	switch spec.Route {
	case "players":
		placeholder["view"] = "table"
	case "players/detail", "players/assets":
		placeholder["view"] = "detail"
	case "players/login-history", "players/duplicate-ip", "players/skills", "players/trajectory", "vehicles", "vehicles/detail", "territories", "squads", "locks", "locks/records":
		placeholder["view"] = "list"
	}
	return placeholder
}

// domainResult builds a migrated read-route business response.
// command supplies correlation fields, route/domain/title describe the SCUM route, instanceID and permission/capability describe dispatch requirements, data is the renderable result, and dispatchPlan is optional core execution metadata.
func domainResult(command APICommand, route string, domain string, title string, summary string, instanceID string, permission string, capability string, data any, dispatchPlan *CapabilityPlanResponse) DomainAPIResponse {
	return DomainAPIResponse{
		Kind:               "domain_result",
		State:              "available",
		Route:              route,
		Domain:             domain,
		Title:              title,
		Summary:            summary,
		ServerInstanceID:   instanceID,
		RequiredPermission: permission,
		RequiredCapability: capability,
		Data:               data,
		DispatchPlan:       dispatchPlan,
	}
}

// operationResponse builds a governed operation-handle response for high-risk routes.
// command supplies correlation fields, route/domain/title identify the SCUM route, instanceID and permission/capability describe dispatch requirements, operationType and summary describe the handle, and dispatchPlan is optional core execution metadata.
func operationResponse(command APICommand, route string, domain string, title string, summary string, instanceID string, permission string, capability string, operationType string, operationSummary string, dispatchPlan *CapabilityPlanResponse) DomainAPIResponse {
	return DomainAPIResponse{
		Kind:               "operation_handle",
		State:              "pending_dispatch",
		Route:              route,
		Domain:             domain,
		Title:              title,
		Summary:            summary,
		ServerInstanceID:   instanceID,
		RequiredPermission: permission,
		RequiredCapability: capability,
		Operation: &DomainOperationHandle{
			ID:                   operationID(command, route),
			Type:                 operationType,
			Status:               "pending_dispatch",
			Summary:              operationSummary,
			PollPath:             "tasks",
			RiskLevel:            "high",
			RequiresConfirmation: true,
		},
		DispatchPlan: dispatchPlan,
	}
}

// domainUnavailable builds a stable unavailable business response.
// command supplies correlation fields, route/domain/title identify the SCUM route, instanceID and permission/capability describe dispatch requirements, reasonCode and summary are safe user-facing state, and dispatchPlan is optional diagnostic metadata.
func domainUnavailable(command APICommand, route string, domain string, title string, summary string, instanceID string, permission string, capability string, reasonCode string, unavailableSummary string, dispatchPlan *CapabilityPlanResponse) DomainAPIResponse {
	return DomainAPIResponse{
		Kind:               "unavailable",
		State:              "unavailable",
		Route:              route,
		Domain:             domain,
		Title:              title,
		Summary:            summary,
		ServerInstanceID:   instanceID,
		RequiredPermission: permission,
		RequiredCapability: capability,
		Unavailable: &DomainUnavailableState{
			Code:       reasonCode,
			ReasonCode: reasonCode,
			Summary:    unavailableSummary,
			NextAction: "请刷新服务器状态，或联系具备管理权限的协作者处理。",
			Retryable:  true,
		},
		DispatchPlan: dispatchPlan,
	}
}

// operationID derives a stable operation handle ID from command correlation metadata.
// command supplies request and trace IDs, route identifies the SCUM operation, and the function returns a bounded ID suitable for display and polling.
func operationID(command APICommand, route string) string {
	source := strings.TrimSpace(command.RequestID)
	if source == "" {
		source = strings.TrimSpace(command.TraceID)
	}
	if source == "" {
		source = "local"
	}
	route = strings.NewReplacer("/", "-", "_", "-").Replace(strings.Trim(route, "/"))
	if route == "" {
		route = "operation"
	}
	return "op_" + route + "_" + source
}

// jsonResponse builds a JSON plugin API response.
// command supplies correlation identifiers, statusCode is the gateway status, body is JSON encoded, and the function returns a command response.
func jsonResponse(command APICommand, statusCode int, body any) APICommandResponse {
	encoded, err := json.Marshal(body)
	if err != nil {
		return pluginError(command, http.StatusInternalServerError, "encode_failed", "failed to encode plugin response", nil)
	}
	return APICommandResponse{
		RequestID:   command.RequestID,
		TraceID:     command.TraceID,
		StatusCode:  statusCode,
		ContentType: "application/json",
		Headers:     map[string]string{"Content-Type": "application/json"},
		Body:        encoded,
	}
}

// pluginError builds a structured plugin error response.
// command supplies correlation identifiers, statusCode/code/message describe the error, details carries optional validation metadata, and the function returns a command response.
func pluginError(command APICommand, statusCode int, code string, message string, details any) APICommandResponse {
	body, _ := json.Marshal(ErrorResponse{Code: code, Message: message, Details: details})
	return APICommandResponse{
		RequestID:   command.RequestID,
		TraceID:     command.TraceID,
		StatusCode:  statusCode,
		ContentType: "application/json",
		Body:        body,
		Error:       &APICommandError{Code: code, Message: message, Retryable: false},
	}
}

// decodeObjectBody decodes an optional JSON object request body.
// body contains the raw plugin gateway payload, and the function returns an empty map for absent bodies or an error for non-object JSON.
func decodeObjectBody(body []byte) (map[string]any, error) {
	if len(body) == 0 {
		return map[string]any{}, nil
	}
	var output map[string]any
	if err := json.Unmarshal(body, &output); err != nil {
		return nil, err
	}
	if output == nil {
		output = map[string]any{}
	}
	return output, nil
}

// normalizeRoute normalizes a plugin gateway route suffix.
// route is the raw suffix from core, and the function returns a slash-trimmed lowercase route.
func normalizeRoute(route string) string {
	return strings.Trim(strings.ToLower(strings.TrimSpace(route)), "/")
}

// firstNonEmpty returns the first trimmed non-empty value from a candidate list.
// values contains candidate strings in priority order, and the function returns the first non-empty value or an empty string when none are set.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// commandInstanceID returns the server instance ID attached to a gateway command.
// command may include optional instance context, and the function returns an empty string when absent.
func commandInstanceID(command APICommand) string {
	if command.Instance == nil {
		return ""
	}
	return strings.TrimSpace(command.Instance.ServerInstanceID)
}
