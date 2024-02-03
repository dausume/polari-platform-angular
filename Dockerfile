#Dockerfile for polari-platform-angular

FROM node:14

RUN mkdir /project
WORKDIR /project

RUN npm install -g @angular/cli@12.2.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200"]

EXPOSE 4200