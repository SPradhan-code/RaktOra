FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

EXPOSE 5173

# Run Vite dev server bound to 0.0.0.0 for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
