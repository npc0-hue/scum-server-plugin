package scumconfig

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

var supportedSettings = map[string]settingRule{
	"scum.server:servername":       {section: "SCUM.Server", key: "ServerName", kind: "string", maxLength: 128, label: "服务器名称", validator: "1-128 字符"},
	"scum.server:maxplayers":       {section: "SCUM.Server", key: "MaxPlayers", kind: "int", min: 1, max: 256, label: "最大玩家数", validator: "1-256"},
	"scum.server:serverpassword":   {section: "SCUM.Server", key: "ServerPassword", kind: "string", maxLength: 128, sensitive: true, label: "服务器密码", validator: "0-128 字符"},
	"scum.server:adminpassword":    {section: "SCUM.Server", key: "AdminPassword", kind: "string", maxLength: 128, sensitive: true, label: "管理员密码", validator: "0-128 字符"},
	"scum.server:allowfirstperson": {section: "SCUM.Server", key: "AllowFirstPerson", kind: "bool", label: "允许第一人称", validator: "true / false"},
	"scum.server:allowthirdperson": {section: "SCUM.Server", key: "AllowThirdPerson", kind: "bool", label: "允许第三人称", validator: "true / false"},
	"scum.server:enablebattley":    {section: "SCUM.Server", key: "EnableBattleye", kind: "bool", label: "启用 BattlEye", validator: "true / false"},
	"scum.server:enablevac":        {section: "SCUM.Server", key: "EnableVAC", kind: "bool", label: "启用 VAC", validator: "true / false"},
}

type settingRule struct {
	// section 是配置项所在的 INI 分组名称。
	section string
	// key 是配置项在分组内的键名。
	key string
	// kind 是配置值类型，例如 string、int 或 bool。
	kind string
	// min 是整数类配置允许的最小值。
	min int
	// max 是整数类配置允许的最大值。
	max int
	// maxLength 是字符串类配置允许的最大字符数。
	maxLength int
	// sensitive 表示该配置项是否应按敏感值处理。
	sensitive bool
	// label 是前端展示使用的中文名称。
	label string
	// validator 是前端展示的校验规则摘要。
	validator string
}

// Parse parses ServerSettings.ini content into ordered sections and entries.
// content is the raw INI text returned by core file.read, and the function returns the structured document or an error when syntax is not supported.
func Parse(content string) (Document, error) {
	var document Document
	sectionIndex := -1
	for lineNumber, rawLine := range strings.Split(content, "\n") {
		line := strings.TrimSpace(strings.TrimSuffix(rawLine, "\r"))
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(line, "["), "]"))
			if name == "" {
				return Document{}, fmt.Errorf("line %d: empty section", lineNumber+1)
			}
			document.Sections = append(document.Sections, Section{Name: name})
			sectionIndex = len(document.Sections) - 1
			continue
		}
		if sectionIndex < 0 {
			return Document{}, fmt.Errorf("line %d: key outside section", lineNumber+1)
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return Document{}, fmt.Errorf("line %d: expected key=value", lineNumber+1)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return Document{}, fmt.Errorf("line %d: empty key", lineNumber+1)
		}
		document.Sections[sectionIndex].Entries = append(document.Sections[sectionIndex].Entries, Entry{Key: key, Value: strings.TrimSpace(value)})
	}
	return document, nil
}

// ApplyChanges returns ServerSettings.ini content with validated key changes applied.
// content is the current INI text, changes contains validated section/key/value edits, and the function returns updated text or an error when the file cannot be parsed or a target key is absent.
func ApplyChanges(content string, changes []Change) (string, error) {
	if _, err := Parse(content); err != nil {
		return "", err
	}
	pending := make(map[string]Change, len(changes))
	for _, change := range changes {
		pending[settingID(change.Section, change.Key)] = change
	}
	lines := strings.Split(content, "\n")
	currentSection := ""
	for index, rawLine := range lines {
		line := strings.TrimSpace(strings.TrimSuffix(rawLine, "\r"))
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(line, "["), "]"))
			continue
		}
		key, _, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		id := settingID(currentSection, strings.TrimSpace(key))
		change, exists := pending[id]
		if !exists {
			continue
		}
		lines[index] = strings.TrimSpace(key) + "=" + change.Value
		delete(pending, id)
	}
	if len(pending) > 0 {
		missing := make([]string, 0, len(pending))
		for id := range pending {
			missing = append(missing, id)
		}
		sort.Strings(missing)
		return "", fmt.Errorf("target settings not found: %s", strings.Join(missing, ", "))
	}
	return strings.Join(lines, "\n"), nil
}

