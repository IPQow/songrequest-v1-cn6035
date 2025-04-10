FROM node:18-alpine

WORKDIR /app
# Copy package files
COPY package*.json ./
COPY ecosystem.config.js ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Start both processes using PM2
CMD ["npm", "start"]