FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3040
EXPOSE 3040

CMD ["npm", "run", "dev"]
