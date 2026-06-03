package main

import (
	"fmt"
	"os"

	"scum_admin_plugin/internal/pluginclient"
)

// main starts the SCUM admin plugin protocol client.
// It reads runtime bootstrap configuration from environment variables and exits non-zero when the plugin cannot connect or serve commands.
func main() {
	cfg, err := pluginclient.LoadRuntimeConfigFromEnv()
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config failed: %v\n", err)
		os.Exit(1)
	}
	handler := pluginclient.NewHandler(cfg.AllowAdHocSQL)
	if err := pluginclient.Run(cfg, handler); err != nil {
		fmt.Fprintf(os.Stderr, "plugin failed: %v\n", err)
		os.Exit(1)
	}
}
