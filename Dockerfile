# syntax=docker/dockerfile:1.4

FROM node:14

RUN mkdir /project
WORKDIR /project

RUN npm install -g @angular/cli@12.2.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
CMD ["ng", "serve", "--host", "0.0.0.0"]

#FROM builder as dev-envs

#RUN <<EOF
#apt-get update
#apt-get install -y --no-install-recommends git
#EOF

#RUN <<EOF
#useradd -s /bin/bash -m vscode
#groupadd docker
#usermod -aG docker vscode
#EOF
# install Docker tools (cli, buildx, compose)
#COPY --from=gloursdocker/docker / /

#CMD ["ng", "serve", "--host", "0.0.0.0"]