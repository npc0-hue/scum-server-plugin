package pluginclient

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	protocolMessageHello     = "hello"
	protocolMessageWelcome   = "welcome"
	protocolMessageHeartbeat = "heartbeat"
	protocolMessageRequest   = "request"
	protocolMessageResponse  = "response"
)

// HelloPayload 是插件 HELLO 消息载荷，字段必须与 scum_server 协议兼容。
type HelloPayload struct {
	// PluginID 是插件声明的插件 ID。
	PluginID string `json:"pluginId"`
	// PluginInstallationID 是插件声明的本地安装记录 ID。
	PluginInstallationID string `json:"pluginInstallationId"`
	// PluginVersion 是插件声明的版本号。
	PluginVersion string `json:"pluginVersion"`
	// RuntimeGeneration 是插件声明的运行时代次。
	RuntimeGeneration uint32 `json:"runtimeGeneration"`
	// ProtocolVersion 是插件请求使用的协议版本。
	ProtocolVersion int `json:"protocolVersion"`
	// Nonce 是插件为本次 HELLO 生成的一次性随机串。
	Nonce string `json:"nonce"`
	// StartupToken 是容器启动时注入的短期 token。
	StartupToken string `json:"startupToken"`
	// TokenSignature 是使用 startupToken 计算的 HELLO HMAC 签名。
	TokenSignature string `json:"tokenSignature"`
}

// WelcomePayload 是 scum_server WELCOME 消息载荷。
type WelcomePayload struct {
	// SessionID 是 scum_server 分配的会话 ID。
	SessionID string `json:"sessionId"`
	// AcceptedProtocolVersion 是服务端接受的协议版本。
	AcceptedProtocolVersion int `json:"acceptedProtocolVersion"`
	// HeartbeatSeconds 是建议心跳间隔秒数。
	HeartbeatSeconds int `json:"heartbeatSeconds"`
	// StaleSeconds 是服务端判定会话过期的秒数。
	StaleSeconds int `json:"staleSeconds"`
	// GrantedCapabilities 是服务端授予的协议能力列表。
	GrantedCapabilities []string `json:"grantedCapabilities"`
}

// Envelope 是插件协议帧中的 JSON 信封。
type Envelope struct {
	// ProtocolVersion 是消息使用的协议版本。
	ProtocolVersion int `json:"protocolVersion"`
	// Type 是协议消息类型。
	Type string `json:"type"`
	// RequestID 是请求响应关联 ID。
	RequestID string `json:"requestId,omitempty"`
	// TraceID 是链路追踪 ID。
	TraceID string `json:"traceId,omitempty"`
	// Timestamp 是消息创建时间。
	Timestamp time.Time `json:"timestamp"`
	// Payload 是消息载荷 JSON。
	Payload json.RawMessage `json:"payload,omitempty"`
	// Error 是结构化协议错误。
	Error *ProtocolError `json:"error,omitempty"`
}

// ProtocolError 是协议层结构化错误。
type ProtocolError struct {
	// Code 是稳定错误码。
	Code string `json:"code"`
	// Message 是脱敏后的错误说明。
	Message string `json:"message"`
	// Retryable 表示插件是否可以重试该请求。
	Retryable bool `json:"retryable"`
}

// APICommand 是 scum_server 发给插件的 API 命令。
type APICommand struct {
	// PluginInstallationID 是目标本地插件安装记录 ID。
	PluginInstallationID string `json:"pluginInstallationId"`
	// PluginID 是目标插件 ID。
	PluginID string `json:"pluginId"`
	// PluginVersion 是当前安装版本号。
	PluginVersion string `json:"pluginVersion"`
	// RuntimeID 是当前运行时记录 ID。
	RuntimeID string `json:"runtimeId"`
	// RuntimeGeneration 是当前运行时代次。
	RuntimeGeneration uint32 `json:"runtimeGeneration"`
	// SessionID 是目标已认证插件协议会话 ID。
	SessionID string `json:"sessionId"`
	// RequestID 是平台请求 ID。
	RequestID string `json:"requestId"`
	// TraceID 是平台链路追踪 ID。
	TraceID string `json:"traceId"`
	// Deadline 是插件必须返回响应的截止时间。
	Deadline time.Time `json:"deadline"`
	// Method 是插件 API HTTP 方法。
	Method string `json:"method"`
	// RouteSuffix 是插件 API 路由后缀。
	RouteSuffix string `json:"routeSuffix"`
	// Query 是插件 API 查询参数。
	Query map[string][]string `json:"query,omitempty"`
	// Headers 是允许传递给插件的请求头。
	Headers map[string]string `json:"headers,omitempty"`
	// ContentType 是请求体内容类型。
	ContentType string `json:"contentType,omitempty"`
	// Body 是请求体字节。
	Body []byte `json:"body,omitempty"`
	// Actor 是脱敏后的平台调用方上下文。
	Actor APIActorContext `json:"actor"`
	// Instance 是可选服务器实例上下文。
	Instance *APIInstanceContext `json:"instance,omitempty"`
	// Limits 是本次网关调用使用的限制摘要。
	Limits APILimitContext `json:"limits"`
}

