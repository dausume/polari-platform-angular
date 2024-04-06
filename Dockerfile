#Dockerfile for polari-platform-angular

FROM node:18.13

RUN mkdir /project
WORKDIR /project

RUN npm install -g @angular/cli@13.3.0

COPY package.json ./
RUN npm install

COPY . .

RUN ng build --configuration=development

CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200"]

# Run ng build, loading the env vars needed while in the browser for your given environment. --configuration=production


EXPOSE 4200