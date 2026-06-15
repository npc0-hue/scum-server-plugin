package scumdb

import (
	"strings"
	"testing"
)

// TestBuildPlanUsesApprovedTemplate verifies named query templates become bounded read-only plans.
// t is the Go test handle, and the function fails the test when template metadata is missing.
func TestBuildPlanUsesApprovedTemplate(t *testing.T) {
	plan, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.summary", Limit: 20}, false)
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if plan.DatabaseRef != DefaultDatabaseRef || plan.Template != "players.summary" || plan.MaxRows != 20 || plan.Summary != "template:players.summary" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

// TestBuildPlanUsesPlayerTemplateAliases verifies the player summary template emits frontend-facing column aliases.
// t is the Go test handle, and the function fails the test when the named template drifts away from the player page contract.
func TestBuildPlanUsesPlayerTemplateAliases(t *testing.T) {
	plan, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.summary", Limit: 20}, false)
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	for _, expected := range []string{"AS name", "AS steamId", "AS status", "AS lastSeen", "LEFT JOIN user_profile"} {
		if !strings.Contains(plan.SQL, expected) {
			t.Fatalf("expected players.summary SQL to contain %q, got %s", expected, plan.SQL)
		}
	}
}

// TestBuildPlanRequiresEntityForDetailTemplates verifies detail templates enforce stable identity parameters.
// t is the Go test handle, and the function fails the test when detail templates can be built without required IDs.
func TestBuildPlanRequiresEntityForDetailTemplates(t *testing.T) {
	_, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.detail"}, false)
	if len(errs) != 1 || errs[0].Code != "required" {
		t.Fatalf("expected required error, got %+v", errs)
	}
	plan, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.detail", EntityID: "42"}, false)
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if len(plan.Args) != 1 || plan.Args[0] != "42" {
		t.Fatalf("expected entity arg, got %+v", plan.Args)
	}
}

// TestBuildPlanUsesTrajectoryRange verifies trajectory templates require and preserve a bounded time range.
// t is the Go test handle, and the function fails the test when range metadata is missing or misordered.
func TestBuildPlanUsesTrajectoryRange(t *testing.T) {
	_, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.trajectory", EntityID: "7"}, false)
	if len(errs) != 1 || errs[0].Code != "invalid_range" {
		t.Fatalf("expected invalid_range, got %+v", errs)
	}
	plan, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", Template: "players.trajectory", EntityID: "7", TimeRangeStart: 10, TimeRangeEnd: 20, Limit: 15}, false)
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if len(plan.Args) != 4 || plan.Args[0] != "7" || plan.Args[1] != int64(10) || plan.Args[2] != int64(20) || plan.Args[3] != 15 {
		t.Fatalf("unexpected trajectory args: %+v", plan.Args)
	}
}

// TestBuildPlanRejectsAdHocByDefault verifies production policy does not accept raw SQL.
// t is the Go test handle, and the function fails the test when ad hoc SQL is accepted while disabled.
func TestBuildPlanRejectsAdHocByDefault(t *testing.T) {
	_, errs := BuildPlan(QueryRequest{ServerInstanceID: "si-1", SQL: "SELECT * FROM prisoner"}, false)
	if len(errs) != 1 || errs[0].Code != "ad_hoc_disabled" {
		t.Fatalf("expected ad_hoc_disabled, got %+v", errs)
	}
}

// TestValidateReadOnlySQLRejectsUnsafeStatements verifies mutating SQL is rejected before dispatch.
// t is the Go test handle, and the function fails the test when unsafe SQL passes validation.
func TestValidateReadOnlySQLRejectsUnsafeStatements(t *testing.T) {
	for _, sql := range []string{"UPDATE prisoner SET name = 'x'", "SELECT * FROM a; SELECT * FROM b", "PRAGMA journal_mode=WAL"} {
		if message := ValidateReadOnlySQL(sql); message == "" {
			t.Fatalf("expected unsafe SQL to be rejected: %s", sql)
		}
	}
}

// TestValidateReadOnlySQLAcceptsSelect verifies simple read-only SELECT statements can pass when ad hoc is enabled.
// t is the Go test handle, and the function fails the test when a safe SELECT is rejected.
func TestValidateReadOnlySQLAcceptsSelect(t *testing.T) {
	if message := ValidateReadOnlySQL("SELECT id, name FROM prisoner LIMIT 10"); message != "" {
		t.Fatalf("expected SELECT to be accepted, got %q", message)
	}
}
