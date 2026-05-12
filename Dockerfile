# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy package files và prisma schema
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client và Build project
RUN npx prisma generate
RUN npm run build
# Sao chép file schema.prisma vào thư mục dist để Prisma Client tìm thấy khi chạy trong môi trường production bundle
RUN mkdir -p dist/generated/prisma && cp prisma/schema.prisma dist/generated/prisma/schema.prisma


# Prune devDependencies to reduce image size
RUN npm prune --omit=dev

# Stage 2: Runner
FROM node:20-alpine

WORKDIR /app

# Install openssl for runtime Prisma
RUN apk add --no-cache openssl

# Set environment variables
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Use the same port as defined in package.json or Render's PORT
EXPOSE 4001

# Start the application
CMD ["npm", "run", "start:prod"]
