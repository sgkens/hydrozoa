---
layout: default
title: Deployment
---

# Deployment Guide

## Docker Deployment

Hydrozoa is container-first and ready for deployment with Docker.

1. **Build the Docker Image**:
   ```bash
   docker build -t hydrozoa:latest .
   ```

2. **Run the Container**:
   ```bash
   docker run -d \
     -p 3000:3000 \
     --env-file .env \
     --name hydrozoa-agent \
     hydrozoa:latest
   ```

3. **Verify Deployment**:
   Check the logs to ensure the agent is running correctly.
   ```bash
   docker logs -f hydrozoa-agent
   ```

## Kubernetes Deployment

For high-availability and scalable synchronization, you can deploy Hydrozoa to a Kubernetes cluster.

### Example Deployment Manifest

Create a `deployment.yaml` file:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hydrozoa-agent
  namespace: hydrozoa
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hydrozoa
  template:
    metadata:
      labels:
        app: hydrozoa
    spec:
      containers:
      - name: hydrozoa
        image: hydrozoa:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: hydrozoa-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: hydrozoa-service
  namespace: hydrozoa
spec:
  selector:
    app: hydrozoa
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

### Apply to Cluster

```bash
kubectl apply -f deployment.yaml
```

## Environment Variables

Ensure the following variables are set in your deployment environment:

- `PORT`: The port the agent will listen on (default: 3000).
- `GEMINI_API_KEY`: Required for AI-assisted features.
- `DOCKER_HUB_USER`: (Optional) For CI/CD integration.
- `DOCKER_HUB_TOKEN`: (Optional) For CI/CD integration.