// ValidateChanges validates a SCUM configuration patch request.
// request contains the target instance, expected checksum, and changed values, and the function returns a normalized patch plan or validation errors.
func ValidateChanges(request PatchRequest) (PatchPlan, []ValidationError) {
	var errs []ValidationError
	if strings.TrimSpace(request.ServerInstanceID) == "" {
		errs = append(errs, ValidationError{Field: "serverInstanceId", Code: "required", Message: "server instance id is required"})
	}
	if strings.TrimSpace(request.ExpectedChecksum) == "" {
		errs = append(errs, ValidationError{Field: "expectedChecksum", Code: "required", Message: "expected checksum is required"})
	}
	if len(request.Changes) == 0 {
		errs = append(errs, ValidationError{Field: "changes", Code: "required", Message: "at least one change is required"})
	}
	normalized := make([]Change, 0, len(request.Changes))
	seen := map[string]bool{}
	for index, change := range request.Changes {
		change.Section = strings.TrimSpace(change.Section)
		change.Key = strings.TrimSpace(change.Key)
		change.Value = strings.TrimSpace(change.Value)
		id := settingID(change.Section, change.Key)
		rule, ok := supportedSettings[id]
		field := fmt.Sprintf("changes[%d]", index)
		if !ok {
			errs = append(errs, ValidationError{Field: field, Code: "unsupported_setting", Message: "setting is not supported by this SCUM plugin slice"})
			continue
		}
		if seen[id] {
			errs = append(errs, ValidationError{Field: field, Code: "duplicate_setting", Message: "setting appears more than once"})
			continue
		}
		seen[id] = true
		if err := validateValue(rule, change.Value); err != nil {
			errs = append(errs, ValidationError{Field: field + ".value", Code: "invalid_value", Message: err.Error()})
			continue
		}
		normalized = append(normalized, change)
	}
	if len(errs) > 0 {
		return PatchPlan{}, errs
	}
	return PatchPlan{
		ServerInstanceID: strings.TrimSpace(request.ServerInstanceID),
		Path:             SettingsPath,
		ExpectedChecksum: strings.TrimSpace(request.ExpectedChecksum),
		Changes:          normalized,
		Summary:          changeSummary(normalized),
	}, nil
}

// SupportedSettings returns the allowlisted section/key identifiers for this slice.
// It takes no parameters and returns a sorted list that can be used by tests and UI metadata.
func SupportedSettings() []string {
	keys := make([]string, 0, len(supportedSettings))
	for key := range supportedSettings {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// FieldDefinitions returns the structured field metadata for plugin-owned settings surfaces.
// It takes no parameters and returns stable field definitions ordered for frontend rendering.
func FieldDefinitions() []FieldDefinition {
	definitions := make([]FieldDefinition, 0, len(supportedSettings))
	for _, rule := range supportedSettings {
		definitions = append(definitions, FieldDefinition{
			Section:   strings.TrimSpace(rule.section),
			Key:       strings.TrimSpace(rule.key),
			Label:     strings.TrimSpace(rule.label),
			Validator: strings.TrimSpace(rule.validator),
			Sensitive: rule.sensitive,
		})
	}
	sort.Slice(definitions, func(left int, right int) bool {
		if definitions[left].Section == definitions[right].Section {
			return definitions[left].Key < definitions[right].Key
		}
		return definitions[left].Section < definitions[right].Section
	})
	return definitions
}

// validateValue checks one setting value against its rule.
// rule describes the supported value type and bounds, value is the raw requested text, and the function returns an error when the value is unsafe or out of range.
func validateValue(rule settingRule, value string) error {
	if strings.ContainsAny(value, "\r\n") {
		return errors.New("value must be single line")
	}
	switch rule.kind {
	case "bool":
		switch strings.ToLower(value) {
		case "true", "false", "1", "0":
			return nil
		default:
			return errors.New("value must be boolean")
		}
	case "int":
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return errors.New("value must be integer")
		}
		if parsed < rule.min || parsed > rule.max {
			return fmt.Errorf("value must be between %d and %d", rule.min, rule.max)
		}
		return nil
	default:
		if rule.maxLength > 0 && len([]rune(value)) > rule.maxLength {
			return fmt.Errorf("value must be at most %d characters", rule.maxLength)
		}
		return nil
	}
}

// settingID builds the normalized allowlist key for a section/key pair.
// section and key are raw INI identifiers, and the function returns the lowercase lookup identifier.
func settingID(section string, key string) string {
	return strings.ToLower(strings.TrimSpace(section) + ":" + strings.TrimSpace(key))
}

// changeSummary builds a sanitized summary for audit and preview surfaces.
// changes contains validated setting changes, and the function returns a comma-separated key list without values.
func changeSummary(changes []Change) string {
	parts := make([]string, 0, len(changes))
	for _, change := range changes {
		parts = append(parts, strings.TrimSpace(change.Section)+"."+strings.TrimSpace(change.Key))
	}
	sort.Strings(parts)
	return strings.Join(parts, ", ")
}
