export const environment = {
    invalidEnvironment: true, // Environment was not defined correctly.  This is likely due to the developer likely
    // setting up the docker compose file incorrectly, or because they tried to use an alternate build method without
    // setting up the environment correctly.

    // This is the default environment file, by default it will be replaced by the environment-dev.ts file when you run the
    // docker-compose up command.  If you want to use a different environment file, you can set the environment name in the
    // docker-compose file, and then you can use that environment file instead of the default one.
}; 