#!/bin/bash

#This is a template to use when constructing a larger architecture using environment variables.

# Read environment variables from .env file
source .env

# Generate environment.dockerconfig.ts file
echo "export const environment = {" > environment.dockerconfig.ts
echo "  production: true," >> environment.dockerconfig.ts
echo "  apiUrl: '$API_URL'," >> environment.dockerconfig.ts
# Add other environment-specific variables here
echo "};" >> environment.dockerconfig.ts
