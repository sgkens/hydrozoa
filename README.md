# 🪼 Hydrozoa

[![GitLab CI](https://img.shields.io/badge/gitlab%20ci-passed-brightgreen)](https://gitlab.com) [![Docker](https://img.shields.io/badge/docker-alpine-blue)](https://www.docker.com/) [![Kubernetes](https://img.shields.io/badge/kubernetes-ready-blue)](https://kubernetes.io/) [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Hydrozoa** is a high-performance repository mirroring engine designed to synchronize code across multiple Git providers (GitHub, GitLab, Gogs, Gitea, Forgejo, Bitbucket) with deep-sea precision and real-time telemetry.

---

## **Features**

- **Multi-Provider Mirroring**: Sync repositories between GitHub, GitLab, Gogs, Gitea, Forgejo, and Bitbucket.
- **Bioluminescent Dashboard**: Real-time telemetry and sync metrics visualized with high-end animations.
- **Source Selection Matrix**: Hierarchical selection of namespaces and repositories for granular mirroring control.
- **Dead Letter Queue (DLQ)**: Automatic capture of failed syncs with one-click replay functionality.
- **Bilingual Logs**: Logs translated into both human-readable resolutions and technical stack traces.
- **Bidirectional Sync**: Support for two-way synchronization between providers.
- **AES-256-GCM Encryption**: All provider tokens are encrypted at rest using industry-standard encryption.
- **JWT Authentication**: Secure access control for all API and UI interactions.
- **Conflict Resolution**: Configurable strategies (Source Wins, Target Wins, Latest Commit, Manual).

---

## **Installation**

### 1. Bare Metal (Linux / macOS)
Ensure you have **Node.js v20+** installed.

```bash
# Run the automated installer
chmod +x install.sh
./install.sh

# Start the application
npm start
```

### 2. Bare Metal (Windows)
Ensure you have **Node.js v20+** installed.

```powershell
# Run the automated installer
.\install.ps1

# Start the application
npm start
```

### 3. Docker
```bash
# Using the helper script
chmod +x docker/docker-run.sh
./docker/docker-run.sh

# OR using Docker Compose
docker-compose -f docker/docker-compose.yaml up -d
```

### 4. Kubernetes
```bash
# Apply the manifests
kubectl apply -f kubernetes/deployment.yaml
```

---

## **Configuration**

Hydrozoa uses environment variables for core security. Create a `.env` file in the root:

```env
JWT_SECRET=your-secure-jwt-secret
HYDROZOA_MASTER_KEY=32-character-long-master-key-!!
NODE_ENV=production
```

---

## **API Reference**

Hydrozoa is built with a "Headless First" philosophy. You can bypass the GUI entirely using the REST API.

### **Authentication**
All requests (except login) require a `Bearer` token in the `Authorization` header.

**POST** `/api/v1/auth/login`
```json
{
  "email": "admin@hydrozoa.io",
  "password": "hydrozoa-default"
}
```
*Returns:* `{ "token": "...", "user": { ... } }`

### **System Telemetry**
- **GET** `/api/v1/system/sync-matrix`: Retrieve the current status of all mirror pairs.
- **GET** `/api/v1/system/dlq`: List items in the Dead Letter Queue.
- **POST** `/api/v1/system/dlq/:id/replay`: Re-trigger a failed sync operation.

### **Provider Management**
- **GET** `/api/v1/auth/providers`: List configured Git providers.
- **POST** `/api/v1/auth/providers`: Register a new provider (tokens will be encrypted).

### **Logs & Analytics**
- **GET** `/api/v1/logs/translated`: Fetch logs with human-readable resolutions.
- **GET** `/api/v1/analytics/sync-metrics`: Get time-series data for sync performance.

---

## **Help & Troubleshooting**

| Issue | Resolution |
|-------|------------|
| **Decryption Failed** | Ensure `HYDROZOA_MASTER_KEY` matches the key used during provider registration. |
| **401 Unauthorized** | Your JWT has expired. Re-authenticate via the login endpoint. |
| **Sync Timeout** | Check the target provider's rate limits or network connectivity. |
| **Docker Build Error** | Ensure you are using the `node:20-alpine` base image as specified in the Dockerfile. |

For further assistance, please open an issue in the GitLab repository or contact the maintainers.

---

## **License**
Distributed under the MIT License. See `LICENSE` for more information.
