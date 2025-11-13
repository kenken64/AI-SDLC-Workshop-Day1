FROM node:20-alpine

# Install Python and build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Accept build arguments from Railway environment variables
ARG NEXT_PUBLIC_RP_ID
ENV NEXT_PUBLIC_RP_ID=$NEXT_PUBLIC_RP_ID

# Build Next.js app
ENV NODE_ENV=production
RUN npm run build

# Create todos.db file with correct permissions
RUN touch /app/todos.db

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
