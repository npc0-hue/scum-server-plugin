package scumconfig

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

var supportedSettingRules = []settingRule{
	{
		section:   "General",
		key:       "scum.ServerName",
		kind:      "string",
		maxLength: 128,
		label:     "服务器名称",
		validator: "1-128 字符",
		aliases:   []settingAlias{{Section: "SCUM.Server", Key: "ServerName"}},
	},
	{
		section:   "General",
		key:       "scum.MaxPlayers",
		kind:      "int",
		min:       1,
		max:       256,
		label:     "最大玩家数",
		validator: "1-256",
		aliases:   []settingAlias{{Section: "SCUM.Server", Key: "MaxPlayers"}},
	},
	{
		section:   "General",
		key:       "scum.ServerPassword",
		kind:      "string",
		maxLength: 128,
		sensitive: true,
		label:     "服务器密码",
		validator: "0-128 字符",
		aliases:   []settingAlias{{Section: "SCUM.Server", Key: "ServerPassword"}},
	},
	{
		section:   "General",
		key:       "scum.ServerPlaystyle",
		kind:      "string",
		maxLength: 64,
		label:     "服务器玩法",
		validator: "0-64 字符",
	},
	{
		section:   "General",
		key:       "scum.WelcomeMessage",
		kind:      "string",
		maxLength: 2048,
		label:     "欢迎消息",
		validator: "0-2048 字符",
	},
	{
		section:   "General",
		key:       "scum.AllowFirstPerson",
		kind:      "bool",
		label:     "允许第一人称",
		validator: "true / false",
		aliases:   []settingAlias{{Section: "SCUM.Server", Key: "AllowFirstPerson"}},
	},
	{
		section:   "General",
		key:       "scum.AllowThirdPerson",
		kind:      "bool",
		label:     "允许第三人称",
		validator: "true / false",
		aliases:   []settingAlias{{Section: "SCUM.Server", Key: "AllowThirdPerson"}},
	},
	{
		section:   "General",
		key:       "scum.AllowCrosshair",
		kind:      "bool",
		label:     "允许准星",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowMapScreen",
		kind:      "bool",
		label:     "允许地图",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowGlobalChat",
		kind:      "bool",
		label:     "允许全局聊天",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.MaxPing",
		kind:      "float",
		label:     "最大延迟",
		validator: "数字",
	},
	{
		section:   "General",
		key:       "scum.MessageOfTheDayCooldown",
		kind:      "float",
		label:     "每日消息冷却时间",
		validator: "数字",
	},
	{
		section:   "General",
		key:       "scum.MinServerTickRate",
		kind:      "int",
		label:     "最小服务器 Tick Rate",
		validator: "整数",
	},
	{
		section:   "General",
		key:       "scum.MaxServerTickRate",
		kind:      "int",
		label:     "最大服务器 Tick Rate",
		validator: "整数",
	},
	{
		section:   "General",
		key:       "scum.LogoutTimer",
		kind:      "float",
		label:     "登出等待时间",
		validator: "数字",
	},
	{
		section:   "General",
		key:       "scum.LogoutTimerWhileCaptured",
		kind:      "float",
		label:     "被控制时登出等待时间",
		validator: "数字",
	},
	{
		section:   "General",
		key:       "scum.LogoutTimerInBunker",
		kind:      "float",
		label:     "地堡内登出等待时间",
		validator: "数字",
	},
	{
		section:   "General",
		key:       "scum.AllowVoting",
		kind:      "bool",
		label:     "允许投票",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowKillClaiming",
		kind:      "bool",
		label:     "允许击杀认领",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowComa",
		kind:      "bool",
		label:     "允许昏迷",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowMinesAndTraps",
		kind:      "bool",
		label:     "允许地雷和陷阱",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowSkillGainInSafeZones",
		kind:      "bool",
		label:     "允许在安全区获得技能经验",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowEvents",
		kind:      "bool",
		label:     "允许事件",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.LimitGlobalChat",
		kind:      "bool",
		label:     "限制全局聊天",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowLocalChat",
		kind:      "bool",
		label:     "允许本地聊天",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowSquadChat",
		kind:      "bool",
		label:     "允许小队聊天",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.AllowAdminChat",
		kind:      "bool",
		label:     "允许管理员聊天",
		validator: "true / false",
	},
	{
		section:   "General",
		key:       "scum.RustyLocksLogging",
		kind:      "bool",
		label:     "记录生锈锁日志",
		validator: "true / false",
	},
	{
		section:   "World",
		key:       "scum.MaxAllowedZombies",
		kind:      "int",
		min:       -1,
		max:       1000000,
		label:     "最大僵尸数",
		validator: "-1 到 1000000",
	},
	{
		section:   "World",
		key:       "scum.ExteriorZombieAmountModifier",
		kind:      "float",
		label:     "户外僵尸倍率",
		validator: "数字",
	},
	{
		section:   "World",
		key:       "scum.InteriorZombieAmountModifier",
		kind:      "float",
		label:     "室内僵尸倍率",
		validator: "数字",
	},
	{
		section:   "World",
		key:       "scum.WildZombieAmountModifier",
		kind:      "float",
		label:     "野外僵尸倍率",
		validator: "数字",
	},
}

var supportedSettings = buildSupportedSettings(supportedSettingRules)

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
	// aliases 是兼容旧版 section/key 请求时接受的别名列表。
	aliases []settingAlias
}

// settingAlias 表示一个受支持配置键的历史别名。
type settingAlias struct {
	// Section 是旧请求使用的 INI 分组名称。
	Section string
	// Key 是旧请求使用的配置键名称。
	Key string
}

