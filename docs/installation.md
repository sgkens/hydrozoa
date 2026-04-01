---
layout: default
title: Installation
---

# Installation Guide

## Prerequisites

Before you dive into the deep sea with Hydrozoa, ensure you have the following:

- **Node.js**: v18 or later.
- **Git**: Installed and configured on your host machine.
- **Docker**: (Optional) For containerized deployment.
- **API Tokens**: Personal Access Tokens (PATs) for your source and target Git providers (GitHub, GitLab, etc.).

## Local Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo/hydrozoa.git
   cd hydrozoa
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Copy the example environment file and fill in your details.
   ```bash
   cp .env.example .env
   ```
   *Note: Ensure `GEMINI_API_KEY` is set if you're using AI-assisted features.*

4. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Build from Source

To create a production-ready build of the frontend:

```bash
npm run build
```
This will generate the static files in the `dist/` directory.

## Troubleshooting

- **Port Conflict**: If port 3000 is already in use, you can change the `PORT` variable in your `.env` file.
- **Missing Dependencies**: Ensure you've run `npm install` and that your Node version is compatible.
