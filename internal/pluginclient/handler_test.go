package pluginclient

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"scum_admin_plugin/internal/scumdomain"
	"scum_admin_plugin/internal/scumfiles"
)

// TestHandlerBuildsSettingsReadMetadata verifies GET settings returns plugin-owned workspace metadata.
// t is the Go test handle, and the function fails the test when the route response is malformed or missing workspace data.
func TestHandlerBuildsSettingsReadMetadata(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/settings", nil))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "domain_result" || envelope.DispatchPlan != nil {
		t.Fatalf("expected domain result without dispatch plan, got %+v", envelope)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected workspace metadata, got %+v", envelope.Data)
	}
	workspaces, ok := data["workspaces"].([]any)
	if !ok || len(workspaces) == 0 {
		t.Fatalf("expected settings workspaces, got %+v", data)
	}
	supportedFiles, ok := data["supportedFiles"].([]any)
	if !ok {
		t.Fatalf("expected supported config files, got %+v", data)
	}
	gotSupportedFiles := make([]string, 0, len(supportedFiles))
	for _, item := range supportedFiles {
		text, ok := item.(string)
		if !ok {
			t.Fatalf("expected string supported file, got %#v", item)
		}
		gotSupportedFiles = append(gotSupportedFiles, text)
	}
	if !reflect.DeepEqual(gotSupportedFiles, scumfiles.SupportedConfigFiles()) {
		t.Fatalf("unexpected supported config files: got %+v want %+v", gotSupportedFiles, scumfiles.SupportedConfigFiles())
	}
}

// TestHandlerBuildsLogsReadMetadata verifies GET logs returns plugin-owned workspace metadata.
// t is the Go test handle, and the function fails the test when the route response is malformed or missing workspace data.
func TestHandlerBuildsLogsReadMetadata(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/logs", nil))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Kind != "domain_result" || envelope.DispatchPlan != nil {
		t.Fatalf("expected domain result without dispatch plan, got %+v", envelope)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected workspace metadata, got %+v", envelope.Data)
	}
	workspaces, ok := data["workspaces"].([]any)
	if !ok || len(workspaces) == 0 {
		t.Fatalf("expected log workspaces, got %+v", data)
	}
	structuredFields, exists := data["structuredFields"]
	if exists && structuredFields != nil {
		t.Fatalf("expected logs metadata to omit structured fields, got %+v", data)
	}
	if data["structuredPath"] != "SCUM/Saved/Config/WindowsServer/ServerSettings.ini" {
		t.Fatalf("expected logs metadata to keep canonical structured path, got %+v", data)
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
	data, ok := envelope.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected data placeholder, got %+v", envelope.Data)
	}
	source, ok := data["source"].(map[string]any)
	if !ok || source["kind"] != "scum_run" || source["mode"] != "primary" {
		t.Fatalf("unexpected source placeholder: %+v", data)
	}
	if _, ok := source["fallback"]; ok {
		t.Fatalf("expected single-source route metadata without fallback, got %+v", data)
	}
}

// TestHandlerBuildsPlayerDetailPlan verifies structured player detail reads expose a query plan and source summary.
// t is the Go test handle, and the function fails the test when detail reads lack stable placeholder metadata.
func TestHandlerBuildsPlayerDetailPlan(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(commandWithQuery(http.MethodGet, "/players/detail", nil, map[string][]string{"entityId": {"12"}}))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.DispatchPlan == nil || envelope.DispatchPlan.Capability != "db.query" {
		t.Fatalf("expected db.query dispatch, got %+v", envelope)
	}
	payloadBytes, _ := json.Marshal(envelope.DispatchPlan.Payload)
	var payload scumdomain.CapabilityPlan
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatalf("decode domain plan: %v", err)
	}
	queryPlan, ok := payload.Payload["queryPlan"].(map[string]any)
	if !ok || queryPlan["template"] != "players.detail" {
		t.Fatalf("unexpected query plan: %+v", payload.Payload)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok || data["view"] != "detail" {
		t.Fatalf("unexpected placeholder data: %+v", envelope.Data)
	}
	source, ok := data["source"].(map[string]any)
	if !ok || source["fallback"] != nil {
		t.Fatalf("expected detail route to stay database-only, got %+v", data)
	}
}

