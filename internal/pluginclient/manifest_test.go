package pluginclient

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"scum_admin_plugin/internal/scumdomain"
)

// TestManifestDeclaresFullScumDomainPermissions verifies manifest exposes per-domain permissions and capabilities.
// t is the Go test handle, and the function fails the test when high-risk or run-side database declarations are missing.
func TestManifestDeclaresFullScumDomainPermissions(t *testing.T) {
	manifest := readManifest(t)
	capabilities := keyedObjects(t, manifest["capabilities"])
	for _, key := range []string{"file.read", "file.patch", "db.query", "process.control", "steam.news", "steamcmd.update", "task.query", "task.run"} {
		if _, ok := capabilities[key]; !ok {
			t.Fatalf("manifest missing capability %s", key)
		}
	}
	dbQuery := capabilities["db.query"]
	parameters, _ := dbQuery["parameters"].(map[string]any)
	if parameters["execution"] != "bound-run-endpoint" || parameters["readOnly"] != true {
		t.Fatalf("db.query must be run-side read-only, got %+v", parameters)
	}
	permissions := keyedObjects(t, manifest["permissions"])
	for _, key := range []string{"scum.config.read", "scum.config.patch", "scum.database.query", "scum.players.read", "scum.players.mutate", "scum.vehicles.read", "scum.territories.read", "scum.locks.read", "scum.gifts.mutate", "scum.events.mutate", "scum.economy.read", "scum.logs.read", "scum.steam.read", "scum.update.mutate", "scum.restart.mutate", "scum.tasks.read"} {
		if _, ok := permissions[key]; !ok {
			t.Fatalf("manifest missing permission %s", key)
		}
	}
	for _, key := range []string{"scum.config.patch", "scum.players.mutate", "scum.gifts.mutate", "scum.events.mutate", "scum.update.mutate", "scum.restart.mutate"} {
		if permissions[key]["riskLevel"] != "high" {
			t.Fatalf("permission %s must be high risk, got %+v", key, permissions[key])
		}
	}
}

// TestManifestDeclaresPluginOwnedFrontendRoutes verifies SCUM routes are delivered through plugin metadata with migration status.
// t is the Go test handle, and the function fails the test when routes lack status or non-migrated routes are exposed as normal menus.
func TestManifestDeclaresPluginOwnedFrontendRoutes(t *testing.T) {
	manifest := readManifest(t)
	frontend, _ := manifest["frontend"].(map[string]any)
	menus := keyedObjects(t, frontend["menus"])
	routes := keyedObjects(t, frontend["routes"])
	for _, key := range []string{"settings", "database", "players", "trajectory-map", "vehicles", "territories", "locks", "gifts", "events", "economy", "logs", "steam", "update", "tasks"} {
		route, ok := routes[key]
		if !ok {
			t.Fatalf("manifest missing frontend route %s", key)
		}
		if route["bundleEntry"] != "main" {
			t.Fatalf("route %s must load plugin bundle entry, got %+v", key, route)
		}
		if route["migrationStatus"] == "" || route["domainOwner"] == "" {
			t.Fatalf("route %s must declare migration status and owner, got %+v", key, route)
		}
	}
	for _, key := range []string{"settings", "players", "trajectory-map", "gifts", "update", "tasks"} {
		if _, ok := menus[key]; !ok {
			t.Fatalf("manifest missing first-tranche menu %s", key)
		}
		if routes[key]["visibility"] != "normal" || routes[key]["migrationStatus"] != "migrated" {
			t.Fatalf("first-tranche route %s must be normal migrated, got %+v", key, routes[key])
		}
	}
	if _, ok := menus["logs"]; ok {
		t.Fatalf("logs must not be advertised as a normal menu once merged into settings, got %+v", menus["logs"])
	}
	if routes["logs"]["visibility"] != "direct" {
		t.Fatalf("logs route should remain direct-only after merging into settings, got %+v", routes["logs"])
	}
	for _, key := range []string{"vehicles", "territories", "locks", "events", "economy", "steam"} {
		if _, ok := menus[key]; ok {
			t.Fatalf("not-migrated route %s must not be advertised as a normal menu", key)
		}
		if routes[key]["visibility"] != "direct" {
			t.Fatalf("not-migrated route %s should remain direct-only, got %+v", key, routes[key])
		}
	}
}

// TestManifestAPIRoutesCoverDomainPlanner verifies manifest API route metadata matches domain capability routing.
// t is the Go test handle, and the function fails the test when a planner route is missing from manifest API metadata.
func TestManifestAPIRoutesCoverDomainPlanner(t *testing.T) {
	manifest := readManifest(t)
	api, _ := manifest["api"].(map[string]any)
	routes := apiRoutes(t, api["routes"])
	for _, spec := range scumdomain.RouteSpecs() {
		key := spec.Method + " " + "/" + spec.Route
		route, ok := routes[key]
		if !ok {
			t.Fatalf("manifest missing API route %s", key)
		}
		requiredPermissions, ok := route["requiredPermissions"].([]any)
		if !ok || len(requiredPermissions) != 1 || requiredPermissions[0] != spec.Permission {
			t.Fatalf("route %s must require %s, got %+v", key, spec.Permission, route["requiredPermissions"])
		}
	}
}

// readManifest loads the plugin manifest from disk for contract tests.
// t is the Go test handle, and the function returns a decoded object or fails the test on file/JSON errors.
func readManifest(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "manifest.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var manifest map[string]any
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatalf("decode manifest: %v", err)
	}
	return manifest
}

// keyedObjects converts a manifest array of objects with key fields into a map.
// t is the Go test handle, value is the decoded JSON array, and the function returns keyed objects or fails on malformed data.
func keyedObjects(t *testing.T, value any) map[string]map[string]any {
	t.Helper()
	items, ok := value.([]any)
	if !ok {
		t.Fatalf("expected array, got %+v", value)
	}
	output := map[string]map[string]any{}
	for _, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected object item, got %+v", item)
		}
		key, ok := object["key"].(string)
		if !ok || key == "" {
			t.Fatalf("expected keyed item, got %+v", object)
		}
		output[key] = object
	}
	return output
}

// apiRoutes converts manifest API route metadata into a method/path keyed map.
// t is the Go test handle, value is the decoded routes array, and the function returns route objects or fails on malformed metadata.
func apiRoutes(t *testing.T, value any) map[string]map[string]any {
	t.Helper()
	items, ok := value.([]any)
	if !ok {
		t.Fatalf("expected api routes array, got %+v", value)
	}
	output := map[string]map[string]any{}
	for _, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected api route object, got %+v", item)
		}
		method, methodOK := object["method"].(string)
		path, pathOK := object["path"].(string)
		if !methodOK || !pathOK {
			t.Fatalf("expected method/path route object, got %+v", object)
		}
		output[method+" "+path] = object
	}
	return output
}