// buildSupportedSettings builds one lookup map for canonical SCUM settings and historical aliases.
// rules contains the canonical rule list plus any accepted aliases, and the function returns a normalized lookup map or panics when duplicate identifiers exist.
func buildSupportedSettings(rules []settingRule) map[string]settingRule {
	lookup := make(map[string]settingRule, len(rules)*2)
	for _, rule := range rules {
		canonicalID := settingID(rule.section, rule.key)
		if canonicalID == "" {
			panic("scumconfig: empty canonical setting id")
		}
		if _, exists := lookup[canonicalID]; exists {
			panic("scumconfig: duplicate canonical setting id: " + canonicalID)
		}
		lookup[canonicalID] = rule
		for _, alias := range rule.aliases {
			aliasID := settingID(alias.Section, alias.Key)
			if aliasID == "" {
				panic("scumconfig: empty alias setting id")
			}
			if _, exists := lookup[aliasID]; exists {
				panic("scumconfig: duplicate alias setting id: " + aliasID)
			}
			lookup[aliasID] = rule
		}
	}
	return lookup
}

// normalizeSupportedChange maps one incoming change onto the canonical SCUM section/key pair when the setting is known.
// change contains the raw request identifiers and value, and the function returns the normalized change plus whether the setting matched the curated quick-edit catalog.
func normalizeSupportedChange(change Change) (Change, bool) {
	normalized := Change{
		Section: strings.TrimSpace(change.Section),
		Key:     strings.TrimSpace(change.Key),
		Value:   strings.TrimSpace(change.Value),
	}
	rule, ok := supportedSettings[settingID(normalized.Section, normalized.Key)]
	if !ok {
		return normalized, false
	}
	normalized.Section = rule.section
	normalized.Key = rule.key
	return normalized, true
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
		normalized, _ := normalizeSupportedChange(change)
		pending[settingID(normalized.Section, normalized.Key)] = normalized
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
// request contains the target instance, expected checksum, and either raw config text or changed values, and the function returns a normalized patch plan or validation errors.
func ValidateChanges(request PatchRequest) (PatchPlan, []ValidationError) {
	var errs []ValidationError
	if strings.TrimSpace(request.ServerInstanceID) == "" {
		errs = append(errs, ValidationError{Field: "serverInstanceId", Code: "required", Message: "server instance id is required"})
	}
	if strings.TrimSpace(request.ExpectedChecksum) == "" {
		errs = append(errs, ValidationError{Field: "expectedChecksum", Code: "required", Message: "expected checksum is required"})
	}
	rawContent := strings.TrimSpace(request.RawContent)
	if rawContent == "" && len(request.Changes) == 0 {
		errs = append(errs, ValidationError{Field: "changes", Code: "required", Message: "at least one change is required"})
	}
	if rawContent != "" {
		if _, err := Parse(request.RawContent); err != nil {
			errs = append(errs, ValidationError{Field: "rawContent", Code: "invalid_ini", Message: err.Error()})
		}
	}
	normalized := make([]Change, 0, len(request.Changes))
	seen := map[string]bool{}
	for index, change := range request.Changes {
		change, known := normalizeSupportedChange(change)
		id := settingID(change.Section, change.Key)
		field := fmt.Sprintf("changes[%d]", index)
		if seen[id] {
			errs = append(errs, ValidationError{Field: field, Code: "duplicate_setting", Message: "setting appears more than once"})
			continue
		}
		seen[id] = true
		if known {
			rule := supportedSettings[id]
			if err := validateValue(rule, change.Value); err != nil {
				errs = append(errs, ValidationError{Field: field + ".value", Code: "invalid_value", Message: err.Error()})
				continue
			}
		} else if err := validateGenericSetting(change); err != nil {
			errs = append(errs, ValidationError{Field: field + ".value", Code: "invalid_value", Message: err.Error()})
			continue
		}
		normalized = append(normalized, change)
	}
	if len(errs) > 0 {
		return PatchPlan{}, errs
	}
	summary := changeSummary(normalized)
	if rawContent != "" {
		summary = "SCUM ServerSettings.ini raw edit"
	}
	return PatchPlan{
		ServerInstanceID: strings.TrimSpace(request.ServerInstanceID),
		Path:             SettingsPath,
		ExpectedChecksum: strings.TrimSpace(request.ExpectedChecksum),
		RawContent:       request.RawContent,
		Changes:          normalized,
		Summary:          summary,
	}, nil
}

// validateGenericSetting checks an existing SCUM INI key that is not part of the curated quick-edit set.
// change contains section, key and value text from the browser editor, and the function returns an error when identifiers or single-line value bounds are unsafe.
func validateGenericSetting(change Change) error {
	if !safeSettingIdentifier(change.Section) {
		return errors.New("section name is invalid")
	}
	if !safeSettingIdentifier(change.Key) {
		return errors.New("setting key is invalid")
	}
	if strings.ContainsAny(change.Value, "\r\n") {
		return errors.New("value must be single line")
	}
	if len([]rune(change.Value)) > 4096 {
		return errors.New("value must be at most 4096 characters")
	}
	return nil
}

// safeSettingIdentifier reports whether a SCUM INI section or key name is safe for patch addressing.
// value is the raw identifier from a change request, and the function returns true only for non-empty ASCII identifiers made of letters, digits, dot, underscore or dash.
func safeSettingIdentifier(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > 128 {
		return false
	}
	for _, char := range trimmed {
		if char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '.' || char == '_' || char == '-' {
			continue
		}
		return false
	}
	return true
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
	definitions := make([]FieldDefinition, 0, len(supportedSettingRules))
	for _, rule := range supportedSettingRules {
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
	case "float":
		if _, err := strconv.ParseFloat(value, 64); err != nil {
			return errors.New("value must be number")
		}
		return nil
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
