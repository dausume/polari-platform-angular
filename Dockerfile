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

# WARNING : THIS EXPOSES the DOCKERFILE strictly to other containers on the same network, this DOES NOT expose the
# the application on the localhost of the HOST machine, only the mapping on a docker-compose or using the -p
# command when running the dockefile to build the container will perform that mapping.
# ALSO : Make certain your app is using a command to expose it externally, mapping externally on the virtual network
# is what allows the docker-compose or -p mapping to expose the port on the host, otherwise it will be unavailable
# when you try to access it.... took me a long time to figure that one out.
EXPOSE 4200