# syntax=docker/dockerfile:1

# Optimized Dockerfile for polari-platform-angular
# Uses layer caching to speed up rebuilds when only source code changes

FROM node:18.13

WORKDIR /project

# Install Angular CLI globally (cached layer - rarely changes)
RUN npm install -g @angular/cli@13.3.0

# Copy package files FIRST for better caching
# This layer only rebuilds when package.json or package-lock.json changes
COPY package*.json ./

# Use npm ci for faster, more reliable installs
# Cache mount speeds up npm downloads across rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code LAST (this invalidates cache most often)
# Separating this from dependencies ensures npm packages are cached
COPY . .

# Pre-build the application during image creation
# This makes container startup faster and catches build errors early
RUN ng build --configuration=development

# WARNING: This exposes the port strictly to other containers on the same network
# This DOES NOT expose the application on the localhost of the HOST machine
# Only the mapping in docker-compose or using the -p flag will expose to host
#
# ALSO: Make certain your app uses --host 0.0.0.0 to expose it externally
# Mapping externally on the virtual network allows docker-compose or -p mapping
# to expose the port on the host, otherwise it will be unavailable

# Expose HTTP and HTTPS ports
# HTTP: 4200, HTTPS: 2087 (Cloudflare-compatible)
EXPOSE 4200
EXPOSE 2087

# Make entrypoint executable
RUN chmod +x /project/entrypoint.sh

# Use entrypoint script for dual HTTP/HTTPS support
# Falls back to HTTP-only if SSL certificates are not available
CMD ["/project/entrypoint.sh"]