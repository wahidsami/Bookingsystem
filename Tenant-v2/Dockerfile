# Use a lightweight Node image for both build and runtime stages
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies from lockfile and build the app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime image with production dependencies only
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["npm", "run", "start"]
