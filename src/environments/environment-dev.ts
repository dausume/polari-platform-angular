// This is the default environment file, replace this with whatever you want, add any environment variables
// that your heart desires for your specific implementation here.
// To use an environment variable anywhere in the app just import this environment variable,
// then do 
export const environment = {
    environmentDisplayName: 'Developer Mode', // The environment name you would want displayed in the App itself.
    environmentTypeName: 'dev', // The name expected to be typed into the console for docker-compose
                                // if explicitly defining you want to use this environment
    production: false, // This environment is defined in a way so that it can handle real-world data
                       // and operate at whatever scale is appropriate for your scenario.
    test: false, // This environment will be used for testing the app, and will be defined in a way that
    // ensures appropriate test data exists and that test reports are generated.
    dev: true, // This environment is defined in a way you would want it to be while doing development of the app.
    default: true, // Used because this is the default environment you get when you do not define anything.
    protocol: "http",
    backendUrl: 'localhost',
    backendPort: '3000'
}; 