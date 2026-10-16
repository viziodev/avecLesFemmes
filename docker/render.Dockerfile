FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/super-admin-web/package.json apps/super-admin-web/package.json
COPY apps/membres-pwa/package.json apps/membres-pwa/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY apps apps
COPY packages packages
RUN npm run build --workspace @aveclesfemmes/api && npm run build --workspace @aveclesfemmes/super-admin-web -- --base=/admin/ && npm run build --workspace @aveclesfemmes/membres-pwa
RUN npm prune --omit=dev
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
RUN apt-get update && apt-get install -y --no-install-recommends nginx ca-certificates && rm -rf /var/lib/apt/lists/*
ARG PRODUCT_VERSION=0.2.1
ARG VCS_REF=working-tree
ARG SOURCE_URL
LABEL org.opencontainers.image.version=$PRODUCT_VERSION org.opencontainers.image.revision=$VCS_REF org.opencontainers.image.source=$SOURCE_URL
ENV NODE_ENV=production PORT=8080
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/super-admin-web/dist /app/static/admin
COPY --from=build --chown=node:node /app/apps/membres-pwa/dist /app/static/membres
COPY --chown=node:node database /app/database
COPY --chown=node:node docker/render-nginx.conf docker/render-start.sh /app/docker/
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bash", "/app/docker/render-start.sh"]
