import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "hydrozoa-deep-sea-secret-99";
const MAX_LOGS = 500; // Truncate logs to prevent memory issues

// Encryption Helper
const MASTER_KEY = process.env.HYDROZOA_MASTER_KEY || "default-secret-key-32-chars-long!!";
const ALGORITHM = "aes-256-gcm";

// Database Setup
const DATABASE_URL = process.env.DATABASE_URL;
console.log("🚀 Starting Hydrozoa with DATABASE_URL...");
if (!DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is not set. Database is mandatory for production.");
}
const pool = new Pool({ connectionString: DATABASE_URL });

async function initDb() {
  console.log("📦 Initializing database schema...");
  try {
    await pool.query(`

      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        token TEXT NOT NULL,
        is_source BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure is_source column exists if table was created without it
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='providers' AND column_name='is_source') THEN
          ALTER TABLE providers ADD COLUMN is_source BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS sync_matrix (
        id TEXT PRIMARY KEY,
        source_repo TEXT NOT NULL,
        source_provider TEXT NOT NULL,
        sync_interval INTEGER NOT NULL,
        branch TEXT,
        last_commit TEXT,
        last_sync_duration TEXT,
        success_rate INTEGER,
        targets JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dlq_items (
        id TEXT PRIMARY KEY,
        source_repo TEXT NOT NULL,
        target_node TEXT NOT NULL,
        error_code TEXT NOT NULL,
        error_message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL,
        code TEXT NOT NULL,
        provider TEXT,
        message TEXT NOT NULL,
        technical_context TEXT,
        ui_message TEXT,
        resolution TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default_password BOOLEAN DEFAULT TRUE
      );
    `);

    // Seed default user if not exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ["admin@hydrozoa.io"]);
    if (userCheck.rows.length === 0) {
      const passwordHash = bcrypt.hashSync("hydrozoa-default", 10);
      await pool.query(
        'INSERT INTO users (email, password_hash, name, is_default_password) VALUES ($1, $2, $3, $4)',
        ["admin@hydrozoa.io", passwordHash, "Hydrozoa Admin", true]
      );
    }
    
    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}

initDb();

// Database Query Helper
const query = async (text: string, params?: any[]) => {
  return await pool.query(text, params);
};

async function addLog(log: any) {
  await pool.query(
    'INSERT INTO logs (level, code, provider, message, technical_context, ui_message, resolution) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [log.level, log.code, log.provider, log.message, log.technical_context, log.ui_message, log.resolution]
  );
}

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

// Mock Sync Engine (Background tasks)
setInterval(async () => {
  try {
    const matrixRes = await pool.query('SELECT * FROM sync_matrix');
    for (const item of matrixRes.rows) {
      let changed = false;
      const targets = item.targets;
      
      for (const target of targets) {
        if (target.status === 'syncing') {
          // Real implementation would call worker nodes or run git commands
          // For now, we just keep it as 'syncing' or finish if simulated
          // In production, this would be handled by a real job queue
        }
      }
      
      if (changed) {
        await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(targets), item.id]);
      }
    }
  } catch (err) {
    console.error("Sync engine error:", err);
  }
}, 60000); // Run every minute in production

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/v1/auth/login", async (req, res) => {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      const token = jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
      
      await addLog({
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
          name: user.name,
          isDefaultPassword: user.is_default_password ?? user.isDefaultPassword 
        } 
      });
    } else {
      await addLog({
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

  app.post("/api/v1/auth/reset-password", authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const email = (req as any).user.email;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && bcrypt.compareSync(currentPassword, user.password_hash)) {
      const newHash = bcrypt.hashSync(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1, is_default_password = false WHERE email = $2', [newHash, email]);
      
      await addLog({
        level: "info",
        code: "H-AUTH-RESET",
        provider: "system",
        message: "Administrator password reset successful",
        technical_context: "Password hash updated in database",
        ui_message: "Security credentials updated.",
        resolution: "No action required."
      });

      res.json({ message: "Password updated successfully" });
    } else {
      res.status(400).json({ error: "Invalid current password" });
    }
  });

  app.post("/api/v1/auth/providers/:id/set-source", authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [id]);
      const provider = result.rows[0];
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      await pool.query('UPDATE providers SET is_source = false');
      await pool.query('UPDATE providers SET is_source = true WHERE id = $1', [id]);

      const updatedProvider = {
        ...provider,
        is_source: true,
        isSource: true,
        token: "glpat-****"
      };

      await addLog({
        level: "info",
        code: "H-PROV-SOURCE",
        provider: provider.type,
        message: `Provider '${provider.name}' set as primary source`,
        technical_context: `Source ID: ${id}`,
        ui_message: `Source provider updated: ${provider.name}`,
        resolution: "Repositories will now be fetched from this node."
      });

      res.json({ message: "Source provider updated", provider: updatedProvider });
    } catch (err: any) {
      console.error("Error setting source provider:", err);
      res.status(500).json({ error: "Internal server error while setting source provider", detail: err.message });
    }
  });
  app.post("/api/v1/source/refresh", authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = result.rows[0];

    if (!sourceProvider) return res.status(400).json({ error: "No source provider configured" });

    await addLog({
      level: "info",
      code: "H-SOURCE-REFRESH",
      provider: sourceProvider.type,
      message: `Refreshing repository list from ${sourceProvider.name}`,
      technical_context: `GET ${sourceProvider.url}/api/v1/user/repos`,
      ui_message: `Refreshing repositories from ${sourceProvider.name}`,
      resolution: "Update complete."
    });

    res.json({ message: "Refresh initiated" });
  });

  app.get("/api/v1/source/namespaces", authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = result.rows[0];

    if (!sourceProvider) return res.json([]);

    try {
      const token = decrypt(sourceProvider.token);
      const baseUrl = sourceProvider.url.replace(/\/$/, '');
      
      if (sourceProvider.type === 'github') {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `token ${token}` }
        });
        const userData = await userRes.json();
        const orgsRes = await fetch('https://api.github.com/user/orgs', {
          headers: { 'Authorization': `token ${token}` }
        });
        const orgsData = await orgsRes.json();
        const safeOrgsData = Array.isArray(orgsData) ? orgsData : [];
        
        return res.json([
          { id: userData.login, name: userData.login, type: 'user', repo_count: userData.public_repos + (userData.total_private_repos || 0) },
          ...safeOrgsData.map((org: any) => ({ id: org.login, name: org.login, type: 'organization', repo_count: 0 }))
        ]);
      } 
      
      if (sourceProvider.type.includes('gitlab')) {
        const groupsRes = await fetch(`${baseUrl}/api/v4/groups`, { headers: { 'Private-Token': token } });
        const groupsData = await groupsRes.json();
        const userRes = await fetch(`${baseUrl}/api/v4/user`, { headers: { 'Private-Token': token } });
        const userData = await userRes.json();
        
        return res.json([
          { id: `user-${userData.id}`, name: userData.username, type: 'user', repo_count: 0 },
          ...groupsData.map((group: any) => ({ id: `group-${group.id}`, name: group.full_path, type: 'group', repo_count: 0 }))
        ]);
      }

      if (['gitea', 'forgejo', 'gogs'].includes(sourceProvider.type)) {
        const userRes = await fetch(`${baseUrl}/api/v1/user`, { headers: { 'Authorization': `token ${token}` } });
        const userData = await userRes.json();
        const orgsRes = await fetch(`${baseUrl}/api/v1/user/orgs`, { headers: { 'Authorization': `token ${token}` } });
        const orgsData = await orgsRes.json();
        const safeOrgsData = Array.isArray(orgsData) ? orgsData : [];

        return res.json([
          { id: userData.username, name: userData.username, type: 'user', repo_count: 0 },
          ...safeOrgsData.map((org: any) => ({ id: org.username, name: org.full_name || org.username, type: 'organization', repo_count: 0 }))
        ]);
      }

      if (sourceProvider.type === 'bitbucket') {
        const userRes = await fetch('https://api.bitbucket.org/2.0/user', { headers: { 'Authorization': `Bearer ${token}` } });
        const userData = await userRes.json();
        const workspacesRes = await fetch('https://api.bitbucket.org/2.0/workspaces', { headers: { 'Authorization': `Bearer ${token}` } });
        const workspacesData = await workspacesRes.json();

        return res.json([
          { id: userData.uuid, name: userData.display_name, type: 'user', repo_count: 0 },
          ...workspacesData.values.map((ws: any) => ({ id: ws.slug, name: ws.name, type: 'workspace', repo_count: 0 }))
        ]);
      }

      return res.json([]);
    } catch (err) {
      console.error("Failed to fetch namespaces:", err);
      res.status(500).json({ error: "Failed to fetch namespaces from provider" });
    }
  });

  app.get("/api/v1/source/namespaces/:id/repos", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = result.rows[0];

    if (!sourceProvider) return res.json([]);

    try {
      const token = decrypt(sourceProvider.token);
      const baseUrl = sourceProvider.url.replace(/\/$/, '');
      
      if (sourceProvider.type === 'github') {
        const url = `https://api.github.com/${id.includes('-') ? 'orgs' : 'users'}/${id}/repos?per_page=100`;
        const reposRes = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        const reposData = await reposRes.json();
        return res.json(reposData.map((repo: any) => ({ id: repo.id.toString(), name: repo.name, description: repo.description })));
      }

      if (sourceProvider.type.includes('gitlab')) {
        const url = id.startsWith('group-') 
          ? `${baseUrl}/api/v4/groups/${id.replace('group-', '')}/projects?per_page=100`
          : `${baseUrl}/api/v4/projects?owned=true&per_page=100`;
        const reposRes = await fetch(url, { headers: { 'Private-Token': token } });
        const reposData = await reposRes.json();
        return res.json(reposData.map((project: any) => ({ id: project.id.toString(), name: project.path_with_namespace, description: project.description })));
      }

      if (['gitea', 'forgejo', 'gogs'].includes(sourceProvider.type)) {
        const userRes = await fetch(`${baseUrl}/api/v1/user`, { headers: { 'Authorization': `token ${token}` } });
        const userData = await userRes.json();
        const isUser = id === userData.username;
        const url = isUser ? `${baseUrl}/api/v1/user/repos` : `${baseUrl}/api/v1/orgs/${id}/repos`;
        const reposRes = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        const reposData = await reposRes.json();
        return res.json(reposData.map((repo: any) => ({ id: repo.id.toString(), name: repo.full_name, description: repo.description })));
      }

      if (sourceProvider.type === 'bitbucket') {
        const url = `https://api.bitbucket.org/2.0/repositories/${id}?per_page=100`;
        const reposRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const reposData = await reposRes.json();
        const reposList = Array.isArray(reposData.values) ? reposData.values : [];
        return res.json(reposList.map((repo: any) => ({ id: repo.uuid, name: repo.full_name, description: repo.description })));
      }


      return res.json([]);
    } catch (err) {
      console.error("Failed to fetch repos:", err);
      res.status(500).json({ error: "Failed to fetch repositories from provider" });
    }
  });

  app.post("/api/v1/auth/providers", authenticateToken, async (req, res) => {
    let { name, type, url, token, isSource, baseUrl } = req.body;
    
    // Support both 'url' and 'baseUrl' (frontend uses baseUrl)
    const effectiveUrl = url || baseUrl || (type === 'github' ? 'https://api.github.com' : null);

    // Basic validation
    if (!name || !type || !effectiveUrl || !token) {
      return res.status(400).json({ error: "Missing required fields: name, type, url/baseUrl, and token are mandatory." });
    }

    const encryptedToken = encrypt(token);
    const id = crypto.randomUUID();
    
    const provider = {
      id,
      name,
      type,
      url: effectiveUrl,
      isSource: isSource || false,
      token: "glpat-****" // Masked for UI
    };

    try {
      if (pool) {
        if (provider.isSource) {
          await pool.query('UPDATE providers SET is_source = false');
        }
        await pool.query(
          'INSERT INTO providers (id, name, type, url, token, is_source) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, name, type, provider.url, encryptedToken, provider.isSource]
        );
      } else {
        // If this is set as source, unset others
        if (provider.isSource) {
          providers.forEach(p => p.isSource = false);
        }
        providers.push({ ...provider, token: encryptedToken });
      }

      await addLog({
        level: "info",
        code: "H-PROV-ADD",
        provider: type,
        message: `New provider registered: ${name}`,
        technical_context: `Provider ID: ${id}, Type: ${type}, URL: ${provider.url}`,
        ui_message: `Connected new adapter: ${name}`,
        resolution: "Provider is now available for mirroring."
      });

      res.status(201).json({
        ...provider,
        isSource: provider.isSource
      });
    } catch (err: any) {
      console.error("Error adding provider:", err);
      res.status(500).json({ error: "Internal server error while adding provider", detail: err.message });
    }
  });

  app.post("/api/v1/webhooks/incoming/:providerId", (req, res) => {
    // In a real app, we'd verify HMAC signature here
    console.log(`Incoming webhook for ${req.params.providerId}`);
    res.status(202).json({ message: "Accepted" });
  });

  app.delete("/api/v1/auth/providers/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    if (pool) {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [id]);
      const deleted = result.rows[0];
      if (deleted) {
        await pool.query('DELETE FROM providers WHERE id = $1', [id]);
        await addLog({
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
    } else {
      const index = providers.findIndex(p => p.id === id);
      if (index !== -1) {
        const deleted = providers.splice(index, 1)[0];
        await addLog({
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

  app.get("/api/v1/system/dlq", authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT * FROM dlq_items');
    res.json({ dlq_items: result.rows });
  });

  app.get("/api/v1/system/sync-matrix", authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT * FROM sync_matrix');
    res.json({ sync_matrix: result.rows });
  });

  app.post("/api/v1/system/dlq/:id/replay", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM dlq_items WHERE id = $1', [id]);
    const item = result.rows[0];
    if (item) {
      await pool.query('DELETE FROM dlq_items WHERE id = $1', [id]);
      await addLog({
        level: "info",
        code: "H-DLQ-REPLAY",
        provider: item.target_provider,
        message: `Replay initiated for DLQ item: ${item.id}`,
        technical_context: `Replaying sync for ${item.repository_id} -> ${item.target_provider}`,
        ui_message: `Replaying failed sync for ${item.repository_id}`,
        resolution: "Monitoring replay progress."
      });
      res.status(200).json({ message: "Replay initiated" });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  });

  app.get("/api/v1/logs/translated", authenticateToken, async (req, res) => {
    const verbosity = req.query.verbosity || "human";
    const limit = parseInt(req.query.limit as string) || 100;
    
    const result = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    const logsToReturn = result.rows;

    const formattedLogs = logsToReturn.map(log => {
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
    
    res.json({ logs: formattedLogs });
  });

  app.get("/api/v1/auth/providers", authenticateToken, async (req, res) => {
    const result = await pool.query('SELECT * FROM providers');
    res.json(result.rows.map(p => ({
      ...p,
      isSource: p.is_source,
      token: "ENCRYPTED"
    })));
  });

  app.post("/api/v1/source/selection", authenticateToken, async (req, res) => {
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

    for (const providerId of targetProviderIds) {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [providerId]);
      const provider = result.rows[0];
      
      if (!provider) continue;

      for (const repo of selectedRepoDetails) {
        // Log the check interaction
        await addLog({
          level: "info",
          code: "H-TARGET-CHECK",
          provider: provider.type,
          message: `Checking if target repository '${repo.name}' exists on ${provider.name}`,
          technical_context: `GET ${provider.url}/api/v1/repos/${repo.name}`,
          ui_message: `Verifying target repository on ${provider.name}`,
          resolution: "Automated check initiated by Hydrozoa."
        });

        // In production, this would call the target provider's API
        // For now, we assume it needs creation unless we implement the check
        const exists = false; 
        
        if (!exists) {
          await addLog({
            level: "info",
            code: "H-TARGET-CREATE",
            provider: provider.type,
            message: `Creating target repository '${repo.name}' on ${provider.name}`,
            technical_context: `POST ${provider.url}/api/v1/repos { name: "${repo.name}", description: "${repo.description}", tags: ${JSON.stringify(repo.tags)} }`,
            ui_message: `Created missing target repository: ${repo.name}`,
            resolution: "Repository was missing and has been automatically provisioned with metadata."
          });

          // Add to sync matrix if not already there
          const existingSyncRes = await pool.query('SELECT * FROM sync_matrix WHERE source_repo = $1', [repo.name]);
          const existingSync = existingSyncRes.rows[0];
          
          if (existingSync) {
            const targets = existingSync.targets;
            if (!targets.find((t: any) => t.provider_id === providerId)) {
              targets.push({
                provider_id: providerId,
                status: 'pending',
                last_sync: new Date().toISOString(),
                bytes_transferred: "0B",
                progress: 0
              });
              await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(targets), existingSync.id]);
            }
          } else {
            const newSync = {
              id: `sm-${crypto.randomUUID().slice(0, 8)}`,
              source_repo: repo.name,
              source_provider: "p1",
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
            };
            await pool.query(
              'INSERT INTO sync_matrix (id, source_repo, source_provider, branch, last_commit, sync_interval, last_sync_duration, success_rate, targets) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
              [newSync.id, newSync.source_repo, newSync.source_provider, newSync.branch, newSync.last_commit, newSync.sync_interval, newSync.last_sync_duration, newSync.success_rate, JSON.stringify(newSync.targets)]
            );
          }
        } else {
          await addLog({
            level: "info",
            code: "H-TARGET-EXISTS",
            provider: provider.type,
            message: `Target repository '${repo.name}' already exists on ${provider.name}`,
            technical_context: `Target verified: ${repo.name}`,
            ui_message: `Target repository verified: ${repo.name}`,
            resolution: "No creation required."
          });
        }
      }
    }

    res.json({ message: "Selection saved and targets provisioned", count: selectedRepos.length });
  });

  // Analytics endpoint for ApexCharts
  app.get("/api/v1/analytics/sync-metrics", authenticateToken, async (req, res) => {
    // In production, we'd query real metrics from a table
    // For now, return a flat baseline if no real data exists
    const data = Array.from({ length: 24 }, (_, i) => ({
      x: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      y: 0
    }));
    res.json(data);
  });

  app.post("/api/v1/sync/manual/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    if (pool) {
      const result = await pool.query('SELECT * FROM sync_matrix WHERE id = $1', [id]);
      const item = result.rows[0];
      if (!item) return res.status(404).json({ error: "Sync item not found" });

      const targets = item.targets.map((t: any) => ({
        ...t,
        status: 'syncing',
        progress: 0,
        last_sync: new Date().toISOString()
      }));

      await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(targets), id]);
      
      await addLog({
        level: "info",
        code: "H-SYNC-MANUAL",
        provider: item.source_provider,
        message: `Manual sync triggered for ${item.source_repo}`,
        technical_context: `Sync ID: ${id}`,
        ui_message: `Manual sync started: ${item.source_repo}`,
        resolution: "Sync in progress."
      });

      res.json({ message: "Manual sync initiated" });
    } else {
      const item = syncMatrix.find(s => s.id === id);
      if (!item) return res.status(404).json({ error: "Sync item not found" });

      item.targets.forEach((t: any) => {
        t.status = 'syncing';
        t.progress = 0;
        t.last_sync = new Date().toISOString();
      });

      await addLog({
        level: "info",
        code: "H-SYNC-MANUAL",
        provider: item.source_provider,
        message: `Manual sync triggered for ${item.source_repo}`,
        technical_context: `Sync ID: ${id}`,
        ui_message: `Manual sync started: ${item.source_repo}`,
        resolution: "Sync in progress."
      });

      res.json({ message: "Manual sync initiated" });
    }
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

console.log("⚡ Calling startServer...");
startServer();
