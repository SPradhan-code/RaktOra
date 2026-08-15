FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

EXPOSE 5000

ENV NODE_ENV=development
ENV PORT=5000

CMD ["npm", "start"]
