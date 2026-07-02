package scumdomain

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"scum_admin_plugin/internal/scumdb"
)

const (
	riskLow    = "low"
	riskMedium = "medium"
	riskHigh   = "high"
)

var (
	sourceStrategyRunOnly          = RouteSourceStrategy{Primary: "scum_run", Summary: "当前由 scum_run 提供数据库或宿主执行能力。"}
	sourceStrategyRunOnlyPreferred = RouteSourceStrategy{Primary: "scum_run", Summary: "当前统一由 scum_run 作为首选执行来源，scum_client 不再作为读链路回退面。"}
)

var routeSpecs = []RouteSpec{
	{Domain: "database", Method: http.MethodPost, Route: "database/query", Title: "数据库查询", Capability: "db.query", Operation: "query", Permission: "scum.database.query", RiskLevel: riskMedium, Summary: "提交 SCUM.db 只读查询计划", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players", Title: "玩家列表", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.summary", Summary: "读取玩家摘要", SourceStrategy: sourceStrategyRunOnlyPreferred},
	{Domain: "players", Method: http.MethodGet, Route: "players/detail", Title: "玩家详情", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.detail", Summary: "读取玩家详情", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players/login-history", Title: "登录历史", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.login-history", Summary: "读取玩家登录历史", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players/duplicate-ip", Title: "重复 IP", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.duplicate-ip", Summary: "读取重复 IP 结果", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players/skills", Title: "技能", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.skills", Summary: "读取玩家技能", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players/assets", Title: "资产", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.assets", Summary: "读取玩家资产", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "players", Method: http.MethodGet, Route: "players/trajectory", Title: "轨迹", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Template: "players.trajectory", Summary: "读取玩家轨迹", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "map", Method: http.MethodGet, Route: "map/timeline", Title: "轨迹地图", Capability: "db.query", Operation: "query", Permission: "scum.players.read", RiskLevel: riskMedium, Summary: "读取地图时间线与轨迹图层", SourceStrategy: sourceStrategyRunOnlyPreferred},
	{Domain: "players", Method: http.MethodPost, Route: "players/action", Title: "玩家操作", Capability: "task.run", Operation: "player-action", Permission: "scum.players.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交玩家踢出、封禁、传送或发物品任务"},
	{Domain: "vehicles", Method: http.MethodGet, Route: "vehicles", Title: "载具列表", Capability: "db.query", Operation: "query", Permission: "scum.vehicles.read", RiskLevel: riskMedium, Template: "vehicles.summary", Summary: "读取载具摘要", SourceStrategy: sourceStrategyRunOnlyPreferred},
	{Domain: "vehicles", Method: http.MethodGet, Route: "vehicles/detail", Title: "载具详情", Capability: "db.query", Operation: "query", Permission: "scum.vehicles.read", RiskLevel: riskMedium, Template: "vehicles.detail", Summary: "读取载具详情", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "vehicles", Method: http.MethodPost, Route: "vehicles/action", Title: "载具操作", Capability: "task.run", Operation: "vehicle-action", Permission: "scum.vehicles.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交载具召回、删除或归属调整任务"},
	{Domain: "territories", Method: http.MethodGet, Route: "territories", Title: "领地列表", Capability: "db.query", Operation: "query", Permission: "scum.territories.read", RiskLevel: riskMedium, Template: "territories.summary", Summary: "读取领地摘要", SourceStrategy: sourceStrategyRunOnlyPreferred},
	{Domain: "territories", Method: http.MethodGet, Route: "squads", Title: "小队列表", Capability: "db.query", Operation: "query", Permission: "scum.territories.read", RiskLevel: riskMedium, Template: "squads.summary", Summary: "读取小队摘要", SourceStrategy: sourceStrategyRunOnlyPreferred},
	{Domain: "territories", Method: http.MethodGet, Route: "squads/members", Title: "小队成员", Capability: "db.query", Operation: "query", Permission: "scum.territories.read", RiskLevel: riskMedium, Template: "squads.members", Summary: "读取小队成员详情", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "territories", Method: http.MethodGet, Route: "squads/vehicles", Title: "小队载具", Capability: "db.query", Operation: "query", Permission: "scum.vehicles.read", RiskLevel: riskMedium, Template: "squads.vehicles", Summary: "读取小队载具摘要", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "territories", Method: http.MethodPost, Route: "territories/action", Title: "领地操作", Capability: "task.run", Operation: "territory-action", Permission: "scum.territories.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交领地修正任务"},
	{Domain: "locks", Method: http.MethodGet, Route: "locks", Title: "锁具列表", Capability: "db.query", Operation: "query", Permission: "scum.locks.read", RiskLevel: riskMedium, Template: "locks.summary", Summary: "读取锁具摘要", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "locks", Method: http.MethodGet, Route: "locks/records", Title: "开锁记录", Capability: "db.query", Operation: "query", Permission: "scum.locks.read", RiskLevel: riskMedium, Template: "locks.records", Summary: "读取开锁记录", SourceStrategy: sourceStrategyRunOnly},
	{Domain: "locks", Method: http.MethodPost, Route: "locks/action", Title: "锁具操作", Capability: "task.run", Operation: "lock-action", Permission: "scum.locks.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交开锁或锁具修正任务"},
	{Domain: "gifts", Method: http.MethodGet, Route: "gifts", Title: "礼包列表", Capability: "task.query", Operation: "gift-list", Permission: "scum.gifts.read", RiskLevel: riskMedium, Summary: "读取礼包规则"},
	{Domain: "gifts", Method: http.MethodGet, Route: "gifts/detail", Title: "礼包详情", Capability: "task.query", Operation: "gift-detail", Permission: "scum.gifts.read", RiskLevel: riskMedium, Summary: "读取礼包详情"},
	{Domain: "gifts", Method: http.MethodGet, Route: "gifts/stats", Title: "礼包统计", Capability: "task.query", Operation: "gift-stats", Permission: "scum.gifts.read", RiskLevel: riskMedium, Summary: "读取礼包统计摘要"},
	{Domain: "gifts", Method: http.MethodGet, Route: "gifts/dispatch-records", Title: "礼包发放记录", Capability: "task.query", Operation: "gift-dispatch-records", Permission: "scum.gifts.read", RiskLevel: riskMedium, Summary: "读取礼包发放记录"},
	{Domain: "gifts", Method: http.MethodPost, Route: "gifts/action", Title: "礼包操作", Capability: "task.run", Operation: "gift-action", Permission: "scum.gifts.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交礼包创建、修改、删除或发放任务"},
	{Domain: "events", Method: http.MethodGet, Route: "events", Title: "事件列表", Capability: "task.query", Operation: "event-list", Permission: "scum.events.read", RiskLevel: riskMedium, Summary: "读取事件规则"},
	{Domain: "events", Method: http.MethodPost, Route: "events/action", Title: "事件操作", Capability: "task.run", Operation: "event-action", Permission: "scum.events.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交事件生产、修改或删除任务"},
	{Domain: "economy", Method: http.MethodGet, Route: "economy/items", Title: "交易物品", Capability: "artifact.read", Operation: "metadata", Permission: "scum.economy.read", RiskLevel: riskLow, Summary: "读取插件自有交易物品元数据"},
	{Domain: "economy", Method: http.MethodPost, Route: "economy/action", Title: "经济操作", Capability: "task.run", Operation: "economy-action", Permission: "scum.economy.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交经济和交易物品变更任务"},
	{Domain: "logs", Method: http.MethodGet, Route: "logs", Title: "日志", Capability: "file.read", Operation: "read", Permission: "scum.logs.read", RiskLevel: riskMedium, Summary: "读取日志文件"},
	{Domain: "steam", Method: http.MethodGet, Route: "steam/news", Title: "Steam 新闻", Capability: "steam.news", Operation: "list", Permission: "scum.steam.read", RiskLevel: riskLow, Summary: "读取 Steam 新闻元数据"},
	{Domain: "update", Method: http.MethodPost, Route: "update/install", Title: "SteamCMD 安装", Capability: "steamcmd.update", Operation: "install", Permission: "scum.update.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交 SteamCMD 安装任务"},
	{Domain: "update", Method: http.MethodPost, Route: "update/server", Title: "服务端更新", Capability: "steamcmd.update", Operation: "update", Permission: "scum.update.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交 SCUM 服务端更新任务"},
	{Domain: "restart", Method: http.MethodPost, Route: "server/restart", Title: "受控重启", Capability: "process.control", Operation: "restart", Permission: "scum.restart.mutate", RiskLevel: riskHigh, RequiresConfirmation: true, Summary: "提交受控重启任务"},
	{Domain: "tasks", Method: http.MethodGet, Route: "tasks", Title: "任务", Capability: "task.query", Operation: "list", Permission: "scum.tasks.read", RiskLevel: riskMedium, Summary: "读取 SCUM 插件任务状态"},
}

// BuildPlan validates a SCUM domain request and returns a scoped capability plan.
// request carries method, route, instance, query, and JSON body metadata, and the function returns a plan or validation errors without executing host operations.
func BuildPlan(request PlanRequest) (CapabilityPlan, []ValidationError) {
	spec, ok := FindRouteSpec(request.Method, request.Route)
	if !ok {
		return CapabilityPlan{}, []ValidationError{{Field: "route", Code: "unsupported_route", Message: "SCUM domain route is not implemented"}}
	}
	instanceID := strings.TrimSpace(request.ServerInstanceID)
	if instanceID == "" {
		return CapabilityPlan{}, []ValidationError{{Field: "serverInstanceId", Code: "required", Message: "server instance id is required"}}
	}
	payload := map[string]any{
		"serverInstanceId": instanceID,
		"domain":           spec.Domain,
		"route":            spec.Route,
		"limits": map[string]any{
			"maxRows":       500,
			"maxBytes":      1 << 20,
			"timeoutMs":     10_000,
			"redactSecrets": true,
		},
	}
	for key, value := range request.Body {
		payload[key] = sanitizeValue(value)
	}
	if len(request.Query) > 0 {
		payload["query"] = boundedQuery(request.Query)
	}
	if spec.Template != "" {
		payload["queryPlan"] = map[string]any{
			"databaseRef": scumdb.DefaultDatabaseRef,
			"template":    spec.Template,
			"maxRows":     500,
			"maxBytes":    1 << 20,
			"timeoutMs":   10_000,
			"summary":     "template:" + spec.Template,
		}
	}
	if spec.RequiresConfirmation {
		if confirmed, ok := request.Body["confirmed"].(bool); !ok || !confirmed {
			return CapabilityPlan{}, []ValidationError{{Field: "confirmed", Code: "confirmation_required", Message: "high-risk SCUM operation requires explicit confirmation"}}
		}
		payload["requiresConfirmation"] = true
	}
	return CapabilityPlan{
		ServerInstanceID: instanceID,
		Domain:           spec.Domain,
		Capability:       spec.Capability,
		Operation:        spec.Operation,
		Permission:       spec.Permission,
		RiskLevel:        spec.RiskLevel,
		Route:            spec.Route,
		Payload:          payload,
		AuditSummary:     spec.Summary,
		SourceStrategy:   spec.SourceStrategy,
	}, nil
}

// FindRouteSpec returns metadata for a plugin API route.
// method and route identify the requested endpoint, and the function returns the matching spec plus whether it exists.
func FindRouteSpec(method string, route string) (RouteSpec, bool) {
	normalizedMethod := strings.ToUpper(strings.TrimSpace(method))
	normalizedRoute := strings.Trim(strings.ToLower(strings.TrimSpace(route)), "/")
	for _, spec := range routeSpecs {
		if spec.Method == normalizedMethod && spec.Route == normalizedRoute {
			return spec, true
		}
	}
	return RouteSpec{}, false
}

// RouteSpecs returns all SCUM domain route specs in stable order.
// It takes no parameters and returns a copy so callers cannot mutate package state.
func RouteSpecs() []RouteSpec {
	output := append([]RouteSpec(nil), routeSpecs...)
	sort.Slice(output, func(left int, right int) bool {
		if output[left].Domain == output[right].Domain {
			return output[left].Route < output[right].Route
		}
		return output[left].Domain < output[right].Domain
	})
	return output
}

// PermissionKeys returns the manifest permission keys required by SCUM domain routes.
// It takes no parameters and returns sorted unique keys for tests and metadata validation.
func PermissionKeys() []string {
	seen := map[string]bool{}
	for _, spec := range routeSpecs {
		seen[spec.Permission] = true
	}
	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// CapabilityKeys returns the manifest capability keys required by SCUM domain routes.
// It takes no parameters and returns sorted unique keys for tests and metadata validation.
func CapabilityKeys() []string {
	seen := map[string]bool{}
	for _, spec := range routeSpecs {
		seen[spec.Capability] = true
	}
	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// sanitizeValue copies a caller value into a bounded audit-safe payload value.
// value may contain user input, and the function returns a redacted or truncated representation suitable for dispatch metadata.
func sanitizeValue(value any) any {
	switch typed := value.(type) {
	case string:
		if len(typed) > 240 {
			return typed[:240]
		}
		return typed
	case []any:
		if len(typed) > 50 {
			return typed[:50]
		}
		return typed
	case map[string]any:
		output := map[string]any{}
		for key, nested := range typed {
			lower := strings.ToLower(key)
			if strings.Contains(lower, "token") || strings.Contains(lower, "password") || strings.Contains(lower, "secret") {
				output[key] = "[redacted]"
				continue
			}
			output[key] = sanitizeValue(nested)
		}
		return output
	default:
		return value
	}
}

// boundedQuery returns a short copy of query parameters.
// query contains caller URL parameters, and the function returns a copy with bounded values for capability metadata.
func boundedQuery(query map[string][]string) map[string][]string {
	output := map[string][]string{}
	for key, values := range query {
		copied := append([]string(nil), values...)
		if len(copied) > 10 {
			copied = copied[:10]
		}
		for index, value := range copied {
			if len(value) > 120 {
				copied[index] = value[:120]
			}
		}
		output[key] = copied
	}
	return output
}

// DebugSummary formats route specs for migration inventory and tests.
// It takes no parameters and returns one line per route with domain, method, permission, risk, and capability metadata.
func DebugSummary() []string {
	specs := RouteSpecs()
	lines := make([]string, 0, len(specs))
	for _, spec := range specs {
		lines = append(lines, fmt.Sprintf("%s %s -> %s [%s/%s/%s]", spec.Method, spec.Route, spec.Domain, spec.Permission, spec.RiskLevel, spec.Capability))
	}
	return lines
}
