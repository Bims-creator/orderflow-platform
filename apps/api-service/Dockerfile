# --- deps stage: install only production dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Patch OS packages - the base image's own alpine package versions lag behind
# CVE fixes; without this Trivy's CRITICAL/HIGH gate fails the pipeline.
RUN apk update && apk upgrade --no-cache
# Runtime only needs `node`, never npm/npx - and npm ships its own bundled
# dependencies (cross-spawn, node-tar, sigstore) that carry known HIGH CVEs
# and would otherwise fail the same gate for vulnerabilities we can't reach.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Numeric UID - Kubernetes' runAsNonRoot check can't verify a named user is
# actually non-root, only a numeric one. 1000 is the "node" user the base
# image already ships with.
USER 1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
