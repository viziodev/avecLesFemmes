FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/super-admin-web/package.json apps/super-admin-web/package.json
COPY apps/membres-pwa/package.json apps/membres-pwa/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY packages packages
COPY apps/super-admin-web apps/super-admin-web
COPY apps/membres-pwa apps/membres-pwa
ARG APP_NAME=super-admin-web
RUN npm run build --workspace @aveclesfemmes/${APP_NAME} && cp -r apps/${APP_NAME}/dist /web-dist
FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:56b8272e43a0525f67aed68d1e0794a712d10e3e45a563e118e9a77c817e6f86
ARG PRODUCT_VERSION=0.2.0
ARG VCS_REF=working-tree
ARG SOURCE_URL
LABEL org.opencontainers.image.version=$PRODUCT_VERSION org.opencontainers.image.revision=$VCS_REF org.opencontainers.image.source=$SOURCE_URL
COPY --from=build /web-dist /usr/share/nginx/html
ENV API_UPSTREAM=api:3000 API_SCHEME=http
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
