package scumconfig

import "testing"

// TestParseServerSettings verifies supported INI content is parsed into ordered sections and entries.
// t is the Go test handle, and the function fails the test when parsing loses section or key data.
func TestParseServerSettings(t *testing.T) {
	document, err := Parse("[SCUM.Server]\nServerName=Demo\nMaxPlayers=64\n")
	if err != nil {
		t.Fatalf("parse settings: %v", err)
	}
	if len(document.Sections) != 1 || document.Sections[0].Name != "SCUM.Server" {
		t.Fatalf("unexpected sections: %+v", document.Sections)
	}
	if len(document.Sections[0].Entries) != 2 || document.Sections[0].Entries[1].Value != "64" {
		t.Fatalf("unexpected entries: %+v", document.Sections[0].Entries)
	}
}

// TestValidateChangesRejectsUnsupportedSetting verifies unsupported config keys are rejected before mutation.
// t is the Go test handle, and the function fails the test when an unsupported key is accepted.
func TestValidateChangesRejectsUnsupportedSetting(t *testing.T) {
	_, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "SCUM.Server", Key: "Unknown", Value: "x"}},
	})
	if len(errs) != 1 || errs[0].Code != "unsupported_setting" {
		t.Fatalf("expected unsupported_setting, got %+v", errs)
	}
}

// TestValidateChangesBuildsPatchPlan verifies valid settings produce an audit-safe patch plan.
// t is the Go test handle, and the function fails the test when required plan metadata is missing.
func TestValidateChangesBuildsPatchPlan(t *testing.T) {
	plan, errs := ValidateChanges(PatchRequest{
		ServerInstanceID: "si-1",
		ExpectedChecksum: "sha256:old",
		Changes:          []Change{{Section: "SCUM.Server", Key: "MaxPlayers", Value: "128"}},
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %+v", errs)
	}
	if plan.Path != SettingsPath || plan.Summary != "SCUM.Server.MaxPlayers" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

// TestApplyChangesUpdatesExistingKey verifies config updates preserve the INI shape while changing a supported key.
// t is the Go test handle, and the function fails the test when the target key is not updated.
func TestApplyChangesUpdatesExistingKey(t *testing.T) {
	updated, err := ApplyChanges("[SCUM.Server]\nMaxPlayers=64\n", []Change{{Section: "SCUM.Server", Key: "MaxPlayers", Value: "128"}})
	if err != nil {
		t.Fatalf("apply changes: %v", err)
	}
	if updated != "[SCUM.Server]\nMaxPlayers=128\n" {
		t.Fatalf("unexpected updated content: %q", updated)
	}
}
