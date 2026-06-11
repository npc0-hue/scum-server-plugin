FROM golang:1.25-alpine AS build
WORKDIR /src
COPY scum_server /src/scum_server
COPY plugins/scum-admin /src/plugins/scum-admin
WORKDIR /src/plugins/scum-admin
RUN go build -o /out/scum-admin-plugin ./cmd/scum-admin-plugin

FROM alpine:3.20
RUN adduser -D -H scumplugin
COPY --from=build /out/scum-admin-plugin /usr/local/bin/scum-admin-plugin
COPY plugins/scum-admin/frontend/dist /app/frontend/dist
USER scumplugin
ENTRYPOINT ["/usr/local/bin/scum-admin-plugin"]
