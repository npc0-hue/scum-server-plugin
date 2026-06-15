const protocol = 'scum.plugin.bridge'
const version = '1'
const sdkVersion = '0.1.0'

type BridgeMessageType = 'plugin.handshake' | 'plugin.ready' | 'plugin.error' | 'plugin.height' | 'plugin.api.request' | 'host.context' | 'host.context.update' | 'host.api.response' | 'host.error'

export interface BridgeContext {
  pluginId: string
  pluginVersion: string
  pluginInstallationId: string
  routeKey: string
  routeSuffix?: string
  apiBasePath: string
  serverInstanceId?: string
  locale: string
  theme: string
  themeTokens?: Record<string, string>
  bridgeVersion: string
  sdkVersion: string
  requestId: string
  traceId: string
  capabilities: string[]
}

interface BridgeEnvelope<TPayload = unknown> {
  protocol: string
  version: string
  type: BridgeMessageType
  requestId: string
  traceId?: string
  nonce: string
  pluginId: string
  pluginVersion: string
  routeKey: string
  payload?: TPayload
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class ScumPluginBridge {
  private contextValue: BridgeContext | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private readonly contextListeners = new Set<(context: BridgeContext) => void>()
  private readonly nonce = new URL(window.location.href).searchParams.get('bridgeNonce') || ''

  constructor(
    private readonly pluginId: string,
    private readonly pluginVersion: string,
    private readonly routeKey: string
  ) {}

  get context() {
    return this.contextValue
  }

  onContext(listener: (context: BridgeContext) => void) {
    this.contextListeners.add(listener)
    if (this.contextValue) {
      listener(this.contextValue)
    }
    return () => this.contextListeners.delete(listener)
  }

  init() {
    window.addEventListener('message', this.handleMessage)
    this.send('plugin.handshake', { sdkVersion })
    return new Promise<BridgeContext>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('bridge timeout')), 10000)
      const check = () => {
        if (this.contextValue) {
          clearTimeout(timeout)
          resolve(this.contextValue)
        } else {
          setTimeout(check, 20)
        }
      }
      check()
    })
  }

  ready(metadata: Record<string, unknown> = {}) {
    this.send('plugin.ready', { metadata })
  }

  error(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'plugin error')
    this.send('plugin.error', { code: 'scum_admin_error', message: message.slice(0, 240) })
  }

  height(height: number) {
    this.send('plugin.height', { height })
  }

  api<TBody = unknown>(path: string, method = 'GET', body?: unknown) {
    const requestId = requestID('api')
    this.send('plugin.api.request', { path, method, body }, requestId)
    return new Promise<TBody>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('api timeout'))
      }, 10000)
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeout })
    })
  }

  private readonly handleMessage = (event: MessageEvent) => {
    const envelope = event.data as BridgeEnvelope
    if (!envelope || envelope.protocol !== protocol || envelope.version !== version || envelope.nonce !== this.nonce) {
      return
    }
    if (envelope.type === 'host.context' || envelope.type === 'host.context.update') {
      this.contextValue = envelope.payload as BridgeContext
      this.contextListeners.forEach((listener) => listener(this.contextValue as BridgeContext))
      return
    }
    if (envelope.type === 'host.api.response') {
      const pending = this.pending.get(envelope.requestId)
      if (!pending) {
        return
      }
      clearTimeout(pending.timeout)
      this.pending.delete(envelope.requestId)
      const payload = envelope.payload as { body?: unknown; error?: { message?: string; code?: string } }
      if (payload?.error) {
        pending.reject(new Error(payload.error.message || payload.error.code || 'api error'))
      } else {
        pending.resolve(payload?.body)
      }
    }
  }

  private send(type: BridgeMessageType, payload: unknown, requestId = requestID('msg')) {
    window.parent.postMessage({
      protocol,
      version,
      type,
      requestId,
      traceId: this.contextValue?.traceId,
      nonce: this.nonce,
      pluginId: this.pluginId,
      pluginVersion: this.pluginVersion,
      routeKey: this.routeKey,
      payload
    } satisfies BridgeEnvelope, '*')
  }
}

const requestID = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
