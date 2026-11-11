# Sandbox for opening game sites: Chromium plus the audit's dependencies and nothing else.
# Built and run by scripts/audit-in-docker.sh. The repository's scripts/ and games/ folders
# are mounted read-only when it runs, so the image holds no project code.
FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use the distribution's Chromium (it has arm64 builds; Chrome for Testing does not).
# Chromium's own sandbox can't start inside an unprivileged container, so the container
# is the sandbox: no capabilities, read-only filesystem, no access to the host's files.
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_NO_SANDBOX=1 \
    CI=1

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

USER node
ENTRYPOINT ["node", "scripts/audit-games.js"]
