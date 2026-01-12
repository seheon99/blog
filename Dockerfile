# syntax=docker/dockerfile:1.7-labs

FROM node:22-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:$PATH"
WORKDIR /app
RUN apk add --no-cache libc6-compat git \
    && corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && mkdir -p /run/nginx \
    && chown -R nginx:nginx /run/nginx /var/cache/nginx /var/log/nginx /var/run \
    && sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf \
    && sed -i 's|^pid .*;|pid /run/nginx/nginx.pid;|' /etc/nginx/nginx.conf \
    && rm -rf /docker-entrypoint.d/*
USER nginx
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
