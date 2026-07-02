package scumconfig

import (
	"strings"
	"testing"
)

// TestParseServerSettings verifies supported INI content is parsed into ordered sections and entries.
// t is the Go test handle, and the function fails the test when parsing loses section or key data.
func TestParseServerSettings(t *testing.T) {
	document, err := Parse("[General]\nscum.ServerName=Demo\nscum.MaxPlayers=64\n")
	if err != nil {
		t.Fatalf("parse settings: %v", err)
	}
	if len(document.Sections) != 1 || document.Sections[0].Name != "General" {
		t.Fatalf("unexpected sections: %+v", document.Sections)
	}
	if len(document.Sections[0].Entries) != 2 || document.Sections[0].Entries[1].Value != "64" {
		t.Fatalf("unexpected entries: %+v", document.Sections[0].Entries)
	}
}

// TestValidateChangesNormalizesLegacyAlias verifies historical SCUM.Server quick-edit requests map onto the real ServerSettings.ini keys.
// t is the Go test handle, and the function fails the test when legacy aliases do not normalize to canonical section/key pairs.
func TestValidateChangesNormalizesLegacyAlias(t *testing.T) {
	plan, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "SCUM.Server", Key: "MaxPlayers", Value: "128"}},
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %+v", errs)
	}
	if len(plan.Changes) != 1 || plan.Changes[0].Section != "General" || plan.Changes[0].Key != "scum.MaxPlayers" {
		t.Fatalf("expected legacy alias normalization, got %+v", plan.Changes)
	}
}

// TestValidateChangesRejectsUnsafeGenericSetting verifies unsafe generic config keys are rejected before mutation.
// t is the Go test handle, and the function fails the test when an unsafe key is accepted.
func TestValidateChangesRejectsUnsafeGenericSetting(t *testing.T) {
	_, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "SCUM.Server", Key: "Unknown Key", Value: "x"}},
	})
	if len(errs) != 1 || errs[0].Code != "invalid_value" {
		t.Fatalf("expected invalid_value, got %+v", errs)
	}
}

// TestValidateChangesBuildsPatchPlan verifies valid settings produce an audit-safe patch plan.
// t is the Go test handle, and the function fails the test when required plan metadata is missing.
func TestValidateChangesBuildsPatchPlan(t *testing.T) {
	plan, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "General", Key: "scum.MaxPlayers", Value: "128"}},
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %+v", errs)
	}
	if plan.Path != SettingsPath || plan.Summary != "General.scum.MaxPlayers" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

// TestValidateChangesBuildsGenericPatchPlan verifies browser-edited SCUM settings outside the quick-edit list are accepted when safe.
// t is the Go test handle, and the function fails the test when a valid generic INI key is rejected.
func TestValidateChangesBuildsGenericPatchPlan(t *testing.T) {
	plan, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "World", Key: "scum.SpawnerProbabilityMultiplier", Value: "2.5"}},
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %+v", errs)
	}
	if plan.Summary != "World.scum.SpawnerProbabilityMultiplier" {
		t.Fatalf("unexpected plan summary: %+v", plan)
	}
}

// TestValidateChangesBuildsRawContentPatchPlan verifies full-text editor saves can submit validated SCUM INI content directly.
// t is the Go test handle, and the function fails the test when raw content is rejected or lost from the patch plan.
func TestValidateChangesBuildsRawContentPatchPlan(t *testing.T) {
	content := "[General]\nscum.ServerName=Demo\nscum.MaxPlayers=128\n"
	plan, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		RawContent:       content,
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %+v", errs)
	}
	if plan.RawContent != content || plan.Summary != "SCUM ServerSettings.ini raw edit" {
		t.Fatalf("unexpected raw-content plan: %+v", plan)
	}
}

// TestValidateChangesRejectsInvalidRawContent verifies malformed full-text SCUM edits fail before dispatch.
// t is the Go test handle, and the function fails the test when invalid INI content is accepted.
func TestValidateChangesRejectsInvalidRawContent(t *testing.T) {
	_, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		RawContent:       "ServerName=Demo\n",
	})
	if len(errs) != 1 || errs[0].Field != "rawContent" || errs[0].Code != "invalid_ini" {
		t.Fatalf("expected rawContent invalid_ini error, got %+v", errs)
	}
}

// TestApplyChangesUpdatesExistingKey verifies config updates preserve the INI shape while changing a supported key.
// t is the Go test handle, and the function fails the test when the target key is not updated.
func TestApplyChangesUpdatesExistingKey(t *testing.T) {
	updated, err := ApplyChanges("[General]\nscum.MaxPlayers=64\n", []Change{{Section: "General", Key: "scum.MaxPlayers", Value: "128"}})
	if err != nil {
		t.Fatalf("apply changes: %v", err)
	}
	if updated != "[General]\nscum.MaxPlayers=128\n" {
		t.Fatalf("unexpected updated content: %q", updated)
	}
}

// TestApplyChangesSupportsLegacyAlias verifies old quick-edit payloads can still update real SCUM config keys in-place.
// t is the Go test handle, and the function fails the test when an alias-based update does not hit the canonical file line.
func TestApplyChangesSupportsLegacyAlias(t *testing.T) {
	updated, err := ApplyChanges("[General]\nscum.MaxPlayers=64\n", []Change{{Section: "SCUM.Server", Key: "MaxPlayers", Value: "128"}})
	if err != nil {
		t.Fatalf("apply alias changes: %v", err)
	}
	if updated != "[General]\nscum.MaxPlayers=128\n" {
		t.Fatalf("unexpected alias-updated content: %q", updated)
	}
}

// TestFieldDefinitionsIncludeLocalizedGeneralSettings verifies frequently used General settings expose Chinese labels to the frontend.
// t is the Go test handle, and the function fails the test when the structured field catalog falls back to raw English keys for curated settings.
func TestFieldDefinitionsIncludeLocalizedGeneralSettings(t *testing.T) {
	definitions := FieldDefinitions()
	labelsByKey := make(map[string]string, len(definitions))
	for _, definition := range definitions {
		labelsByKey[strings.TrimSpace(definition.Key)] = strings.TrimSpace(definition.Label)
	}
	for key, wantLabel := range map[string]string{
		"scum.MessageOfTheDayCooldown":   "每日消息冷却时间",
		"scum.MinServerTickRate":         "最小服务器 Tick Rate",
		"scum.MaxServerTickRate":         "最大服务器 Tick Rate",
		"scum.LogoutTimer":               "登出等待时间",
		"scum.LogoutTimerWhileCaptured":  "被控制时登出等待时间",
		"scum.LogoutTimerInBunker":       "地堡内登出等待时间",
		"scum.AllowVoting":               "允许投票",
		"scum.AllowKillClaiming":         "允许击杀认领",
		"scum.AllowComa":                 "允许昏迷",
		"scum.AllowMinesAndTraps":        "允许地雷和陷阱",
		"scum.AllowSkillGainInSafeZones": "允许在安全区获得技能经验",
		"scum.AllowEvents":               "允许事件",
		"scum.LimitGlobalChat":           "限制全局聊天",
		"scum.AllowLocalChat":            "允许本地聊天",
		"scum.AllowSquadChat":            "允许小队聊天",
		"scum.AllowAdminChat":            "允许管理员聊天",
		"scum.RustyLocksLogging":         "记录生锈锁日志",
	} {
		if gotLabel := labelsByKey[key]; gotLabel != wantLabel {
			t.Fatalf("expected %s label %q, got %q", key, wantLabel, gotLabel)
		}
	}
}
