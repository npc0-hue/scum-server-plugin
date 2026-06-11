# SCUM Admin Plugin

`scum-admin` is the plugin-owned SCUM management fixture. SCUM-specific configuration UI, image resources, map assets, game constants, database views, and plugin routes belong in this plugin package rather than in `scum_web`.

Authoring commands are documented in `docs/plugin-authoring/README.md`. From `tools/plugin-authoring`, a static validation smoke check is:

```bash
go run ./cmd/plugin_toolkit validate \
  -manifest ../../plugins/scum-admin/manifest.json \
  -artifact ../../plugins/scum-admin/artifact.metadata.json \
  -server-version 1.2.0
```

The fixture follows the image-first plugin release shape:

```bash
cd ../../plugins/scum-admin/frontend
npm install
npm run build
cd ../../..
docker build -t local/scum-admin-plugin:0.1.0 -f plugins/scum-admin/Dockerfile .
cd tools/plugin-authoring
go run ./cmd/plugin_toolkit image-metadata \
  -manifest ../../plugins/scum-admin/manifest.json
go run ./cmd/plugin_toolkit validate \
  -manifest ../../plugins/scum-admin/manifest.json \
  -artifact ../../plugins/scum-admin/artifact.metadata.json \
  -server-version 1.2.0
```

The Docker image contains the backend binary and the built frontend resources at `/app/frontend/dist`. `artifact.metadata.json` declares the matching `runtime_image` and `image_frontend` entries for `local/scum-admin-plugin:0.1.0`.

Frontend code should use the platform host bridge and plugin API gateway boundaries. It must not read platform tokens, cookies, raw authorization headers, browser storage authorization values, Docker state, or host filesystem paths.
