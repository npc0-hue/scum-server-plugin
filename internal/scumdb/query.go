package scumdb

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

const (
	defaultMaxRows   = 500
	defaultMaxBytes  = 1 << 20
	defaultTimeoutMS = 10_000
)

var blockedSQLPattern = regexp.MustCompile(`(?i)\b(insert|update|delete|replace|drop|alter|create|truncate|vacuum|attach|detach|reindex|begin|commit|rollback|pragma)\b`)

var templates = map[string]string{
	"players.summary":       "SELECT p.id, COALESCE(NULLIF(TRIM(up.fake_name), ''), NULLIF(TRIM(up.name), ''), 'Unknown Player') AS name, COALESCE(up.user_id, '') AS steamId, CASE WHEN COALESCE(p.is_alive, 0) <> 0 THEN '在线' ELSE '离线' END AS status, p.last_save_time AS lastSeen, COALESCE(up.fame_points, 0) AS fame_points FROM prisoner p LEFT JOIN user_profile up ON up.id = p.user_profile_id ORDER BY COALESCE(NULLIF(TRIM(up.fake_name), ''), NULLIF(TRIM(up.name), ''), up.user_id, CAST(p.id AS TEXT)) LIMIT ?",
	"players.detail":        "SELECT p.id, COALESCE(NULLIF(TRIM(up.fake_name), ''), NULLIF(TRIM(up.name), ''), 'Unknown Player') AS name, COALESCE(up.user_id, '') AS steamId, COALESCE(up.fame_points, 0) AS famePoints, COALESCE(pe.entity_id, 0) AS entityId, COALESCE(e.location_x, 0.0) AS locationX, COALESCE(e.location_y, 0.0) AS locationY, COALESCE(e.location_z, 0.0) AS locationZ, CASE WHEN COALESCE(p.is_alive, 0) <> 0 THEN '在线' ELSE '离线' END AS status, p.last_save_time AS lastSeen FROM prisoner p LEFT JOIN user_profile up ON up.id = p.user_profile_id LEFT JOIN prisoner_entity pe ON pe.prisoner_id = p.id LEFT JOIN entity e ON e.id = pe.entity_id WHERE p.id = ? LIMIT 1",
	"players.login-history": "SELECT id, server_id AS serverId, user_profile_id AS userId, ip_address AS ip, created_at AS loginAt FROM user_login_log WHERE user_profile_id = ? ORDER BY created_at DESC LIMIT ?",
	"players.duplicate-ip":  "SELECT ip_address AS ip, user_profile_id AS userId, created_at AS loginAt FROM user_login_log WHERE ip_address IN (SELECT ip_address FROM user_login_log GROUP BY ip_address HAVING COUNT(DISTINCT user_profile_id) > 1) ORDER BY ip_address ASC, created_at DESC LIMIT ?",
	"players.skills":        "SELECT user_profile_id AS userId, skill_name AS skillName, skill_class AS skillClass, skill_level AS skillLevel, experience AS experience FROM user_skill WHERE user_profile_id = ? ORDER BY skill_class ASC, skill_name ASC LIMIT ?",
	"players.assets":        "SELECT up.id AS userId, COALESCE(up.fame_points, 0) AS famePoints, COALESCE(SUM(CASE WHEN barc.currency_type = 'money' THEN barc.account_balance ELSE 0 END), 0) AS accountBalance, COALESCE(SUM(CASE WHEN barc.currency_type = 'gold' THEN barc.account_balance ELSE 0 END), 0) AS goldBalance FROM user_profile up LEFT JOIN bank_account_registry bar ON bar.account_owner_user_profile_id = up.id LEFT JOIN bank_account_registry_currencies barc ON barc.bank_account_id = bar.id WHERE up.id = ? GROUP BY up.id LIMIT 1",
	"players.trajectory":    "SELECT pe.prisoner_id AS playerId, e.location_x AS locationX, e.location_y AS locationY, e.location_z AS locationZ, p.last_save_time AS observedAt FROM prisoner_entity pe INNER JOIN entity e ON e.id = pe.entity_id INNER JOIN prisoner p ON p.id = pe.prisoner_id WHERE pe.prisoner_id = ? AND p.last_save_time BETWEEN ? AND ? ORDER BY p.last_save_time DESC LIMIT ?",
	"vehicles.summary":      "SELECT id, vehicle_type, owner_prisoner_id FROM vehicle ORDER BY id LIMIT ?",
	"vehicles.detail":       "SELECT v.id, COALESCE(v.vehicle_type, '') AS vehicleType, COALESCE(v.owner_prisoner_id, 0) AS ownerPrisonerId, COALESCE(e.location_x, 0.0) AS locationX, COALESCE(e.location_y, 0.0) AS locationY, COALESCE(e.location_z, 0.0) AS locationZ FROM vehicle v LEFT JOIN entity e ON e.id = v.entity_id WHERE v.id = ? LIMIT 1",
	"territories.summary":   "SELECT be.element_id AS territoryId, COALESCE(up.user_id, '') AS ownerSteamId, COALESCE(up.name, up.fake_name, '') AS ownerName, COALESCE(s.name, '') AS squadName, COALESCE(be.location_x, 0.0) AS locationX, COALESCE(be.location_y, 0.0) AS locationY, COALESCE(be.location_z, 0.0) AS locationZ FROM base_element be LEFT JOIN user_profile up ON up.id = be.owner_profile_id LEFT JOIN squad_member sm ON sm.user_profile_id = be.owner_profile_id AND sm.rank = 4 LEFT JOIN squad s ON s.id = sm.squad_id WHERE be.asset LIKE '%Flag%' ORDER BY be.element_id DESC LIMIT ?",
	"squads.summary":        "SELECT s.id AS squadId, COALESCE(s.name, '') AS squadName, COUNT(sm.id) AS memberCount FROM squad s LEFT JOIN squad_member sm ON sm.squad_id = s.id GROUP BY s.id, s.name ORDER BY s.id DESC LIMIT ?",
	"locks.summary":         "SELECT l.id, COALESCE(l.lock_type, '') AS lockType, COALESCE(l.owner_prisoner_id, 0) AS ownerPrisonerId, COALESCE(e.location_x, 0.0) AS locationX, COALESCE(e.location_y, 0.0) AS locationY, COALESCE(e.location_z, 0.0) AS locationZ FROM lock l LEFT JOIN entity e ON e.id = l.entity_id ORDER BY l.id DESC LIMIT ?",
	"locks.records":         "SELECT id, lock_id AS lockId, actor_user_profile_id AS actorUserId, result AS result, created_at AS createdAt FROM lock_access_log ORDER BY created_at DESC LIMIT ?",
	"world.zones":           "SELECT id, name FROM zone ORDER BY id LIMIT ?",
}

