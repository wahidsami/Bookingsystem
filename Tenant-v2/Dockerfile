# Builder stage: install dependencies and build the app
FROM node:20-alpine AS builder

WORKDIR /app

# Force development so npm ci installs ALL deps (vite, esbuild, typescript, etc.)
ENV NODE_ENV=development

# Accept VITE_ vars as build args so they get baked into the React bundle at build time
ARG VITE_API_URL
ARG VITE_PUBLIC_PAGE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_PAGE_URL=$VITE_PUBLIC_PAGE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: production dependencies only
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && rm package.json package-lock.json

COPY --from=builder /app/dist ./dist
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
