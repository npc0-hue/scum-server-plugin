package scumdomain

import "testing"

// TestBuildPlanCreatesReadOnlyDatabaseViewPlan verifies read views become run-side database query plans.
// t is the Go test handle, and the function fails the test when database plans expose file paths or miss limits.
func TestBuildPlanCreatesReadOnlyDatabaseViewPlan(t *testing.T) {
	plan, errs := BuildPlan(PlanRequest{Method: "GET", Route: "players", ServerInstanceID: "si-1"})
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if plan.Capability != "db.query" || plan.Permission != "scum.players.read" {
		t.Fatalf("unexpected plan metadata: %+v", plan)
	}
	if plan.SourceStrategy.Primary != "scum_run" || plan.SourceStrategy.Fallback != "" {
		t.Fatalf("unexpected source strategy for players route: %+v", plan.SourceStrategy)
	}
	queryPlan, ok := plan.Payload["queryPlan"].(map[string]any)
	if !ok {
		t.Fatalf("expected queryPlan payload, got %+v", plan.Payload)
	}
	if queryPlan["databaseRef"] != "scum-main" || queryPlan["template"] != "players.summary" {
		t.Fatalf("unexpected query plan: %+v", queryPlan)
	}
	if _, hasPath := plan.Payload["path"]; hasPath {
		t.Fatalf("database plan must not expose host paths: %+v", plan.Payload)
	}
}

// TestBuildPlanMarksDatabaseOnlyPlayerDetail verifies detail-oriented player reads stay on the run-side database source strategy.
// t is the Go test handle, and the function fails the test when player detail routes are marked client-capable.
func TestBuildPlanMarksDatabaseOnlyPlayerDetail(t *testing.T) {
	plan, errs := BuildPlan(PlanRequest{Method: "GET", Route: "players/detail", ServerInstanceID: "si-1"})
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if plan.SourceStrategy.Primary != "scum_run" || plan.SourceStrategy.Fallback != "" {
		t.Fatalf("expected players/detail to remain run-only, got %+v", plan.SourceStrategy)
	}
}

// TestBuildPlanCreatesMapTimelinePlan verifies the timeline route produces a bounded database-backed plan.
// t is the Go test handle, and the function fails the test when map timeline misses route metadata.
func TestBuildPlanCreatesMapTimelinePlan(t *testing.T) {
	plan, errs := BuildPlan(PlanRequest{Method: "GET", Route: "map/timeline", ServerInstanceID: "si-1"})
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if plan.Domain != "map" || plan.Permission != "scum.players.read" || plan.Capability != "db.query" {
		t.Fatalf("unexpected timeline plan: %+v", plan)
	}
}

// TestBuildPlanRequiresConfirmationForHighRiskRoutes verifies mutating routes require explicit confirmation.
// t is the Go test handle, and the function fails the test when a high-risk task is accepted without confirmation.
func TestBuildPlanRequiresConfirmationForHighRiskRoutes(t *testing.T) {
	_, errs := BuildPlan(PlanRequest{Method: "POST", Route: "gifts/action", ServerInstanceID: "si-1", Body: map[string]any{"giftId": "welcome"}})
	if len(errs) != 1 || errs[0].Code != "confirmation_required" {
		t.Fatalf("expected confirmation_required, got %+v", errs)
	}
	plan, errs := BuildPlan(PlanRequest{Method: "POST", Route: "gifts/action", ServerInstanceID: "si-1", Body: map[string]any{"giftId": "welcome", "confirmed": true}})
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	if plan.Capability != "task.run" || plan.RiskLevel != "high" || plan.Permission != "scum.gifts.mutate" {
		t.Fatalf("unexpected high-risk plan: %+v", plan)
	}
}

// TestCapabilityAndPermissionKeysCoverRouteSpecs verifies every route contributes manifest-facing metadata.
// t is the Go test handle, and the function fails the test when metadata extraction loses required keys.
func TestCapabilityAndPermissionKeysCoverRouteSpecs(t *testing.T) {
	if len(RouteSpecs()) < 12 {
		t.Fatalf("expected full SCUM domain route coverage, got %d", len(RouteSpecs()))
	}
	if !contains(CapabilityKeys(), "steamcmd.update") || !contains(CapabilityKeys(), "process.control") {
		t.Fatalf("expected update and restart capabilities, got %+v", CapabilityKeys())
	}
	if !contains(PermissionKeys(), "scum.gifts.mutate") || !contains(PermissionKeys(), "scum.database.query") {
		t.Fatalf("expected domain permissions, got %+v", PermissionKeys())
	}
}

// TestBuildPlanCoversEveryRouteSpec verifies every SCUM domain route dispatches through explicit permission and capability metadata.
// t is the Go test handle, and the function fails the test when a route cannot produce an authorized capability plan.
func TestBuildPlanCoversEveryRouteSpec(t *testing.T) {
	for _, spec := range RouteSpecs() {
		body := map[string]any{}
		if spec.RequiresConfirmation {
			body["confirmed"] = true
		}
		plan, errs := BuildPlan(PlanRequest{Method: spec.Method, Route: spec.Route, ServerInstanceID: "si-1", Body: body})
		if len(errs) != 0 {
			t.Fatalf("unexpected validation errors for %s %s: %+v", spec.Method, spec.Route, errs)
		}
		if plan.Permission != spec.Permission || plan.Capability != spec.Capability || plan.RiskLevel != spec.RiskLevel {
			t.Fatalf("route %s produced mismatched dispatch metadata: plan=%+v spec=%+v", spec.Route, plan, spec)
		}
		if plan.Payload["serverInstanceId"] != "si-1" || plan.Payload["route"] != spec.Route {
			t.Fatalf("route %s produced incomplete payload: %+v", spec.Route, plan.Payload)
		}
	}
}

// TestBuildPlanRedactsSensitiveBodyValues verifies capability payloads do not expose obvious secrets.
// t is the Go test handle, and the function fails the test when secret-like body fields remain in clear text.
func TestBuildPlanRedactsSensitiveBodyValues(t *testing.T) {
	plan, errs := BuildPlan(PlanRequest{
		Method:           "POST",
		Route:            "players/action",
		ServerInstanceID: "si-1",
		Body: map[string]any{
			"confirmed": true,
			"metadata":  map[string]any{"adminPassword": "secret-value", "token": "token-value"},
		},
	})
	if len(errs) != 0 {
		t.Fatalf("unexpected validation errors: %+v", errs)
	}
	metadata, ok := plan.Payload["metadata"].(map[string]any)
	if !ok {
		t.Fatalf("expected metadata payload, got %+v", plan.Payload)
	}
	if metadata["adminPassword"] != "[redacted]" || metadata["token"] != "[redacted]" {
		t.Fatalf("expected redacted sensitive metadata, got %+v", metadata)
	}
}

// contains reports whether a string slice contains a key.
// values is the candidate slice, key is the searched value, and the function returns true when key is present.
func contains(values []string, key string) bool {
	for _, value := range values {
		if value == key {
			return true
		}
	}
	return false
}
