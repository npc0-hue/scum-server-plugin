package pluginclient

import (
	"encoding/json"
	"net/http"
	"testing"
)

// TestHandlerBuildsSettingsReadPlan verifies GET settings returns a file.read capability plan.
// t is the Go test handle, and the function fails the test when the route response is malformed.
func TestHandlerBuildsSettingsReadPlan(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/settings", nil))
	if response.StatusCode != http.StatusAccepted {
		t.Fatalf("expected accepted response, got %+v", response)
	}
	var plan CapabilityPlanResponse
	if err := json.Unmarshal(response.Body, &plan); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if plan.Capability != "file.read" || plan.Operation != "read" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

// TestHandlerRejectsUnsafeDatabaseQuery verifies database mutation attempts are rejected by plugin validation.
// t is the Go test handle, and the function fails the test when unsafe SQL gets a capability plan.
func TestHandlerRejectsUnsafeDatabaseQuery(t *testing.T) {
	body, _ := json.Marshal(map[string]any{"sql": "DELETE FROM prisoner"})
	handler := NewHandler(true)
	response := handler.Handle(command(http.MethodPost, "/database/query", body))
	if response.StatusCode != http.StatusBadRequest || response.Error == nil || response.Error.Code != "validation_failed" {
		t.Fatalf("expected validation failure, got %+v", response)
	}
}

// TestHandlerBuildsSettingsPatchPlan verifies PATCH settings returns a file.patch capability plan for valid changes.
// t is the Go test handle, and the function fails the test when a valid diff is rejected.
func TestHandlerBuildsSettingsPatchPlan(t *testing.T) {
	body, _ := json.Marshal(map[string]any{
		"expectedChecksum": "sha256:old",
		"changes": []map[string]any{{
			"section": "SCUM.Server",
			"key":     "MaxPlayers",
			"value":   "128",
		}},
	})
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodPatch, "/settings", body))
	if response.StatusCode != http.StatusAccepted {
		t.Fatalf("expected accepted response, got %+v", response)
	}
	var plan CapabilityPlanResponse
	if err := json.Unmarshal(response.Body, &plan); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if plan.Capability != "file.patch" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

// command builds a plugin API command for handler tests.
// method and route define the gateway request, body is the JSON request payload, and the function returns a command with instance context.
func command(method string, route string, body []byte) APICommand {
	return APICommand{
		RequestID:   "req-1",
		TraceID:     "trace-1",
		Method:      method,
		RouteSuffix: route,
		Body:        body,
		Instance:    &APIInstanceContext{ServerInstanceID: "si-1", RequiredPermission: "read"},
	}
}
