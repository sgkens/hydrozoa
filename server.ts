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

// Console Styling Helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m"
};

const sysLog = {
  info: (msg: string) => console.log(`${colors.bgBlue}${colors.white} INFO ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.bgGreen}${colors.white}  OK  ${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.bgYellow}${colors.white} WARN ${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${colors.bgRed}${colors.white} FAIL ${colors.reset} ${msg}`),
  startup: (msg: string) => console.log(`${colors.magenta}${colors.bright}${msg}${colors.reset}`),
  debug: (msg: string) => console.log(`${colors.gray}${colors.dim}🔍 ${msg}${colors.reset}`)
};

const printHeader = () => {
  console.log(`${colors.cyan}${colors.bright}
   __  __           __                                
  / / / /_  _______/ /________  __________  ____ _
 / /_/ / / / / __  / ___/ __ \\/_  /_  __ \\/ __ \`/
/ __  / /_/ / /_/ / /  / /_/ / / /_/ /_/ / /_/ / 
/_/ /_/\\__, /\\__,_/_/   \\____/ /___/\\____/\\__,_/  
      /____/                                       
${colors.reset}${colors.gray}--- High Performance Repository Mirror Engine ---${colors.reset}
`);
};

// Database Setup
const DATABASE_URL = process.env.DATABASE_URL;
printHeader();
sysLog.startup("Starting Hydrozoa instance...");

if (!DATABASE_URL) {
  sysLog.error("DATABASE_URL is not set. Database is mandatory for production.");
  process.exit(1);
}
const pool = new Pool({ connectionString: DATABASE_URL });