// TestHandlerBuildsTrajectoryMapPlan verifies the map timeline route returns a map placeholder with dispatch metadata.
// t is the Go test handle, and the function fails the test when the route lacks grouped layer placeholder data.
func TestHandlerBuildsTrajectoryMapPlan(t *testing.T) {
	handler := NewHandler(false)
	response := handler.Handle(command(http.MethodGet, "/map/timeline", nil))
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected ok response, got %+v", response)
	}
	var envelope DomainAPIResponse
	if err := json.Unmarshal(response.Body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok || data["view"] != "map" {
		t.Fatalf("expected map placeholder, got %+v", envelope.Data)
	}
	layers, ok := data["layers"].(map[string]any)
	if !ok || layers["players"] == nil || layers["vehicles"] == nil || layers["supplies"] == nil {
		t.Fatalf("expected grouped layer placeholder, got %+v", data)
	}
}

// TestHandlerBuildsSquadDetailPlans verifies squad detail routes expose list placeholders and database templates.
// t is the Go test handle, and the function fails the test when members or vehicles routes lack template metadata.
func TestHandlerBuildsSquadDetailPlans(t *testing.T) {
	handler := NewHandler(false)
	for _, route := range []string{"/squads/members", "/squads/vehicles"} {
		response := handler.Handle(commandWithQuery(http.MethodGet, route, nil, map[string][]string{"squadId": {"9"}}))
		if response.StatusCode != http.StatusOK {
			t.Fatalf("expected ok response for %s, got %+v", route, response)
		}
		var envelope DomainAPIResponse
		if err := json.Unmarshal(response.Body, &envelope); err != nil {
			t.Fatalf("decode response for %s: %v", route, err)
		}
		if envelope.DispatchPlan == nil || envelope.DispatchPlan.Capability != "db.query" {
			t.Fatalf("expected db.query dispatch for %s, got %+v", route, envelope)
		}
		payloadBytes, _ := json.Marshal(envelope.DispatchPlan.Payload)
		var payload scumdomain.CapabilityPlan
		if err := json.Unmarshal(payloadBytes, &payload); err != nil {
			t.Fatalf("decode domain plan for %s: %v", route, err)
		}
		queryPlan, ok := payload.Payload["queryPlan"].(map[string]any)
		if !ok || queryPlan["template"] == "" {
			t.Fatalf("unexpected query plan for %s: %+v", route, payload.Payload)
		}
		data, ok := envelope.Data.(map[string]any)
		if !ok || data["view"] != "list" {
			t.Fatalf("expected list placeholder for %s, got %+v", route, envelope.Data)
		}
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
			"section": "General",
			"key":     "scum.MaxPlayers",
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

// TestHandlerBuildsSettingsPatchPlanFromLegacyAlias verifies legacy quick-edit aliases still normalize to the canonical ServerSettings.ini key.
// t is the Go test handle, and the function fails the test when historical aliases no longer produce a valid patch plan.
func TestHandlerBuildsSettingsPatchPlanFromLegacyAlias(t *testing.T) {
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
	payload, ok := envelope.DispatchPlan.Payload.(map[string]any)
	if !ok {
		t.Fatalf("expected object payload, got %+v", envelope.DispatchPlan.Payload)
	}
	changes, ok := payload["changes"].([]any)
	if !ok || len(changes) != 1 {
		t.Fatalf("expected normalized change payload, got %+v", payload)
	}
	change, ok := changes[0].(map[string]any)
	if !ok || change["section"] != "General" || change["key"] != "scum.MaxPlayers" {
		t.Fatalf("expected canonical change payload, got %+v", change)
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

// commandWithQuery builds a plugin API command with query parameters for handler tests.
// method and route define the gateway request, body is the JSON request payload, query contains URL params, and the function returns a command with instance context.
func commandWithQuery(method string, route string, body []byte, query map[string][]string) APICommand {
	cmd := command(method, route, body)
	cmd.Query = query
	return cmd
}
