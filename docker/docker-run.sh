#!/bin/bash

# Build the Docker image
echo "Building Hydrozoa Docker image..."
docker build -t hydrozoa:latest -f ../Dockerfile ..

# Run the container
echo "Starting Hydrozoa container on port 3000..."
docker run -d \
  --name hydrozoa \
  -p 3000:3000 \
  --env-file ../.env \
  hydrozoa:latest

echo "Hydrozoa is running at http://localhost:3000"
