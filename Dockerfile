# syntax=docker/dockerfile:1.7-labs

FROM node:26-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:$PATH"
WORKDIR /app
RUN apk add --no-cache libc6-compat git \
    && npm install --global corepack@latest \
    && corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build



FROM nginx:1.31-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]