async function initDb() {
  sysLog.info("Initializing database schema...");
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
        entities JSONB DEFAULT '["code"]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure entities column exists if table was created without it
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_matrix' AND column_name='entities') THEN
          ALTER TABLE sync_matrix ADD COLUMN entities JSONB DEFAULT '["code"]';
        END IF;
      END $$;

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
    
    sysLog.success("Database initialized successfully");
  } catch (err) {
    sysLog.error(`Database initialization failed: ${err}`);
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

async function getProviderUser(provider: any, token: string): Promise<string | null> {
  const type = provider.type.toLowerCase();
  const baseUrl = provider.url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'User-Agent': 'Hydrozoa-Mirror-Agent',
    'Accept': 'application/json'
  };

  try {
    if (type === 'github') {
      headers['Authorization'] = `token ${token}`;
      const res = await fetch(`${baseUrl}/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.login;
      }
    } else if (type.includes('gitlab')) {
      headers['Private-Token'] = token;
      const res = await fetch(`${baseUrl}/api/v4/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.username;
      }
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      headers['Authorization'] = `token ${token}`;
      const res = await fetch(`${baseUrl}/api/v1/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.username;
      }
    } else if (type === 'bitbucket') {
      headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/2.0/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.nickname || data.username || data.uuid;
      }
    }
  } catch (err) {
    sysLog.error(`Error fetching user for ${provider.name}: ${err}`);
  }
  return null;
}

async function provisionTargetRepository(provider: any, repoName: string, description: string, token: string) {
  const type = provider.type.toLowerCase();
  const baseUrl = provider.url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'User-Agent': 'Hydrozoa-Mirror-Agent',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Step 1: Normalize repo name and find namespace
  let owner = "";
  let name = repoName;
  if (repoName.includes('/')) {
    const parts = repoName.split('/');
    name = parts.pop()!;
    owner = parts.join('/');
  }

  // If no owner, get default
  if (!owner) {
    owner = await getProviderUser(provider, token) || "";
  }
  
  const fullName = owner ? `${owner}/${name}` : name;

  // Logging check
  await addLog({
    level: "info",
    code: "H-TARGET-CHECK",
    provider: provider.type,
    message: `Checking if target repository '${fullName}' exists on ${provider.name}`,
    technical_context: `Verifying existence of ${fullName} via API (Base: ${baseUrl})`,
    ui_message: `Verifying target repository on ${provider.name}`,
    resolution: "Automated check initiated."
  });

  try {
    let exists = false;
    if (type === 'github') {
      headers['Authorization'] = `token ${token}`;
      const res = await fetch(`${baseUrl}/repos/${fullName}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (type.includes('gitlab')) {
      headers['Private-Token'] = token;
      const res = await fetch(`${baseUrl}/api/v4/projects/${encodeURIComponent(fullName)}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      headers['Authorization'] = `token ${token}`;
      const res = await fetch(`${baseUrl}/api/v1/repos/${fullName}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (type === 'bitbucket') {
      headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/2.0/repositories/${fullName}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    }

    if (exists) {
      await addLog({
        level: "info",
        code: "H-TARGET-EXISTS",
        provider: provider.type,
        message: `Target repository '${fullName}' already exists on ${provider.name}`,
        technical_context: `Target verified: ${fullName}`,
        ui_message: `Target repository verified: ${fullName}`,
        resolution: "No creation required."
      });
      return { status: 'exists', message: `Repository ${fullName} already exists` };
    }

    // Step 2: Create
    await addLog({
      level: "info",
      code: "H-TARGET-CREATE",
      provider: provider.type,
      message: `Creating target repository '${fullName}' on ${provider.name}`,
      technical_context: `Triggering repository creation for ${fullName}`,
      ui_message: `Provisioning target repository: ${fullName}`,
      resolution: "Repository was missing and is being automatically provisioned."
    });

    let createRes;
    if (type === 'github') {
      const currentUser = await getProviderUser(provider, token);
      const createUrl = owner === currentUser ? `${baseUrl}/user/repos` : `${baseUrl}/orgs/${owner}/repos`;
      createRes = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, description, private: true })
      });
    } else if (type.includes('gitlab')) {
      createRes = await fetch(`${baseUrl}/api/v4/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, path: name, visibility: 'private', description })
      });
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      const currentUser = await getProviderUser(provider, token);
      const createUrl = owner === currentUser ? `${baseUrl}/api/v1/user/repos` : `${baseUrl}/api/v1/org/${owner}/repos`;
      createRes = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, description, private: true })
      });
    } else if (type === 'bitbucket') {
      createRes = await fetch(`${baseUrl}/2.0/repositories/${fullName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scm: 'git', is_private: true, description })
      });
    }

    if (createRes && createRes.ok) {
      await addLog({
        level: "info",
        code: "H-TARGET-SUCCESS",
        provider: provider.type,
        message: `Successfully created target repository '${fullName}' on ${provider.name}`,
        technical_context: `Creation successful for ${fullName}`,
        ui_message: `Provisioned repository: ${fullName}`,
        resolution: "Repository is now ready for mirroring."
      });
      return { status: 'created', message: `Repository ${fullName} created` };
    } else {
      const errText = createRes ? await createRes.text() : "Unknown error";
      await addLog({
        level: "error",
        code: "H-TARGET-FAIL",
        provider: provider.type,
        message: `Failed to create target repository '${fullName}' on ${provider.name}`,
        technical_context: `API error: ${errText}`,
        ui_message: `Failed to provision repository: ${fullName}`,
        resolution: "Check provider permissions and quota."
      });
      return { status: 'failed', message: `Failed to create repository ${fullName}`, error: errText };
    }

  } catch (err: any) {
    sysLog.error(`Provisioning error: ${err.message}`);
    return { status: 'failed', message: `Unexpected error during provisioning`, error: err.message };
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
    sysLog.error(`Sync engine error: ${err}`);
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
        baseUrl: provider.url,
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
      sysLog.error(`Error setting source provider: ${err}`);
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
      const headers: Record<string, string> = {
        'User-Agent': 'Hydrozoa-Mirror-Agent',
        'Accept': 'application/json'
      };
      
      if (sourceProvider.type === 'github') {
        headers['Authorization'] = `token ${token}`;
        sysLog.info("Fetching GitHub namespaces...");
        
        const userRes = await fetch('https://api.github.com/user', { headers });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`GitHub User API failed (${userRes.status}): ${errText}`);
          return res.status(502).json({ error: "GitHub API authentication failed", detail: errText });
        }

        const userData = await userRes.json();
        
        const orgsRes = await fetch('https://api.github.com/user/orgs', { headers });
        if (!orgsRes.ok) {
          const errText = await orgsRes.text();
          sysLog.error(`GitHub Orgs API failed (${orgsRes.status}): ${errText}`);
          // Don't fail entire request if only orgs fail
        }
        const orgsData = await orgsRes.json();
        const safeOrgsData = Array.isArray(orgsData) ? orgsData : [];
        
        sysLog.success(`Found user ${userData.login} and ${safeOrgsData.length} organizations`);

        return res.json([
          { id: userData.login, name: userData.login, type: 'user', repo_count: userData.public_repos + (userData.total_private_repos || 0) },
          ...safeOrgsData.map((org: any) => ({ id: org.login, name: org.login, type: 'organization', repo_count: 0 }))
        ]);
      } 
      
      if (sourceProvider.type.includes('gitlab')) {
        headers['Private-Token'] = token;
        sysLog.info(`Fetching GitLab namespaces from: ${baseUrl}`);

        const userRes = await fetch(`${baseUrl}/api/v4/user`, { headers });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`GitLab User API failed (${userRes.status}): ${errText}`);
          return res.status(502).json({ error: "GitLab API authentication failed", detail: errText });
        }

        const userData = await userRes.json();

        const groupsRes = await fetch(`${baseUrl}/api/v4/groups`, { headers });
        if (!groupsRes.ok) {
          const errText = await groupsRes.text();
          sysLog.error(`GitLab Groups API failed (${groupsRes.status}): ${errText}`);
        }
        const groupsData = await groupsRes.json();
        
        const safeGroupsData = Array.isArray(groupsData) ? groupsData : [];
        sysLog.success(`Found user ${userData.username} and ${safeGroupsData.length} groups`);

        return res.json([
          { id: `user-${userData.id}`, name: userData.username, type: 'user', repo_count: 0 },
          ...safeGroupsData.map((group: any) => ({ id: `group-${group.id}`, name: group.full_path, type: 'group', repo_count: 0 }))
        ]);
      }

      if (['gitea', 'forgejo', 'gogs'].includes(sourceProvider.type)) {
        sysLog.info(`Fetching ${sourceProvider.type} namespaces from: ${baseUrl}`);
        const userRes = await fetch(`${baseUrl}/api/v1/user`, { headers: { 'Authorization': `token ${token}` } });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`${sourceProvider.type} User API failed (${userRes.status}): ${errText}`);
          const hydrozoaStatus = [401, 403].includes(userRes.status) ? 502 : userRes.status;
          return res.status(hydrozoaStatus).json({ error: `${sourceProvider.type} API authentication failed`, detail: errText });
        }
        const userData = await userRes.json();

        const orgsRes = await fetch(`${baseUrl}/api/v1/user/orgs`, { headers: { 'Authorization': `token ${token}` } });
        if (!orgsRes.ok) {
          const errText = await orgsRes.text();
          sysLog.error(`${sourceProvider.type} Orgs API failed (${orgsRes.status}): ${errText}`);
        }
        const orgsData = await orgsRes.json();
        const safeOrgsData = Array.isArray(orgsData) ? orgsData : [];

        sysLog.success(`Found user ${userData.username} and ${safeOrgsData.length} organizations on ${sourceProvider.type}`);

        return res.json([
          { id: userData.username, name: userData.username, type: 'user', repo_count: 0 },
          ...safeOrgsData.map((org: any) => ({ id: org.username, name: org.full_name || org.username, type: 'organization', repo_count: 0 }))
        ]);
      }

      if (sourceProvider.type === 'bitbucket') {
        sysLog.info("Fetching Bitbucket namespaces...");
        const userRes = await fetch('https://api.bitbucket.org/2.0/user', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`Bitbucket User API failed (${userRes.status}): ${errText}`);
          const hydrozoaStatus = [401, 403].includes(userRes.status) ? 502 : userRes.status;
          return res.status(hydrozoaStatus).json({ error: "Bitbucket API authentication failed", detail: errText });
        }
        const userData = await userRes.json();

        const workspacesRes = await fetch('https://api.bitbucket.org/2.0/workspaces', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!workspacesRes.ok) {
          const errText = await workspacesRes.text();
          sysLog.error(`Bitbucket Workspaces API failed (${workspacesRes.status}): ${errText}`);
        }
        const workspacesData = await workspacesRes.json();
        const safeWorkspacesData = Array.isArray(workspacesData.values) ? workspacesData.values : [];
        
        sysLog.success(`Found user ${userData.display_name} and ${safeWorkspacesData.length} workspaces on Bitbucket`);

        return res.json([
          { id: userData.uuid, name: userData.display_name, type: 'user', repo_count: 0 },
          ...safeWorkspacesData.map((ws: any) => ({ id: ws.slug, name: ws.name, type: 'workspace', repo_count: 0 }))
        ]);
      }

      return res.json([]);
    } catch (err: any) {
      sysLog.error(`Failed to fetch namespaces: ${err.message}${err.cause ? ` (Cause: ${err.cause})` : ''}`);
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
      const headers: Record<string, string> = {
        'User-Agent': 'Hydrozoa-Mirror-Agent',
        'Accept': 'application/json'
      };
      
      if (sourceProvider.type === 'github') {
        headers['Authorization'] = `token ${token}`;
        const url = `https://api.github.com/${id.includes('-') ? 'orgs' : 'users'}/${id}/repos?per_page=100`;
        sysLog.info(`Fetching GitHub repos for ${id} from ${url}`);

        const reposRes = await fetch(url, { headers });
        if (!reposRes.ok) {
          const errText = await reposRes.text();
          sysLog.error(`GitHub Repos API failed (${reposRes.status}) for ${id}: ${errText}`);
          const hydrozoaStatus = [401, 403].includes(reposRes.status) ? 502 : reposRes.status;
          return res.status(hydrozoaStatus).json({ error: "GitHub Repos API failed", detail: errText });
        }
        const reposData = await reposRes.json();
        const safeReposData = Array.isArray(reposData) ? reposData : [];
        
        sysLog.success(`Found ${safeReposData.length} repos for GitHub namespace ${id}`);

        return res.json(safeReposData.map((repo: any) => ({
          id: repo.id.toString(),
          name: repo.name,
          description: repo.description
        })));
      }

      if (sourceProvider.type.includes('gitlab')) {
        headers['Private-Token'] = token;
        const url = id.startsWith('group-') 
          ? `${baseUrl}/api/v4/groups/${id.replace('group-', '')}/projects?per_page=100`
          : `${baseUrl}/api/v4/projects?owned=true&per_page=100`;
        
        sysLog.info(`Fetching GitLab projects for ${id} from ${url}`);

        const reposRes = await fetch(url, { headers });
        if (!reposRes.ok) {
          const errText = await reposRes.text();
          sysLog.error(`GitLab Projects API failed (${reposRes.status}) for ${id}: ${errText}`);
          const hydrozoaStatus = [401, 403].includes(reposRes.status) ? 502 : reposRes.status;
          return res.status(hydrozoaStatus).json({ error: "GitLab Projects API failed", detail: errText });
        }
        const reposData = await reposRes.json();
        const safeReposData = Array.isArray(reposData) ? reposData : [];
        
        sysLog.success(`Found ${safeReposData.length} projects for GitLab namespace ${id}`);

        return res.json(safeReposData.map((project: any) => ({
          id: project.id.toString(),
          name: project.path_with_namespace,
          description: project.description
        })));
      }

      if (['gitea', 'forgejo', 'gogs'].includes(sourceProvider.type)) {
        // We try organization repos first, then fall back to user repos if needed
        let url = `${baseUrl}/api/v1/orgs/${id}/repos?per_page=100`;
        sysLog.info(`Fetching ${sourceProvider.type} repos for ${id} from ${url}`);
        let reposRes = await fetch(url, { headers: { ...headers, 'Authorization': `token ${token}` } });
        
        if (!reposRes.ok) {
          // Fallback to user repos if org repos fail
          url = `${baseUrl}/api/v1/user/repos?per_page=100`;
          sysLog.info(`Falling back to ${sourceProvider.type} user repos for ${id} from ${url}`);
          reposRes = await fetch(url, { headers: { ...headers, 'Authorization': `token ${token}` } });
        }

        if (!reposRes.ok) {
          const errText = await reposRes.text();
          sysLog.error(`${sourceProvider.type} Repos API failed (${reposRes.status}) for ${id}: ${errText}`);
          const hydrozoaStatus = [401, 403].includes(reposRes.status) ? 502 : reposRes.status;
          return res.status(hydrozoaStatus).json({ error: "Provider Repos API failed", detail: errText });
        }

        const reposData = await reposRes.json();
        const safeReposData = Array.isArray(reposData) ? reposData : [];
        sysLog.success(`Found ${safeReposData.length} repos for ${sourceProvider.type} namespace ${id}`);
        return res.json(safeReposData.map((repo: any) => ({ id: repo.id.toString(), name: repo.full_name || repo.name, description: repo.description })));
      }

      if (sourceProvider.type === 'bitbucket') {
        const url = `https://api.bitbucket.org/2.0/repositories/${id}?per_page=100`;
        sysLog.info(`Fetching Bitbucket repos for ${id} from ${url}`);
        const reposRes = await fetch(url, { headers: { ...headers, 'Authorization': `Bearer ${token}` } });
        if (!reposRes.ok) {
          const errText = await reposRes.text();
          sysLog.error(`Bitbucket Repos API failed (${reposRes.status}) for ${id}: ${errText}`);
          const hydrozoaStatus = [401, 403].includes(reposRes.status) ? 502 : reposRes.status;
          return res.status(hydrozoaStatus).json({ error: "Bitbucket Repos API failed", detail: errText });
        }
        const reposData = await reposRes.json();
        const reposList = Array.isArray(reposData.values) ? reposData.values : [];
        sysLog.success(`Found ${reposList.length} repos for Bitbucket namespace ${id}`);
        return res.json(reposList.map((repo: any) => ({ id: repo.uuid, name: repo.full_name, description: repo.description })));
      }


      return res.json([]);
    } catch (err: any) {
      sysLog.error(`Failed to fetch repos: ${err.message}${err.cause ? ` (Cause: ${err.cause})` : ''}`);
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
      if (provider.isSource) {
        await pool.query('UPDATE providers SET is_source = false');
      }
      await pool.query(
        'INSERT INTO providers (id, name, type, url, token, is_source) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, name, type, provider.url, encryptedToken, provider.isSource]
      );

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
        isSource: provider.isSource,
        baseUrl: provider.url
      });
    } catch (err: any) {
      sysLog.error(`Error adding provider: ${err}`);
      res.status(500).json({ error: "Internal server error while adding provider", detail: err.message });
    }
  });

  app.post("/api/v1/webhooks/incoming/:providerId", (req, res) => {
    // In a real app, we'd verify HMAC signature here
    sysLog.info(`Incoming webhook for ${req.params.providerId}`);
    res.status(202).json({ message: "Accepted" });
  });

  app.delete("/api/v1/auth/providers/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    
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
      baseUrl: p.url,
      token: "ENCRYPTED"
    })));
  });

  app.post("/api/v1/source/selection", authenticateToken, async (req, res) => {
    const { selectedRepos, targetProviderIds, entities } = req.body;
    
    // Automation logic for target repository creation
    const selectedRepoDetails = selectedRepos.map((repo: any) => {
      return {
        id: repo.id,
        name: repo.name,
        description: repo.description || "Automated mirror target",
        tags: repo.tags || ["hydrozoa", "mirror"]
      };
    });

    const sourceProviderRes = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = sourceProviderRes.rows[0];
    const sourceProviderId = sourceProvider ? sourceProvider.id : 'unknown';

    const provisionSummary = [];

    for (const providerId of targetProviderIds) {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [providerId]);
      const provider = result.rows[0];

      if (!provider) continue;

      const decryptedToken = decrypt(provider.token);

      for (const repo of selectedRepoDetails) {
        const provisionResult = await provisionTargetRepository(provider, repo.name, repo.description, decryptedToken);

        provisionSummary.push({
          provider: provider.name,
          repo: repo.name,
          status: provisionResult.status,
          message: provisionResult.message
        });

        if (provisionResult.status !== 'failed') {
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
              await pool.query('UPDATE sync_matrix SET targets = $1, entities = $2 WHERE id = $3', [JSON.stringify(targets), JSON.stringify(entities || ["code"]), existingSync.id]);
            }
          } else {
            const newSync = {
              id: `sm-${crypto.randomUUID().slice(0, 8)}`,
              source_repo: repo.name,
              source_provider: sourceProviderId,
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
              }],
              entities: entities || ["code"]
            };
            await pool.query(
              'INSERT INTO sync_matrix (id, source_repo, source_provider, branch, last_commit, sync_interval, last_sync_duration, success_rate, targets, entities) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
              [newSync.id, newSync.source_repo, newSync.source_provider, newSync.branch, newSync.last_commit, newSync.sync_interval, newSync.last_sync_duration, newSync.success_rate, JSON.stringify(newSync.targets), JSON.stringify(newSync.entities)]
            );
          }
        }
      }
    }

    res.json({ 
      message: "Selection saved and targets provisioned", 
      count: selectedRepos.length,
      summary: provisionSummary
    });
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

    res.json({ message: "Manual sync initiated", item: { ...item, targets } });
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

  app.post("/api/v1/system/settings", authenticateToken, async (req, res) => {
    await addLog({
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
    sysLog.startup(`Server running on http://localhost:${PORT}`);
  });
}

sysLog.info("Calling startServer...");
startServer();
