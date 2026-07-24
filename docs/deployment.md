---
layout: default
title: Deployment
---

# Deploy Hydrozoa

Hydrozoa is distributed as `skgens/hydrozoa` on Docker Hub. Use an immutable
SemVer tag in production and keep PostgreSQL outside the application container.

## Runtime configuration

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Signs administrative sessions. Use a long random value. |
| `HYDROZOA_MASTER_KEY` | Yes | Encrypts stored provider credentials. Keep it stable across releases. |
| `NODE_ENV` | No | Set to `production` for deployments. |
| `PORT` | No | HTTP listener port. Defaults to `3000`. Managed platforms may set it. |

Do not place secrets in an image, Compose file, or source-controlled manifest.
Provider access tokens are configured through Hydrozoa after startup.

## Docker or Podman

```bash
export HYDROZOA_VERSION=1.2.2

docker run --detach \
  --name hydrozoa \
  --restart unless-stopped \
  --publish 3000:3000 \
  --env-file .env \
  "skgens/hydrozoa:${HYDROZOA_VERSION}"
```

The health endpoint is available at `http://localhost:3000/health`.

The supplied Compose definition uses the same Docker Hub image:

```bash
HYDROZOA_VERSION=1.2.2 docker compose -f docker/docker-compose.yaml up -d
```

## Google Cloud Run

Cloud Run accepts public Docker Hub images. Set the application secrets through
Secret Manager or the Cloud Run console; the command below only shows the
non-secret settings.

```bash
gcloud run deploy hydrozoa \
  --image docker.io/skgens/hydrozoa:1.2.2 \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

Attach `DATABASE_URL`, `JWT_SECRET`, and `HYDROZOA_MASTER_KEY` as secret-backed
environment variables. For higher pull availability, mirror the Docker Hub
repository through Artifact Registry.

## Azure Container Apps

```bash
az containerapp up \
  --name hydrozoa \
  --image docker.io/skgens/hydrozoa:1.2.2 \
  --ingress external \
  --target-port 3000
```

Add the three required secrets to the Container App and map them to environment
variables. A private Docker Hub repository also requires registry credentials.

## AWS ECS with Fargate

Create a task definition with:

- Image: `skgens/hydrozoa:1.2.2`
- Container port: `3000`
- Health check: `CMD-SHELL`, `wget -qO- http://localhost:3000/health || exit 1`
- Secrets: references to AWS Secrets Manager or Systems Manager Parameter Store
- Logging: the `awslogs` driver

Run the task behind an Application Load Balancer, route its target group to port
3000, and use a managed PostgreSQL instance such as Amazon RDS. Docker Hub
images can be used directly; mirror the image to ECR if registry pull limits or
availability requirements warrant it.

## DigitalOcean App Platform

Create an app from a container image and select Docker Hub as the registry:

```text
Repository: skgens/hydrozoa
Tag:        1.2.2
HTTP port:  3000
```

Add the runtime variables as encrypted environment variables. A DigitalOcean
Managed PostgreSQL database can supply `DATABASE_URL`.

## Render and Railway

Both platforms can create a web service from a Docker image. Use
`skgens/hydrozoa:1.2.2`, expose port `3000`, add the required runtime variables,
and connect a PostgreSQL service. Configure `/health` as the health-check path.
If the platform sets `PORT`, Hydrozoa uses that value automatically.

## Kubernetes

Store secrets separately, then deploy an immutable image tag:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hydrozoa
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
          image: skgens/hydrozoa:1.2.2
          ports:
            - name: http
              containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
          envFrom:
            - secretRef:
                name: hydrozoa-runtime
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: hydrozoa
spec:
  selector:
    app: hydrozoa
  ports:
    - port: 80
      targetPort: http
```

Hydrozoa currently runs its scheduler in the web process. Keep one replica
unless your deployment provides leader election for scheduled synchronization.

## Building and publishing

The PowerShell build script derives SemVer from conventional commits:

```powershell
docker login
./build-dockerimage.ps1 -TagLatest -Push
```

CI jobs run in `skgens/phellams-automator:${AUTOMATOR_VERSION}`. Set
`AUTOMATOR_VERSION` to a pinned builder release and configure masked
`DOCKER_HUB_USER` and `DOCKER_HUB_TOKEN` variables in GitLab.

## Provider documentation

- [Google Cloud Run container deployment](https://cloud.google.com/run/docs/deploying)
- [Azure Container Apps from an existing image](https://learn.microsoft.com/azure/container-apps/containerapp-up)
- [Amazon ECS task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)
- [DigitalOcean App Platform container images](https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-container-images/)
- [Render prebuilt images](https://render.com/docs/deploying-an-image)
- [Railway services](https://docs.railway.com/services)
- [Kubernetes image management](https://kubernetes.io/docs/concepts/containers/images/)