// APIActorContext 是平台调用方上下文。
type APIActorContext struct {
	// Type 是调用方主体类型。
	Type string `json:"type"`
	// ID 是调用方主体 ID。
	ID string `json:"id"`
	// Roles 是调用方平台角色摘要。
	Roles []string `json:"roles,omitempty"`
}

// APIInstanceContext 是服务器实例上下文。
type APIInstanceContext struct {
	// ServerInstanceID 是目标服务器实例 ID。
	ServerInstanceID string `json:"serverInstanceId"`
	// RequiredPermission 是平台授权时使用的实例权限。
	RequiredPermission string `json:"requiredPermission"`
}

// APILimitContext 是插件 API 调用限制摘要。
type APILimitContext struct {
	// RequestBodyLimitBytes 是请求体最大字节数。
	RequestBodyLimitBytes int64 `json:"requestBodyLimitBytes"`
	// ResponseBodyLimitBytes 是响应体最大字节数。
	ResponseBodyLimitBytes int64 `json:"responseBodyLimitBytes"`
	// TimeoutSeconds 是调度超时时间秒数。
	TimeoutSeconds int `json:"timeoutSeconds"`
}

// APICommandResponse 是插件返回给 scum_server 的 API 响应。
type APICommandResponse struct {
	// RequestID 是与请求对应的平台请求 ID。
	RequestID string `json:"requestId"`
	// TraceID 是与请求对应的平台链路追踪 ID。
	TraceID string `json:"traceId"`
	// StatusCode 是插件希望网关返回的 HTTP 状态码。
	StatusCode int `json:"statusCode"`
	// Headers 是插件返回且允许透传的响应头。
	Headers map[string]string `json:"headers,omitempty"`
	// ContentType 是插件响应内容类型。
	ContentType string `json:"contentType,omitempty"`
	// Body 是插件响应体字节。
	Body []byte `json:"body,omitempty"`
	// Error 是插件返回的结构化错误。
	Error *APICommandError `json:"error,omitempty"`
}

// APICommandError 是插件 API 结构化错误。
type APICommandError struct {
	// Code 是插件返回的稳定错误码。
	Code string `json:"code"`
	// Message 是脱敏后可返回给调用方的错误摘要。
	Message string `json:"message"`
	// Retryable 表示调用方是否可以重试。
	Retryable bool `json:"retryable"`
}

// DecodeFrame decodes one length-prefixed JSON envelope.
// reader supplies frame bytes, maxBytes bounds the payload, and the function returns an envelope or protocol error.
func DecodeFrame(reader io.Reader, maxBytes int) (Envelope, error) {
	if maxBytes <= 0 {
		return Envelope{}, errors.New("max frame bytes must be positive")
	}
	var header [4]byte
	if _, err := io.ReadFull(reader, header[:]); err != nil {
		return Envelope{}, fmt.Errorf("read frame header: %w", err)
	}
	length := int(binary.BigEndian.Uint32(header[:]))
	if length <= 0 || length > maxBytes {
		return Envelope{}, errors.New("invalid frame length")
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(reader, payload); err != nil {
		return Envelope{}, fmt.Errorf("read frame payload: %w", err)
	}
	var envelope Envelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return Envelope{}, fmt.Errorf("decode envelope: %w", err)
	}
	return envelope, nil
}

// EncodeFrame encodes one protocol envelope as a length-prefixed JSON frame.
// writer receives frame bytes, envelope is the message to encode, and the function returns any encode or write error.
func EncodeFrame(writer io.Writer, envelope Envelope) error {
	payload, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(payload)))
	if _, err := writer.Write(header[:]); err != nil {
		return fmt.Errorf("write frame header: %w", err)
	}
	if _, err := writer.Write(payload); err != nil {
		return fmt.Errorf("write frame payload: %w", err)
	}
	return nil
}

// SignHelloToken computes the HMAC signature expected by scum_server HELLO authentication.
// token is the raw startup token, hello contains identity and nonce fields, and the function returns a hex HMAC signature.
func SignHelloToken(token string, hello HelloPayload) string {
	mac := hmac.New(sha256.New, []byte(token))
	_, _ = mac.Write([]byte(pluginHelloSignatureBase(hello)))
	return hex.EncodeToString(mac.Sum(nil))
}

// pluginHelloSignatureBase builds the canonical HELLO signature payload shared with scum_server.
// hello contains normalized identity and nonce fields, and the function returns the stable pipe-delimited signing string.
func pluginHelloSignatureBase(hello HelloPayload) string {
	parts := []string{
		hello.PluginInstallationID,
		hello.PluginID,
		hello.PluginVersion,
		fmt.Sprintf("%d", hello.RuntimeGeneration),
		fmt.Sprintf("%d", hello.ProtocolVersion),
		hello.Nonce,
	}
	return strings.Join(parts, "|")
}
