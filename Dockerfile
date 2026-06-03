FROM golang:1.25-alpine AS build
WORKDIR /src
COPY scum_server /src/scum_server
COPY plugins/scum-admin /src/plugins/scum-admin
WORKDIR /src/plugins/scum-admin
RUN go build -o /out/scum-admin-plugin ./cmd/scum-admin-plugin

FROM alpine:3.20
RUN adduser -D -H scumplugin
USER scumplugin
COPY --from=build /out/scum-admin-plugin /usr/local/bin/scum-admin-plugin
ENTRYPOINT ["/usr/local/bin/scum-admin-plugin"]
