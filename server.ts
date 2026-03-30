import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "hydrozoa-deep-sea-secret-99";
const MAX_LOGS = 500; // Truncate logs to prevent memory issues

// Mock Database / Store
const providers: any[] = [];
const syncMatrix: any[] = [];
let dlqItems: any[] = [];
let logs: any[] = [];

// Mock User (Hashed password for "hydrozoa-default")
const DEFAULT_PASSWORD = "hydrozoa-default";
const MOCK_USER = {
  email: "admin@hydrozoa.io",
  passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
  name: "Hydrozoa Admin",
  isDefaultPassword: true
};

// Encryption Helper
const MASTER_KEY = process.env.HYDROZOA_MASTER_KEY || "default-secret-key-32-chars-long!!";
const ALGORITHM = "aes-256-gcm";

function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(MASTER_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string) {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(MASTER_KEY.padEnd(32).slice(0, 32)), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return "DECRYPTION_FAILED";
  }
}

// JWT Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Mock Sync Engine
setInterval(() => {
  syncMatrix.forEach(item => {
    item.targets.forEach((target: any) => {
      if (target.status === 'syncing') {
        target.progress = (target.progress || 0) + Math.floor(Math.random() * 10);
        if (target.progress >= 100) {
          target.progress = 100;
          target.status = 'synced';
          target.last_sync = new Date().toISOString();
          
          logs.push({
            timestamp: new Date().toISOString(),
            level: "info",
            code: "H-SYNC-OK",
            provider: target.provider_id,
            message: `Successfully mirrored ${item.source_repo} to ${target.provider_id}`,
            technical_context: `Sync Complete: ${item.source_repo} -> ${target.provider_id}`,
            ui_message: `Mirroring complete for ${item.source_repo}`,
            resolution: "No action required."
          });
        }
      } else if (target.status === 'synced' && Math.random() > 0.98) {
        target.status = 'syncing';
        target.progress = 0;
        target.bytes_transferred = `${(Math.random() * 5).toFixed(1)}GB`;
      }
    });
  });
  
  // Prune logs
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
}, 5000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/v1/auth/login", (req, res) => {
    const { email, password } = req.body;
    
    if (email === MOCK_USER.email && bcrypt.compareSync(password, MOCK_USER.passwordHash)) {
      const token = jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
      
      logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        code: "H-AUTH-LOGIN",
        provider: "system",
        message: `Admin login successful: ${email}`,
        technical_context: `JWT issued for ${email}`,
        ui_message: "System access granted.",
        resolution: "No action required."
      });

      res.json({ 
        token, 
        user: { 
          email, 
          name: MOCK_USER.name,
          isDefaultPassword: MOCK_USER.isDefaultPassword 
        } 
      });
    } else {
      logs.push({
        timestamp: new Date().toISOString(),
        level: "warn",
        code: "H-AUTH-FAIL",
        provider: "system",
        message: `Failed login attempt for: ${email}`,
        technical_context: "Invalid credentials provided.",
        ui_message: "Login attempt rejected.",
        resolution: "Verify credentials or reset password if forgotten."
      });
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/v1/auth/reset-password", authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (bcrypt.compareSync(currentPassword, MOCK_USER.passwordHash)) {
      MOCK_USER.passwordHash = bcrypt.hashSync(newPassword, 10);
      MOCK_USER.isDefaultPassword = false;
      
      logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        code: "H-AUTH-RESET",
        provider: "system",
        message: "Administrator password reset successful",
        technical_context: "Password hash updated in memory",
        ui_message: "Security credentials updated.",
        resolution: "No action required."
      });

      res.json({ message: "Password updated successfully" });
    } else {
      res.status(400).json({ error: "Invalid current password" });
    }
  });

  app.get("/api/v1/source/namespaces", authenticateToken, (req, res) => {
    // In production, this would fetch from the configured source provider
    res.json([]);
  });

  app.get("/api/v1/source/namespaces/:id/repos", authenticateToken, (req, res) => {
    res.json([]);
  });

  app.post("/api/v1/auth/providers", authenticateToken, (req, res) => {
    const { name, type, baseUrl, token } = req.body;
    const encryptedToken = encrypt(token);
    const provider = {
      id: crypto.randomUUID(),
      name,
      type,
      baseUrl,
      token: "glpat-****" // Masked for UI
    };
    providers.push({ ...provider, encryptedToken });

    logs.push({
      timestamp: new Date().toISOString(),
      level: "info",
      code: "H-PROV-ADD",
      provider: type,
      message: `New provider registered: ${name}`,
      technical_context: `Provider ID: ${provider.id}, Type: ${type}, BaseURL: ${baseUrl}`,
      ui_message: `Connected new adapter: ${name}`,
      resolution: "Provider is now available for mirroring."
    });

    res.status(201).json(provider);
  });

  app.post("/api/v1/webhooks/incoming/:providerId", (req, res) => {
    // In a real app, we'd verify HMAC signature here
    console.log(`Incoming webhook for ${req.params.providerId}`);
    res.status(202).json({ message: "Accepted" });
  });

  app.delete("/api/v1/auth/providers/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const index = providers.findIndex(p => p.id === id);
    if (index !== -1) {
      const deleted = providers.splice(index, 1)[0];
      logs.push({
        timestamp: new Date().toISOString(),
        level: "warn",
        code: "H-PROV-DELETE",
        provider: deleted.id,
        message: `Provider node ${deleted.name} decommissioned`,
        technical_context: `Removed from active provider pool`,
        ui_message: `Provider ${deleted.name} has been removed.`,
        resolution: "No action required."
      });
      res.json({ message: "Provider deleted" });
    } else {
      res.status(404).json({ error: "Provider not found" });
    }
  });

  app.get("/api/v1/system/stats", authenticateToken, (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      memory: {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
        external: (memoryUsage.external / 1024 / 1024).toFixed(2) + " MB",
      },
      uptime: Math.floor(uptime) + "s",
      cpu: {
        user: (cpuUsage.user / 1000000).toFixed(2) + "s",
        system: (cpuUsage.system / 1000000).toFixed(2) + "s",
      },
      platform: process.platform,
      nodeVersion: process.version,
      arch: process.arch
    });
  });

  app.get("/api/v1/system/providers-info", authenticateToken, (req, res) => {
    res.json({
      providers: [
        { name: "GitHub", apiVersion: "v3 (REST)", status: "connected" },
        { name: "GitLab", apiVersion: "v4", status: "connected" },
        { name: "Gogs", apiVersion: "v1", status: "connected" },
        { name: "Forgejo", apiVersion: "v1", status: "connected" },
        { name: "Gitea", apiVersion: "v1", status: "connected" }
      ]
    });
  });

  app.get("/api/v1/system/dlq", authenticateToken, (req, res) => {
    res.json({ dlq_items: dlqItems });
  });

  app.get("/api/v1/system/sync-matrix", authenticateToken, (req, res) => {
    res.json({ sync_matrix: syncMatrix });
  });

  app.post("/api/v1/system/dlq/:id/replay", authenticateToken, (req, res) => {
    const index = dlqItems.findIndex(i => i.id === req.params.id);
    if (index > -1) {
      const item = dlqItems.splice(index, 1)[0];
      
      logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        code: "H-DLQ-REPLAY",
        provider: item.target_provider,
        message: `Replay initiated for DLQ item: ${item.id}`,
        technical_context: `Replaying sync for ${item.repository_id} -> ${item.target_provider}`,
        ui_message: `Replaying failed sync for ${item.repository_id}`,
        resolution: "Monitoring replay progress."
      });

      // Logic to move back to active queue
      res.status(200).json({ message: "Replay initiated" });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  });

  app.get("/api/v1/logs/translated", authenticateToken, (req, res) => {
    const verbosity = req.query.verbosity || "human";
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Truncate logs if they exceed limit
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }

    const result = logs.slice(-limit).reverse().map(log => {
      if (verbosity === "human") {
        return {
          timestamp: log.timestamp,
          level: log.level,
          ui_message: log.ui_message,
          technical_context: log.technical_context,
          resolution: log.resolution
        };
      }
      return log;
    });
    
    res.json({ logs: result });
  });

  app.get("/api/v1/auth/providers", authenticateToken, (req, res) => {
    res.json(providers.map(p => ({
      ...p,
      token: p.token || (p.encryptedToken ? "ENCRYPTED" : "MISSING")
    })));
  });

  app.post("/api/v1/source/selection", authenticateToken, (req, res) => {
    const { selectedRepos, targetProviderIds } = req.body;
    
    // Automation logic for target repository creation
    const selectedRepoDetails = selectedRepos.map((repo: any) => {
      return { 
        id: repo.id, 
        name: repo.name, 
        description: repo.description || "Automated mirror target", 
        tags: repo.tags || ["hydrozoa", "mirror"] 
      };
    });

    targetProviderIds.forEach((providerId: string) => {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return;

      selectedRepoDetails.forEach((repo: any) => {
        // Log the check interaction
        logs.push({
          timestamp: new Date().toISOString(),
          level: "info",
          code: "H-TARGET-CHECK",
          provider: provider.type,
          message: `Checking if target repository '${repo.name}' exists on ${provider.name}`,
          technical_context: `GET ${provider.baseUrl}/api/v1/repos/${repo.name}`,
          ui_message: `Verifying target repository on ${provider.name}`,
          resolution: "Automated check initiated by Hydrozoa."
        });

        // Simulate "not found" and "creation" logic
        const exists = Math.random() > 0.7; // 30% chance it already exists
        
        if (!exists) {
          logs.push({
            timestamp: new Date().toISOString(),
            level: "info",
            code: "H-TARGET-CREATE",
            provider: provider.type,
            message: `Creating target repository '${repo.name}' on ${provider.name}`,
            technical_context: `POST ${provider.baseUrl}/api/v1/repos { name: "${repo.name}", description: "${repo.description}", tags: ${JSON.stringify(repo.tags)} }`,
            ui_message: `Created missing target repository: ${repo.name}`,
            resolution: "Repository was missing and has been automatically provisioned with metadata."
          });

          // Add to sync matrix if not already there
          const existingSync = syncMatrix.find(s => s.source_repo === repo.name);
          if (existingSync) {
            if (!existingSync.targets.find((t: any) => t.provider_id === providerId)) {
              existingSync.targets.push({
                provider_id: providerId,
                status: 'pending',
                last_sync: new Date().toISOString(),
                bytes_transferred: "0B",
                progress: 0
              });
            }
          } else {
            syncMatrix.push({
              id: `sm-${crypto.randomUUID().slice(0, 8)}`,
              source_repo: repo.name,
              source_provider: "p1", // Assuming p1 is the default source for this mock
              branch: "main",
              last_commit: "initial",
              sync_interval: 15,
              last_sync_duration: "0s",
              success_rate: 100,
              targets: [{
                provider_id: providerId,
                status: 'pending',
                last_sync: new Date().toISOString(),
                bytes_transferred: "0B",
                progress: 0
              }]
            });
          }
        } else {
          logs.push({
            timestamp: new Date().toISOString(),
            level: "info",
            code: "H-TARGET-EXISTS",
            provider: provider.type,
            message: `Target repository '${repo.name}' already exists on ${provider.name}`,
            technical_context: `Target verified: ${repo.name}`,
            ui_message: `Target repository verified: ${repo.name}`,
            resolution: "No creation required."
          });
        }
      });
    });

    console.log("Saving repository selection:", selectedRepos.map((r: any) => r.name), "Targets:", targetProviderIds);
    res.json({ message: "Selection saved and targets provisioned", count: selectedRepos.length });
  });

  // Analytics endpoint for ApexCharts
  app.get("/api/v1/analytics/sync-metrics", authenticateToken, (req, res) => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      x: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      y: syncMatrix.length > 0 ? Math.floor(Math.random() * 100) : 0
    }));
    res.json(data);
  });

  app.get("/api/v1/system/settings", authenticateToken, (req, res) => {
    res.json({
      sync_interval: 15,
      encryption_enabled: true,
      log_retention_days: 7,
      max_concurrent_syncs: 5,
      bidirectional_sync: false,
      conflict_strategy: "source_wins"
    });
  });

  app.post("/api/v1/system/settings", authenticateToken, (req, res) => {
    // Update settings logic
    logs.push({
      timestamp: new Date().toISOString(),
      level: "info",
      code: "H-SYS-CONFIG",
      provider: "system",
      message: "System settings updated",
      technical_context: `Updated settings: ${JSON.stringify(req.body)}`,
      ui_message: "Configuration synchronized successfully.",
      resolution: "No action required."
    });
    res.json({ message: "Settings updated", settings: req.body });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
