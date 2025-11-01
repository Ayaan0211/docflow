FROM node:24-slim 

RUN mkdir -p /home/app
WORKDIR /home/app
COPY . .
RUN npm install
RUN npm run build

EXPOSE 8080
CMD ["npm","run","start"]