package pluginclient

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

// RuntimeConfig 表示插件协议客户端启动配置。
type RuntimeConfig struct {
	// ProtocolAddress 是 scum_server 插件协议地址。
	ProtocolAddress string
	// PluginID 是插件 ID。
	PluginID string
	// PluginInstallationID 是本地插件安装 ID。
	PluginInstallationID string
	// PluginVersion 是插件版本。
	PluginVersion string
	// RuntimeGeneration 是本次容器运行时代次。
	RuntimeGeneration uint32
	// ProtocolVersion 是请求使用的协议版本。
	ProtocolVersion int
	// StartupToken 是 runtime 注入的短期启动 token。
	StartupToken string
	// AllowAdHocSQL 表示是否允许临时只读 SQL。
	AllowAdHocSQL bool
}

// LoadRuntimeConfigFromEnv loads plugin startup configuration from environment variables.
// It takes no parameters and returns a runtime config or an error when required bootstrap values are missing or malformed.
func LoadRuntimeConfigFromEnv() (RuntimeConfig, error) {
	generation, err := strconv.ParseUint(requiredEnv("SCUM_PLUGIN_RUNTIME_GENERATION"), 10, 32)
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("parse runtime generation: %w", err)
	}
	protocolVersion, err := strconv.Atoi(requiredEnv("SCUM_PLUGIN_PROTOCOL_VERSION"))
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("parse protocol version: %w", err)
	}
	return RuntimeConfig{
		ProtocolAddress:      requiredEnv("SCUM_PLUGIN_PROTOCOL_ADDR"),
		PluginID:             envOr("SCUM_PLUGIN_ID", "scum-admin"),
		PluginInstallationID: requiredEnv("SCUM_PLUGIN_INSTALLATION_ID"),
		PluginVersion:        envOr("SCUM_PLUGIN_VERSION", "0.1.0"),
		RuntimeGeneration:    uint32(generation),
		ProtocolVersion:      protocolVersion,
		StartupToken:         requiredEnv("SCUM_PLUGIN_STARTUP_TOKEN"),
		AllowAdHocSQL:        strings.EqualFold(os.Getenv("SCUM_ADMIN_PLUGIN_ALLOW_AD_HOC_SQL"), "true"),
	}, nil
}

// Run connects to scum_server and serves SCUM plugin gateway commands.
// cfg contains protocol bootstrap values, handler processes SCUM routes, and the function returns when the protocol connection fails or disconnects.
func Run(cfg RuntimeConfig, handler Handler) error {
	conn, err := net.DialTimeout("tcp", cfg.ProtocolAddress, 10*time.Second)
	if err != nil {
		return fmt.Errorf("connect protocol address: %w", err)
	}
	defer conn.Close()
	welcome, err := authenticate(conn, cfg)
	if err != nil {
		return err
	}
	heartbeatInterval := time.Duration(welcome.HeartbeatSeconds) * time.Second
	if heartbeatInterval <= 0 {
		heartbeatInterval = 2 * time.Second
	}
	return serve(conn, cfg.ProtocolVersion, heartbeatInterval, handler)
}

// authenticate performs plugin HELLO and validates WELCOME.
// conn is the protocol TCP connection, cfg contains identity and token values, and the function returns WELCOME metadata or an error.
func authenticate(conn net.Conn, cfg RuntimeConfig) (WelcomePayload, error) {
	hello := HelloPayload{
		PluginID:             cfg.PluginID,
		PluginInstallationID: cfg.PluginInstallationID,
		PluginVersion:        cfg.PluginVersion,
		RuntimeGeneration:    cfg.RuntimeGeneration,
		ProtocolVersion:      cfg.ProtocolVersion,
		Nonce:                fmt.Sprintf("nonce-%d", time.Now().UTC().UnixNano()),
		StartupToken:         cfg.StartupToken,
	}
	hello.TokenSignature = SignHelloToken(cfg.StartupToken, hello)
	if err := writePayload(conn, protocolMessageHello, "hello-1", "", cfg.ProtocolVersion, hello); err != nil {
		return WelcomePayload{}, err
	}
	envelope, err := DecodeFrame(conn, 1024*1024)
	if err != nil {
		return WelcomePayload{}, fmt.Errorf("read welcome: %w", err)
	}
	if envelope.Error != nil {
		return WelcomePayload{}, fmt.Errorf("hello rejected: %s", envelope.Error.Message)
	}
	if envelope.Type != protocolMessageWelcome {
		return WelcomePayload{}, fmt.Errorf("expected welcome, got %s", envelope.Type)
	}
	var welcome WelcomePayload
	if err := json.Unmarshal(envelope.Payload, &welcome); err != nil {
		return WelcomePayload{}, fmt.Errorf("decode welcome: %w", err)
	}
	return welcome, nil
}

// serve processes gateway requests while sending periodic heartbeats.
// conn is the authenticated TCP connection, protocolVersion is the accepted version, heartbeatInterval controls heartbeat cadence, handler serves gateway commands, and the function returns any read/write error.
func serve(conn net.Conn, protocolVersion int, heartbeatInterval time.Duration, handler Handler) error {
	nextHeartbeat := time.Now().Add(heartbeatInterval)
	for sequence := 1; ; {
		if time.Now().After(nextHeartbeat) {
			if err := writePayload(conn, protocolMessageHeartbeat, fmt.Sprintf("heartbeat-%d", sequence), "", protocolVersion, map[string]any{"sequence": sequence}); err != nil {
				return err
			}
			sequence++
			nextHeartbeat = time.Now().Add(heartbeatInterval)
		}
		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		envelope, err := DecodeFrame(conn, 1024*1024)
		if err != nil {
			if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "i/o timeout") {
				continue
			}
			return fmt.Errorf("read protocol frame: %w", err)
		}
		if envelope.Type != protocolMessageRequest {
			continue
		}
		if err := handleRequest(conn, envelope, handler); err != nil {
			return err
		}
	}
}

// handleRequest decodes and responds to one core-originated plugin API command.
// conn is the authenticated TCP connection, envelope carries the request payload, handler serves SCUM routes, and the function returns any decode or write error.
func handleRequest(conn net.Conn, envelope Envelope, handler Handler) error {
	var command APICommand
	if err := json.Unmarshal(envelope.Payload, &command); err != nil {
		return fmt.Errorf("decode plugin api command: %w", err)
	}
	response := handler.Handle(command)
	payload, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("marshal plugin api response: %w", err)
	}
	output := Envelope{
		ProtocolVersion: envelope.ProtocolVersion,
		Type:            protocolMessageResponse,
		RequestID:       envelope.RequestID,
		TraceID:         envelope.TraceID,
		Timestamp:       time.Now().UTC(),
		Payload:         payload,
	}
	return EncodeFrame(conn, output)
}

// writePayload writes one protocol envelope with JSON payload.
// conn is the TCP connection, messageType/requestID/traceID identify the message, protocolVersion is the negotiated version, payload is JSON encoded, and the function returns any encoding or write error.
func writePayload(conn net.Conn, messageType string, requestID string, traceID string, protocolVersion int, payload any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	return EncodeFrame(conn, Envelope{
		ProtocolVersion: protocolVersion,
		Type:            messageType,
		RequestID:       requestID,
		TraceID:         traceID,
		Timestamp:       time.Now().UTC(),
		Payload:         encoded,
	})
}

// requiredEnv loads a required environment variable.
// key identifies the environment variable, and the function returns its trimmed value or an empty string when absent.
func requiredEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

// envOr loads an environment variable with a fallback.
// key identifies the environment variable, fallback is returned when unset, and the function returns the selected value.
func envOr(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
