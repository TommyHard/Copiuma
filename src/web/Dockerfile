# syntax=docker/dockerfile:1
# Multi-stage build для фронтенда: Node.js билд → nginx статикой
ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Копируем манифесты, ставим зависимости (кэш слоёв)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Копируем исходники и собираем
COPY . .

# Прокидываем VITE_* переменные окружения как build-args, чтобы Vite встроил их
ARG VITE_GATEWAY_URL=/api
ARG VITE_IDENTITY_URL=/identity
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_IDENTITY_URL=$VITE_IDENTITY_URL

RUN npm run build

# Production stage: nginx раздаёт собранный SPA
FROM nginx:alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
