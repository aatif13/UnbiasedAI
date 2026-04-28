# Build from repository root (unbiasedai/) so Prisma schema at ./prisma is available:
#   docker build -f frontend/Dockerfile .

FROM node:20-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY prisma ./prisma
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema ../prisma/schema.prisma
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/package.json ./package.json
COPY --from=builder /app/frontend/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
