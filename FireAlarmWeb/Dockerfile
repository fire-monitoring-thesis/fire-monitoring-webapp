# -------------------------------
# Stage 1 — Build Stage (optional if no frontend build)
# -------------------------------
FROM node:18 AS base

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy only package.json + package-lock.json first for layer caching
COPY package*.json ./

# Install dependencies (production only for smaller image)
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose the app port (same as in .env / compose)
EXPOSE 8000

# Define environment (can be overridden by Docker Compose)
ENV NODE_ENV=production

# Start the app
CMD ["node", "server.js"]