var templateArgumentBuilders = map[string]func(QueryRequest, int) ([]any, []ValidationError){
	"players.detail": func(request QueryRequest, _ int) ([]any, []ValidationError) {
		id := strings.TrimSpace(firstNonEmpty(request.EntityID, request.SubjectID))
		if id == "" {
			return nil, []ValidationError{{Field: "entityId", Code: "required", Message: "entity id is required for players.detail"}}
		}
		return []any{id}, nil
	},
	"players.login-history": func(request QueryRequest, limit int) ([]any, []ValidationError) {
		id := strings.TrimSpace(firstNonEmpty(request.SubjectID, request.EntityID))
		if id == "" {
			return nil, []ValidationError{{Field: "subjectId", Code: "required", Message: "subject id is required for players.login-history"}}
		}
		return []any{id, limit}, nil
	},
	"players.skills": func(request QueryRequest, limit int) ([]any, []ValidationError) {
		id := strings.TrimSpace(firstNonEmpty(request.SubjectID, request.EntityID))
		if id == "" {
			return nil, []ValidationError{{Field: "subjectId", Code: "required", Message: "subject id is required for players.skills"}}
		}
		return []any{id, limit}, nil
	},
	"players.assets": func(request QueryRequest, _ int) ([]any, []ValidationError) {
		id := strings.TrimSpace(firstNonEmpty(request.SubjectID, request.EntityID))
		if id == "" {
			return nil, []ValidationError{{Field: "subjectId", Code: "required", Message: "subject id is required for players.assets"}}
		}
		return []any{id}, nil
	},
	"players.trajectory": func(request QueryRequest, limit int) ([]any, []ValidationError) {
		id := strings.TrimSpace(firstNonEmpty(request.EntityID, request.SubjectID))
		if id == "" {
			return nil, []ValidationError{{Field: "entityId", Code: "required", Message: "entity id is required for players.trajectory"}}
		}
		if request.TimeRangeStart <= 0 || request.TimeRangeEnd <= 0 || request.TimeRangeEnd < request.TimeRangeStart {
			return nil, []ValidationError{{Field: "timeRangeStart", Code: "invalid_range", Message: "valid time range is required for players.trajectory"}}
		}
		return []any{id, request.TimeRangeStart, request.TimeRangeEnd, limit}, nil
	},
	"vehicles.detail": func(request QueryRequest, _ int) ([]any, []ValidationError) {
		id := strings.TrimSpace(request.EntityID)
		if id == "" {
			return nil, []ValidationError{{Field: "entityId", Code: "required", Message: "entity id is required for vehicles.detail"}}
		}
		return []any{id}, nil
	},
}

