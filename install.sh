#!/bin/bash

# Check for Node.js and npm
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js v20 or later."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

# Install dependencies
echo "Installing Hydrozoa dependencies..."
npm install

# Build the application
echo "Building Hydrozoa frontend..."
npm run build

# Instructions to start
echo "Hydrozoa is ready to be started."
echo "To start the application, run: npm start"
echo "The application will be available at http://localhost:3000"
