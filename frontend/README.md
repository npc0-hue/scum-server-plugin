# scum-admin frontend

This directory owns SCUM-specific plugin UI, static assets, metadata, and bundle entry points.

The platform shell may load the built `app.js` through Web Shell plugin metadata, but it must not copy SCUM configuration UI, images, game constants, spawn metadata, or map resources into `scum_web`.

## Host bridge usage

`src/bridge.ts` is a small plugin-side adapter for the `scum.plugin.bridge` protocol provided by `scum_web`. The plugin frontend:

- reads only `bridgeNonce` from the iframe URL;
- sends `plugin.handshake` with plugin ID, version, route key, and nonce;
- waits for `host.context` before rendering runtime context;
- reports `plugin.ready` after initialization;
- calls the plugin API gateway through `plugin.api.request` instead of reading platform tokens or building `/api/plugins/...` requests itself.

`src/main.ts` renders the plugin-owned SCUM management routes declared by `src/resources/domainCatalog.ts`, including settings, database, players, vehicles, territories, locks, gifts, events, economy, logs, Steam, update, and task surfaces. Each surface calls the plugin API gateway through the host bridge and shows unavailable capability states from the host context.

Platform access tokens, refresh tokens, authorization headers, raw manifests, and plugin session credentials must never be sent to this iframe.
