package pluginclient

import "testing"

// TestSignHelloTokenMatchesServerSignatureBase verifies the plugin HELLO signature order stays compatible with scum_server verification.
// t is the Go test handle, and the function fails the test when the plugin signature base drifts from the server-side canonical format.
func TestSignHelloTokenMatchesServerSignatureBase(t *testing.T) {
	hello := HelloPayload{
		PluginID:             "scum-admin",
		PluginInstallationID: "pi-1",
		PluginVersion:        "0.1.0",
		RuntimeGeneration:    7,
		ProtocolVersion:      1,
		Nonce:                "nonce-123",
	}

	got := pluginHelloSignatureBase(hello)
	want := "pi-1|scum-admin|0.1.0|7|1|nonce-123"
	if got != want {
		t.Fatalf("unexpected signature base: got %q want %q", got, want)
	}

	signature := SignHelloToken("token-123", hello)
	if signature == "" {
		t.Fatal("expected signature to be generated")
	}
}
