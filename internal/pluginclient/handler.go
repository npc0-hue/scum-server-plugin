package pluginclient

import (
	"encoding/json"
	"net/http"
	"strings"

	"scum_admin_plugin/internal/scumconfig"
	"scum_admin_plugin/internal/scumdb"
)

// CapabilityPlanResponse 表示插件请求 core 执行受控能力后的计划响应。
type CapabilityPlanResponse struct {
	// Capability 是请求 core 执行的能力键。
	Capability string `json:"capability"`
	// Operation 是能力内的操作名称。
	Operation string `json:"operation"`
	// Payload 是能力请求载荷。
	Payload any `json:"payload"`
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
	case command.Method == http.MethodPost && route == "database/query":
		return h.handleDatabaseQuery(command)
	default:
		return pluginError(command, http.StatusNotFound, "unsupported_route", "SCUM plugin route is not implemented", nil)
	}
}

// handleSettingsRead creates a core file.read capability plan for ServerSettings.ini.
// command contains the instance context from the gateway, and the method returns a plugin response with a capability plan.
func (h Handler) handleSettingsRead(command APICommand) APICommandResponse {
	instanceID := commandInstanceID(command)
	if instanceID == "" {
		return pluginError(command, http.StatusBadRequest, "missing_instance", "server instance context is required", nil)
	}
	body := CapabilityPlanResponse{
		Capability: "file.read",
		Operation:  "read",
		Payload: map[string]any{
			"serverInstanceId": instanceID,
			"path":             scumconfig.SettingsPath,
		},
	}
	return jsonResponse(command, http.StatusAccepted, body)
}

// handleSettingsPatch validates a SCUM settings patch and returns a core file.patch capability plan.
// command contains a PatchRequest JSON body, and the method returns a validated patch plan or validation errors.
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
	body := CapabilityPlanResponse{
		Capability: "file.patch",
		Operation:  "patch",
		Payload:    plan,
	}
	return jsonResponse(command, http.StatusAccepted, body)
}

// handleDatabaseQuery validates a SCUM.db read request and returns a core db.query capability plan.
// command contains a QueryRequest JSON body, and the method returns a read-only database plan or validation errors.
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
	body := CapabilityPlanResponse{
		Capability: "db.query",
		Operation:  "query",
		Payload:    plan,
	}
	return jsonResponse(command, http.StatusAccepted, body)
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

// normalizeRoute normalizes a plugin gateway route suffix.
// route is the raw suffix from core, and the function returns a slash-trimmed lowercase route.
func normalizeRoute(route string) string {
	return strings.Trim(strings.ToLower(strings.TrimSpace(route)), "/")
}

// commandInstanceID returns the server instance ID attached to a gateway command.
// command may include optional instance context, and the function returns an empty string when absent.
func commandInstanceID(command APICommand) string {
	if command.Instance == nil {
		return ""
	}
	return strings.TrimSpace(command.Instance.ServerInstanceID)
}
