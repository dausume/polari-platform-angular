#### PolariPlatform
Version : 0.0.1

### Running the frontend App in isolation
The easiest way to run the app in most any situation is going to be using Docker Compose.
To run this app by itself (independently build just the frontend), you will first need to install docker.

Before trying to run the app make sure the Docker Engine (Docker Daemon) is running.

On windows this may be done most easily using Docker Desktop, starting the Docker Desktop app can start the Engine.

After installing Docker and making sure the enginer is running, go into the termianl and navigate to the working directory of the polari frontend app and run the following two commands.

# Builds the app - takes a few mins
Docker compose build

# Runs the app - may take a minute before it starts up
Docker compose up

This will run it using the default settings

### Deploy the App

## polari-platform-angular project official image
dausume/polari-frontend:angular

# Deploy an updated image to Docker Hub
First update the tag which defines what Docker Hub user, which of their repositories, and what specific image(tag) it goes to, with a version at the end MajorVersion.MinorVersion.IncrementalChange

Example

docker tag username/polari-angular:X.X.X
docker tag dausume/polari-angular:0.0.1

https://docs.docker.com/engine/reference/commandline/image_build/

docker build -t dausume/polari-angular:0.0.1 .

## Polari Node Setup Information
Depending on what device you use or what kind of setup approach may be easier than the other for you, so choose according to what you think would be easier for you.  

If you want to be more certain there will not be issues, I would suggest trying to use docker to run Polari, since it is meant to run on any device by implementing the app using containers

# Run Polari-Angular on Localhost on your computer
Open a terminal pointing to the polari-platform-angular folder as the cwd.

If this is your first time type 'npm install .' to install all dependencies for the Polari Angular App.

-- If you work for a secure organization --

Depending on circumstances and security policies of where you work, the dependencies may conflict with your policies and you may need to have them cleared for the particular dependency versions.  Alternatively, you may want to search to see if different dependency versions are approved and either upgrade if possible or downgrade if necessary.

If you find yourself doing such an upgrade please consider contributing it to the project, doing so can pay it forward and enable all organizations and individuals using the project to consume less time.

-- Anyone trying to use the project --

If you find any dependencies are failing to install regardless, look on the npm website for the set of valid dependency install commands and try installing with a specific command and version.  In the case where the install is invalid or became too outdated to use, consider trying to fix the project to use the newer version or even making a new repo if the project was not maintained and you are trying to pick it up and continue it.

--------------------------------------------

If the dependencies are all good, I would suggest running the tests first with 'npm test .' to run all tests.  

If the tests run properly the project should be in good condition, so try running it.

'ng start'

then go to port 4200 on your localhost to access the site.

Please note you will also need to run a Polari-Python Backend and connect to that backend on the configuration page to see the full functionality of the application.

# Running Polari-Angular in a Container on your computer

The official image for Polari Angular Frontend is

dausume/polari:angular

The corresponding backend is

dausume/polari:python

A work in progress is making configuration files that allow these to automatically be networked.  When completed that
image should be called

dausume/polari:standard

A related project meant to help with centralization of different Polari projects for a particular organization is the Polari-hub project.

## POLARI Backend Nodes Information

  Polari's backend operates based Nodes generated using the python programming language.
These Nodes are built using an amporphous tree of connected Object instances.  Where there
are manager-Objects which each form their own Node/Tree which may interconnect with others,
and tree-Objects which connect to one another and can always be traversed to through a path
of connected treeObjects on the tree.

    A Tree object is defined using both the inheritance of a treeObject base class and a decorator @treeObject around the Class
  definition which the user wishes to define as a treeObject.

    The Manager Object is defined in a similar manner using the @managerObject and managerObject base class.


### Default Angular Documentation

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.1.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
