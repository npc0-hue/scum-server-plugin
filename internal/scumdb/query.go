package scumdb

import (
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
	"players.summary":     "SELECT id, name, fame_points FROM prisoner ORDER BY name LIMIT ?",
	"vehicles.summary":    "SELECT id, vehicle_type, owner_prisoner_id FROM vehicle ORDER BY id LIMIT ?",
	"territories.summary": "SELECT id, name, owner_prisoner_id FROM squad ORDER BY id LIMIT ?",
	"locks.summary":       "SELECT id, lock_type, owner_prisoner_id FROM lock ORDER BY id LIMIT ?",
	"world.zones":         "SELECT id, name FROM zone ORDER BY id LIMIT ?",
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
			args = []any{limit}
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
