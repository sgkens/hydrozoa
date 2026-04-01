```text
      _   _           _                                
     | | | |         | |                               
     | |_| |_   _  __| |_ __ ___ _______   __ _        
     |  _  | | | |/ _` | '__/ _ \_  / _ \ / _` |       
     | | | | |_| | (_| | | | (_) / / (_) | (_| |       
     \_| |_/\__, |\__,_|_|  \___/___\___/ \__,_|       
             __/ |                                     
            |___/                                      
                                                       
          ~ THE FLUID REPOSITORY MIRROR ~              
```

# Hydrozoa: Multipoint Repository Mirror Agent

**Hydrozoa** is a lightweight, high-performance synchronization engine designed to bridge the gap between diverse Git ecosystems. It acts as a fluid "multipoint mirror," allowing you to synchronize repositories across GitHub, GitLab, Gitea, Forgejo, and more—automatically and in real-time.

## 🌊 Why Hydrozoa?

In an era of vendor lock-in and centralized dependencies, **Hydrozoa** provides data sovereignty and redundancy. Whether you are maintaining a live backup of your organization's GitHub repositories on a self-hosted GitLab instance or mirroring personal projects to Gitea, Hydrozoa ensures your code is everywhere it needs to be.

## 🚀 Key Features

- **Multipoint Sync**: Define one source and broadcast to multiple target providers simultaneously.
- **Automated Provisioning**: Automatically creates target repositories on remote providers if they don't exist, syncing metadata and tags.
- **Real-time Telemetry**: A modern, high-density dashboard featuring ApexCharts for throughput visualization and system health monitoring.
- **Fault Tolerance (DLQ)**: Integrated Dead Letter Queue (DLQ) to capture, inspect, and replay failed synchronization events.
- **Security First**: AES-256-GCM encryption for provider tokens and secure JWT-based authentication.
- **System Visibility**: Built-in resource monitoring (Memory, CPU, Uptime) and API version tracking for all supported adapters.

## 🛠 Supported Adapters

- **GitHub** (v3 REST API)
- **GitLab** (v4 API, including Self-Hosted)
- **Gitea / Forgejo** (v1 API)
- **Gogs** (v1 API)
- **Bitbucket** (Upcoming)

## 📦 Quick Start (Docker)

```bash
docker run -d \
  -p 3000:3000 \
  -e JWT_SECRET="your-secure-secret" \
  -e HYDROZOA_MASTER_KEY="32-character-encryption-key-here" \
  --name hydrozoa \
  ghcr.io/your-username/hydrozoa:latest
```

## 🌐 Links
- **GitHub**: [github.com/your-username/hydrozoa](https://github.com/your-username/hydrozoa)
- **License**: MIT (Free & Open Source)
- **Documentation**: [docs.hydrozoa.io](https://docs.hydrozoa.io)

---
*Hydrozoa is built for the modern DevOps era—fluid, resilient, and always in sync.*
