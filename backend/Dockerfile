FROM node:24-slim 

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /home/app
WORKDIR /home/app
COPY . .
RUN npm install
RUN npm run build

EXPOSE 8080
CMD ["npm","run","prod"]