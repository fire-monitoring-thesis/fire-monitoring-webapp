# Use Node.js LTS image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Expose port 8000 (must match server.js)
EXPOSE 8000

# Start the app
CMD ["npm", "start"]
