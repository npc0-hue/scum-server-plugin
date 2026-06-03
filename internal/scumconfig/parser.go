package scumconfig

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

var supportedSettings = map[string]settingRule{
	"scum.server:servername":       {kind: "string", maxLength: 128},
	"scum.server:maxplayers":       {kind: "int", min: 1, max: 256},
	"scum.server:serverpassword":   {kind: "string", maxLength: 128, sensitive: true},
	"scum.server:adminpassword":    {kind: "string", maxLength: 128, sensitive: true},
	"scum.server:allowfirstperson": {kind: "bool"},
	"scum.server:allowthirdperson": {kind: "bool"},
	"scum.server:enablebattley":    {kind: "bool"},
	"scum.server:enablevac":        {kind: "bool"},
}

type settingRule struct {
	kind      string
	min       int
	max       int
	maxLength int
	sensitive bool
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
