package scumdb

import "testing"

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
