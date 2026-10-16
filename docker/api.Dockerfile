FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/super-admin-web/package.json apps/super-admin-web/package.json
COPY apps/membres-pwa/package.json apps/membres-pwa/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build --workspace @aveclesfemmes/api
RUN npm prune --omit=dev
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
ARG PRODUCT_VERSION=0.2.1
ARG VCS_REF=working-tree
ARG SOURCE_URL
LABEL org.opencontainers.image.version=$PRODUCT_VERSION org.opencontainers.image.revision=$VCS_REF org.opencontainers.image.source=$SOURCE_URL
ENV NODE_ENV=production PORT=3000
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --chown=node:node database /app/database
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://localhost:3000/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/main.js"]
