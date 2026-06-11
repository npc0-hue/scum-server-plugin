package pluginclient

import (
	"encoding/json"
	"net/http"
	"testing"

	"scum_admin_plugin/internal/scumdomain"
)

// TestHandlerBuildsSettingsReadPlan verifies GET settings returns a domain envelope with a file.read dispatch plan.
// t is the Go test handle, and the function fails the test when the route response is malformed or plan-only.
func TestHandlerBuildsSettingsReadPlan(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/settings", nil))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "domain_result" || envelope.DispatchPlan == nil {
		t.Fatalf("expected domain result with dispatch plan, got %+v", envelope)
	}
	if envelope.DispatchPlan.Capability != "file.read" || envelope.DispatchPlan.Operation != "read" {
		t.Fatalf("unexpected dispatch plan: %+v", envelope.DispatchPlan)
	}
}

// TestHandlerBuildsDomainReadPlan verifies a SCUM domain read route returns a stable unavailable envelope with dispatch metadata.
// t is the Go test handle, and the function fails the test when a route bypasses the capability boundary or returns raw plan only.
func TestHandlerBuildsDomainReadPlan(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/players", nil))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "unavailable" || envelope.State != "unavailable" || envelope.DispatchPlan == nil {
		t.Fatalf("expected unavailable domain envelope, got %+v", envelope)
	}
	if envelope.DispatchPlan.Capability != "db.query" || envelope.DispatchPlan.Operation != "query" {
		t.Fatalf("unexpected dispatch plan wrapper: %+v", envelope.DispatchPlan)
	}
	payload, ok := envelope.DispatchPlan.Payload.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload, got %+v", envelope.DispatchPlan.Payload)
	}
	if payload["permission"] != "scum.players.read" || payload["domain"] != "players" {
		t.Fatalf("unexpected domain payload: %+v", payload)
	}
}

// TestHandlerRejectsHighRiskDomainMutationWithoutConfirmation verifies high-risk plans require confirmation.
// t is the Go test handle, and the function fails the test when a mutating route can dispatch silently.
func TestHandlerRejectsHighRiskDomainMutationWithoutConfirmation(t *testing.T) {
	body, _ := json.Marshal(map[string]any{"giftId": "welcome"})
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodPost, "/gifts/action", body))
	if response.StatusCode != http.StatusBadRequest || response.Error == nil || response.Error.Code != "validation_failed" {
		t.Fatalf("expected validation failure, got %+v", response)
	}
}

// TestHandlerBuildsHighRiskDomainMutationWithConfirmation verifies confirmed high-risk routes become task plans.
// t is the Go test handle, and the function fails the test when a confirmed mutation lacks permission metadata.
func TestHandlerBuildsHighRiskDomainMutationWithConfirmation(t *testing.T) {
	body, _ := json.Marshal(map[string]any{"giftId": "welcome", "confirmed": true})
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodPost, "/gifts/action", body))
	if response.StatusCode != http.StatusAccepted {
		t.Fatalf("expected accepted response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "operation_handle" || envelope.Operation == nil || envelope.DispatchPlan == nil {
		t.Fatalf("expected operation handle response, got %+v", envelope)
	}
	payloadBytes, _ := json.Marshal(envelope.DispatchPlan.Payload)
	var payload scumdomain.CapabilityPlan
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatalf("decode domain plan: %v", err)
	}
	if payload.Capability != "task.run" || payload.Permission != "scum.gifts.mutate" || payload.RiskLevel != "high" {
		t.Fatalf("unexpected domain plan: %+v", payload)
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
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "operation_handle" || envelope.DispatchPlan == nil || envelope.DispatchPlan.Capability != "file.patch" {
		t.Fatalf("unexpected operation envelope: %+v", envelope)
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
