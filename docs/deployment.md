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

- `APP_URL`: The public HTTPS origin. Production startup fails if it is absent or not HTTPS.
- `DATABASE_URL`: A PostgreSQL connection string. Use a managed or persistent PostgreSQL service.
- `JWT_SECRET`: A unique random value of at least 32 characters.
- `HYDROZOA_MASTER_KEY`: A unique random value of at least 32 characters. Back it up securely; it encrypts provider credentials.
- `BOOTSTRAP_ADMIN_PASSWORD`: A strong value of at least 12 characters, required only when the first administrator is created.
- `PROVIDER_REQUEST_TIMEOUT_MS`: Provider API timeout in milliseconds; defaults to `30000`.
- `DATABASE_POOL_MAX`: Maximum PostgreSQL connections per instance; defaults to `20`.
- `DATABASE_IDLE_TIMEOUT_MS`: Idle PostgreSQL connection timeout; defaults to `30000`.
- `DATABASE_CONNECT_TIMEOUT_MS`: PostgreSQL connection attempt timeout; defaults to `10000`.

Do not commit a populated Kubernetes Secret. Copy
`kubernetes/secret.example.yaml` outside the repository, fill it using a secret
manager, and apply it separately. The application manifest expects a Secret
named `hydrozoa-secrets`.

The supplied deployment runs as a non-root user with a read-only root
filesystem, bounded `/tmp` scratch storage for Git mirrors, resource limits,
readiness/liveness probes, rolling updates, and a 35-second termination grace
period. PostgreSQL persistence is intentionally external to the application
pod.

## Release verification

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
docker build -t hydrozoa:latest .
```

After deployment, verify `GET /health/ready` returns `{"status":"READY"}`.