// BuildPlan validates a SCUM.db query request and returns a bounded read-only query plan.
// request contains either a named template or allowed ad hoc SQL, allowAdHoc controls whether SQL is accepted, and the function returns a plan or validation errors.
func BuildPlan(request QueryRequest, allowAdHoc bool) (QueryPlan, []ValidationError) {
	var errs []ValidationError
	instanceID := strings.TrimSpace(request.ServerInstanceID)
	if instanceID == "" {
		errs = append(errs, ValidationError{Field: "serverInstanceId", Code: "required", Message: "server instance id is required"})
	}
	limit := request.Limit
	if limit <= 0 || limit > defaultMaxRows {
		limit = defaultMaxRows
	}
	template := strings.TrimSpace(request.Template)
	sql := strings.TrimSpace(request.SQL)
	args := append([]any(nil), request.Args...)
	if template != "" {
		templateSQL, ok := templates[template]
		if !ok {
			errs = append(errs, ValidationError{Field: "template", Code: "unknown_template", Message: "query template is not supported"})
		} else {
			sql = templateSQL
			builtArgs, buildErrs := templateArgs(request, template, limit)
			if len(buildErrs) > 0 {
				errs = append(errs, buildErrs...)
			} else {
				args = builtArgs
			}
		}
	} else if sql == "" {
		errs = append(errs, ValidationError{Field: "template", Code: "required", Message: "template is required when ad hoc SQL is absent"})
	} else if !allowAdHoc {
		errs = append(errs, ValidationError{Field: "sql", Code: "ad_hoc_disabled", Message: "ad hoc SQL is disabled for this slice"})
	} else if message := ValidateReadOnlySQL(sql); message != "" {
		errs = append(errs, ValidationError{Field: "sql", Code: "unsafe_sql", Message: message})
	}
	if len(errs) > 0 {
		return QueryPlan{}, errs
	}
	return QueryPlan{
		ServerInstanceID: instanceID,
		DatabaseRef:      DefaultDatabaseRef,
		Template:         template,
		SQL:              sql,
		Args:             args,
		MaxRows:          limit,
		MaxBytes:         defaultMaxBytes,
		TimeoutMS:        defaultTimeoutMS,
		Summary:          SQLSummary(template, sql),
	}, nil
}

// templateArgs builds positional SQL args for one named template.
// request contains route-level query context, template identifies the approved SQL, limit is the bounded row limit, and the function returns SQL args or validation errors.
func templateArgs(request QueryRequest, template string, limit int) ([]any, []ValidationError) {
	if builder, ok := templateArgumentBuilders[strings.TrimSpace(template)]; ok {
		return builder(request, limit)
	}
	return []any{limit}, nil
}

// ValidateReadOnlySQL checks whether SQL is a conservative single-statement read query.
// sql contains raw caller input, and the function returns an empty string when accepted or a sanitized validation message when rejected.
func ValidateReadOnlySQL(sql string) string {
	trimmed := strings.TrimSpace(sql)
	if trimmed == "" {
		return "query is required"
	}
	if strings.Count(trimmed, ";") > 0 {
		return "multiple statements are not allowed"
	}
	lower := strings.ToLower(trimmed)
	if !(strings.HasPrefix(lower, "select ") || strings.HasPrefix(lower, "with ")) {
		return "only select queries are allowed"
	}
	if blockedSQLPattern.MatchString(trimmed) {
		return "query contains unsafe keyword"
	}
	return ""
}

// Templates returns the approved query template map.
// It takes no parameters and returns a copy keyed by template name so callers cannot mutate package state.
func Templates() map[string]string {
	output := make(map[string]string, len(templates))
	for key, value := range templates {
		output[key] = value
	}
	return output
}

// TemplateKeys returns the supported query template keys in sorted order.
// It takes no parameters and returns stable keys for UI metadata and tests.
func TemplateKeys() []string {
	keys := make([]string, 0, len(templates))
	for key := range templates {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// SQLSummary builds a bounded audit-safe SQL summary.
// template is the selected named template when available, sql is the read-only statement, and the function returns a short value without result data or paths.
func SQLSummary(template string, sql string) string {
	if strings.TrimSpace(template) != "" {
		return "template:" + strings.TrimSpace(template)
	}
	normalized := strings.Join(strings.Fields(sql), " ")
	if len(normalized) > 160 {
		normalized = normalized[:160]
	}
	return normalized
}

// firstNonEmpty returns the first trimmed non-empty string.
// values contains ordered candidate strings, and the function returns the first non-empty value or an empty string.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// DebugTemplate renders one named SQL template for diagnostics and tests.
// template identifies the approved template, and the function returns the SQL text or a stable placeholder when it is unknown.
func DebugTemplate(template string) string {
	if value, ok := templates[strings.TrimSpace(template)]; ok {
		return value
	}
	return fmt.Sprintf("unknown:%s", strings.TrimSpace(template))
}
