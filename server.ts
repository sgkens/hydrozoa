import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";
import fs from "fs";
import os from "os";
import { runGit } from "./src/server/git-process.js";
import {
  buildMirrorDescription
} from "./src/server/mirror-description.js";
import {
  getRequestToken,
  loadSecurityConfiguration,
  redactSensitiveText,
  timingSafeStringEqual,
  validateProviderBaseUrl
} from "./src/server/security.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const securityConfig = loadSecurityConfiguration();
const JWT_SECRET = securityConfig.jwtSecret;
const MAX_LOGS = 500; // Truncate logs to prevent memory issues
const syncEntitySchema = z.enum(["code", "issues", "milestones", "wiki", "releases", "snippets"]);
const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024)
}).strict();
const passwordResetSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(12).max(1024)
}).strict();
const providerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["github", "gitlab", "gitlab_self_hosted", "gitea", "forgejo", "gogs", "bitbucket"]),
  url: z.string().trim().url().optional(),
  baseUrl: z.string().trim().url().optional(),
  token: z.string().trim().min(1).max(4096),
  isSource: z.boolean().optional().default(false),
  webhookSecret: z.string().trim().max(4096).optional()
}).strict();
const providerCredentialsSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  webhookSecret: z.string().trim().max(4096).optional()
}).strict();
const syncMatrixPatchSchema = z.object({
  entities: z.array(syncEntitySchema).min(1).max(6).optional(),
  sync_interval: z.number().int().min(1).max(1440).optional(),
  branch: z.string().trim().min(1).max(255).optional()
}).strict().refine(value => Object.keys(value).length > 0, "At least one field is required");
const settingsSchema = z.object({
  sync_interval: z.number().int().min(1).max(1440),
  encryption_enabled: z.literal(true),
  log_retention_days: z.number().int().min(1).max(3650),
  max_concurrent_syncs: z.number().int().min(1).max(50),
  bidirectional_sync: z.boolean(),
  conflict_strategy: z.enum(["source_wins", "target_wins", "manual"]),
  mirror_description_mode: z.enum(["default", "custom", "none"]),
  mirror_description_text: z.string().max(512).nullable()
}).strict().superRefine((value, context) => {
  if (value.mirror_description_mode === "custom" && !value.mirror_description_text?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["mirror_description_text"],
      message: "A custom mirror description is required when custom mode is selected"
    });
  }
});
const sourceSelectionSchema = z.object({
  selectedRepos: z.array(z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().trim().min(1).max(1024),
    description: z.string().max(4096).nullish(),
    tags: z.array(z.string().max(64)).max(100).optional(),
    entities: z.array(syncEntitySchema).min(1).max(6).optional(),
    branch: z.string().trim().min(1).max(255).optional(),
    visibility: z.enum(["private", "public", "internal"]).optional(),
    web_url: z.string().url().optional()
  }).strict()).max(1000),
  targetProviderIds: z.array(z.string().uuid()).min(1).max(50),
  entities: z.array(syncEntitySchema).min(1).max(6).optional()
}).strict();

function parseRequestBody<T extends z.ZodTypeAny>(
  schema: T,
  req: express.Request,
  res: express.Response
): z.output<T> | null {
  const result = schema.safeParse(req.body);
  if (result.success) return result.data;
  res.status(422).json({
    error: "Request validation failed",
    details: result.error.issues.map(issue => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
  return null;
}

// Encryption Helper
const MASTER_KEY = securityConfig.masterKey;
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
  black: "\x1b[30m",
  gray: "\x1b[90m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m"
};

const getTimestamp = () => `${colors.gray}[${new Date().toLocaleTimeString()}]${colors.reset}`;

const sysLog = {
  info: (msg: string) => console.log(`${getTimestamp()} ${colors.bgBlue}${colors.white} INFO ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${getTimestamp()} ${colors.bgGreen}${colors.white}  OK  ${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${getTimestamp()} ${colors.bgYellow}${colors.black} WARN ${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${getTimestamp()} ${colors.bgRed}${colors.white} FAIL ${colors.reset} ${msg}`),
  startup: (msg: string) => console.log(`${getTimestamp()} ${colors.magenta}${colors.bright}🚀 ${msg}${colors.reset}`),
  debug: (msg: string) => console.log(`${getTimestamp()} ${colors.gray}${colors.dim}🔍 ${msg}${colors.reset}`)
};

process.on('uncaughtException', (err) => {
  sysLog.error(`Uncaught Exception: ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason: any) => {
  sysLog.error(`Unhandled Rejection: ${reason?.message || reason}`);
});

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
function readPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const PROVIDER_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv("PROVIDER_REQUEST_TIMEOUT_MS", 30_000);
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: readPositiveIntegerEnv("DATABASE_POOL_MAX", 20),
  idleTimeoutMillis: readPositiveIntegerEnv("DATABASE_IDLE_TIMEOUT_MS", 30_000),
  connectionTimeoutMillis: readPositiveIntegerEnv("DATABASE_CONNECT_TIMEOUT_MS", 10_000)
});

async function runRetentionCleanup(): Promise<void> {
  await pool.query(`
    DELETE FROM logs
    WHERE timestamp < NOW() - (
      SELECT make_interval(days => log_retention_days)
      FROM system_settings
      WHERE id = 1
    )
  `);
  await pool.query("DELETE FROM api_metrics WHERE timestamp < NOW() - INTERVAL '30 days'");
  await pool.query("DELETE FROM webhook_deliveries WHERE received_at < NOW() - INTERVAL '30 days'");
}

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
        webhook_secret TEXT,
        is_source BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure is_source column exists if table was created without it
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='providers' AND column_name='is_source') THEN
          ALTER TABLE providers ADD COLUMN is_source BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='providers' AND column_name='webhook_secret') THEN
          ALTER TABLE providers ADD COLUMN webhook_secret TEXT;
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
        sync_matrix_id TEXT,
        source_repo TEXT NOT NULL,
        target_node TEXT NOT NULL,
        target_provider_id TEXT,
        error_code TEXT NOT NULL,
        error_message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dlq_items' AND column_name='sync_matrix_id') THEN
          ALTER TABLE dlq_items ADD COLUMN sync_matrix_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dlq_items' AND column_name='target_provider_id') THEN
          ALTER TABLE dlq_items ADD COLUMN target_provider_id TEXT;
        END IF;
      END $$;

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

      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY,
        sync_interval INTEGER DEFAULT 15,
        encryption_enabled BOOLEAN DEFAULT TRUE,
        log_retention_days INTEGER DEFAULT 7,
        max_concurrent_syncs INTEGER DEFAULT 5,
        bidirectional_sync BOOLEAN DEFAULT FALSE,
        conflict_strategy TEXT DEFAULT 'source_wins',
        mirror_description_mode TEXT DEFAULT 'default',
        mirror_description_text TEXT DEFAULT NULL
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='mirror_description_mode') THEN
          ALTER TABLE system_settings ADD COLUMN mirror_description_mode TEXT DEFAULT 'default';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='mirror_description_text') THEN
          ALTER TABLE system_settings ADD COLUMN mirror_description_text TEXT DEFAULT NULL;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS api_metrics (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER,
        rate_limit_limit INTEGER,
        rate_limit_remaining INTEGER,
        rate_limit_reset TIMESTAMP,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        provider_id TEXT NOT NULL,
        delivery_id TEXT NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider_id, delivery_id)
      );

    `);

    // Seed default settings if not exists
    const settingsCheck = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    if (settingsCheck.rows.length === 0) {
      await pool.query('INSERT INTO system_settings (id) VALUES (1)');
    }

    // Seed default user if not exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ["admin@hydrozoa.io"]);
    if (userCheck.rows.length === 0) {
      const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD
        || (securityConfig.isProduction ? "" : "hydrozoa-default");
      if (bootstrapPassword.length < 12) {
        throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters when creating the initial administrator");
      }
      const passwordHash = bcrypt.hashSync(bootstrapPassword, 12);
      await pool.query(
        'INSERT INTO users (email, password_hash, name, is_default_password) VALUES ($1, $2, $3, $4)',
        ["admin@hydrozoa.io", passwordHash, "Hydrozoa Admin", true]
      );
    }
    
    sysLog.success("Database initialized successfully");

    // Startup Cleanup: Reset any items that were stuck in 'syncing' state
    const stuckSyncs = await pool.query("SELECT * FROM sync_matrix WHERE targets::text LIKE '%\"status\":\"syncing\"%'");
    if (stuckSyncs.rows.length > 0) {
      sysLog.info(`Cleaning up ${stuckSyncs.rows.length} potentially stuck sync operations...`);
      for (const row of stuckSyncs.rows) {
        const targets = row.targets.map((t: any) => ({
          ...t,
          status: t.status === 'syncing' ? 'pending' : t.status
        }));
        await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(targets), row.id]);
      }
      sysLog.success("Stuck sync operations reset to pending.");
    }

    await runRetentionCleanup();
  } catch (err) {
    sysLog.error(`Database initialization failed: ${err}`);
    throw err;
  }
}

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

async function trackedFetch(providerId: string, url: string, options: any) {
  try {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;
    const res = await fetch(url, { ...options, signal });
    
    // Extract rate limits (GitHub/GitLab/Gitea patterns)
    const limit = res.headers.get('x-ratelimit-limit') || res.headers.get('ratelimit-limit');
    const remaining = res.headers.get('x-ratelimit-remaining') || res.headers.get('ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset') || res.headers.get('ratelimit-reset');

    let endpoint = url;
    try {
      endpoint = new URL(url).pathname;
    } catch(e) {}

    // Async insert to not block the request
    pool.query(
      'INSERT INTO api_metrics (id, provider_id, endpoint, method, status_code, rate_limit_limit, rate_limit_remaining, rate_limit_reset) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        crypto.randomUUID(), 
        providerId, 
        endpoint, 
        options.method || 'GET', 
        res.status, 
        limit ? parseInt(limit as string) : null,
        remaining ? parseInt(remaining as string) : null,
        reset ? (isNaN(parseInt(reset)) ? new Date(reset) : new Date(parseInt(reset) * 1000)) : null
      ]
    ).catch(err => sysLog.error(`Failed to track API metric: ${err}`));

    return res;
  } catch (err) {
    throw err;
  }
}

function getLinkNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}

async function fetchProviderCollection(
  providerId: string,
  initialUrl: string,
  headers: Record<string, string>,
  maxPages = 100
): Promise<any[]> {
  const items: any[] = [];
  let nextUrl: string | null = initialUrl;
  const visited = new Set<string>();

  for (let pageCount = 0; nextUrl && pageCount < maxPages; pageCount++) {
    if (visited.has(nextUrl)) throw new Error(`Provider pagination loop detected for ${new URL(nextUrl).pathname}`);
    visited.add(nextUrl);

    const response = await trackedFetch(providerId, nextUrl, { headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Provider collection request failed (${response.status}): ${detail.substring(0, 1000)}`);
    }
    const data = await response.json();
    const pageItems = Array.isArray(data) ? data : Array.isArray(data?.values) ? data.values : [];
    items.push(...pageItems);

    nextUrl = typeof data?.next === "string"
      ? data.next
      : getLinkNextUrl(response.headers.get("link"));

    if (!nextUrl) {
      const gitLabNextPage = response.headers.get("x-next-page");
      if (gitLabNextPage) {
        const url = new URL(initialUrl);
        url.searchParams.set("page", gitLabNextPage);
        nextUrl = url.toString();
      }
    }

    if (!nextUrl && pageItems.length > 0) {
      const current = new URL(initialUrl);
      const pageSizeText = current.searchParams.get("per_page")
        || current.searchParams.get("limit")
        || current.searchParams.get("pagelen");
      const pageSize = pageSizeText ? Number.parseInt(pageSizeText, 10) : 0;
      if (pageSize > 0 && pageItems.length === pageSize) {
        const nextPage = Number.parseInt(current.searchParams.get("page") || "1", 10) + pageCount + 1;
        current.searchParams.set("page", String(nextPage));
        nextUrl = current.toString();
      }
    }
  }

  if (nextUrl) throw new Error(`Provider pagination exceeded the ${maxPages}-page safety limit`);
  return items;
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

function getProviderHeaders(provider: any, token: string) {
  const type = provider.type.toLowerCase();
  if (type === "github") return { "Authorization": `token ${token}` };
  if (type.includes("gitlab")) return { "Private-Token": token };
  if (["gitea", "forgejo", "gogs"].includes(type)) return { "Authorization": `token ${token}` };
  if (type === "bitbucket") return { "Authorization": `Bearer ${token}` };
  return {};
}

function sanitizeForGithub(text: string): string {
  if (!text) return "";
  // Strip C0 and C1 control characters (\x00-\x1F, \x7F-\x9F)
  // GitHub API rejects these in descriptions and other fields
  return text.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

async function getProviderUser(provider: any, token: string): Promise<string | null> {
  const type = provider.type.toLowerCase();
  let baseUrl = provider.url.replace(/\/$/, '');
  if (type === 'github' && (baseUrl === 'https://github.com' || baseUrl === 'http://github.com')) {
    baseUrl = 'https://api.github.com';
  } else if (type === 'bitbucket' && (baseUrl === 'https://bitbucket.org' || baseUrl === 'http://bitbucket.org' || baseUrl === 'https://api.bitbucket.org/2.0')) {
    baseUrl = 'https://api.bitbucket.org';
  }
  const headers: Record<string, string> = {
    'User-Agent': 'Hydrozoa-Mirror-Agent',
    'Accept': 'application/json'
  };

  try {
    if (type === 'github') {
      headers['Authorization'] = `token ${token}`;
      const res = await trackedFetch(provider.id, `${baseUrl}/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.login;
      }
    } else if (type.includes('gitlab')) {
      headers['Private-Token'] = token;
      const res = await trackedFetch(provider.id, `${baseUrl}/api/v4/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.username;
      }
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      headers['Authorization'] = `token ${token}`;
      const res = await trackedFetch(provider.id, `${baseUrl}/api/v1/user`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.username;
      }
    } else if (type === 'bitbucket') {
      headers['Authorization'] = `Bearer ${token}`;
      const res = await trackedFetch(provider.id, `${baseUrl}/2.0/user`, { headers });
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

async function provisionTargetRepository(provider: any, repoName: string, description: string, token: string, sourceUrl?: string, visibility: string = 'private') {
  const type = provider.type.toLowerCase();
  const isPrivate = visibility === 'private';
  
  const settingsResult = await pool.query(
    "SELECT mirror_description_mode, mirror_description_text FROM system_settings WHERE id = 1"
  );
  const descriptionSettings = settingsResult.rows[0] || {};
  const finalDescription = buildMirrorDescription(
    description,
    sourceUrl,
    repoName,
    descriptionSettings.mirror_description_mode || "default",
    descriptionSettings.mirror_description_text
  );

  sysLog.info(`Provisioning target: ${repoName} on ${provider.name} (${provider.type})`);
  let baseUrl = provider.url.replace(/\/$/, '');
  if (type === 'github' && (baseUrl === 'https://github.com' || baseUrl === 'http://github.com')) {
    baseUrl = 'https://api.github.com';
  } else if (type === 'bitbucket' && (baseUrl === 'https://bitbucket.org' || baseUrl === 'http://bitbucket.org' || baseUrl === 'https://api.bitbucket.org/2.0')) {
    baseUrl = 'https://api.bitbucket.org';
  }
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
      const res = await trackedFetch(provider.id, `${baseUrl}/repos/${fullName}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (type.includes('gitlab')) {
      headers['Private-Token'] = token;
      const res = await trackedFetch(provider.id, `${baseUrl}/api/v4/projects/${encodeURIComponent(fullName)}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      headers['Authorization'] = `token ${token}`;
      const res = await trackedFetch(provider.id, `${baseUrl}/api/v1/repos/${fullName}`, { headers });
      if (res.ok) exists = true;
      else if (![404, 401, 403].includes(res.status)) throw new Error(`API returned ${res.status}`);
      else if ([401, 403].includes(res.status)) {
        return { status: 'failed', message: `Auth error (${res.status}) on ${provider.name}`, error: await res.text() };
      }
    } else if (type === 'bitbucket') {
      headers['Authorization'] = `Bearer ${token}`;
      const res = await trackedFetch(provider.id, `${baseUrl}/2.0/repositories/${fullName}`, { headers });
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
      createRes = await trackedFetch(provider.id, createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, description: finalDescription, private: isPrivate })
      });
    } else if (type.includes('gitlab')) {
      createRes = await trackedFetch(provider.id, `${baseUrl}/api/v4/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, path: name, visibility: visibility === 'internal' ? 'internal' : (isPrivate ? 'private' : 'public'), description: finalDescription })
      });
    } else if (['gitea', 'forgejo', 'gogs'].includes(type)) {
      const currentUser = await getProviderUser(provider, token);
      const createUrl = owner === currentUser ? `${baseUrl}/api/v1/user/repos` : `${baseUrl}/api/v1/org/${owner}/repos`;
      createRes = await trackedFetch(provider.id, createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, description: finalDescription, private: isPrivate })
      });
    } else if (type === 'bitbucket') {
      createRes = await trackedFetch(provider.id, `${baseUrl}/2.0/repositories/${fullName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scm: 'git', is_private: isPrivate, description: finalDescription })
      });
    }

    if (createRes && createRes.ok) {
      sysLog.success(`Provisioned target repo: ${fullName} on ${provider.name}`);
      await addLog({
        level: "info",
        code: "H-TARGET-SUCCESS",
        provider: provider.type,
        message: `Successfully created target repository '${fullName}' on ${provider.name}`,
        technical_context: `Creation successful for ${fullName}. API: ${createRes.status}`,
        ui_message: `Provisioned repository: ${fullName}`,
        resolution: "Repository is now ready for mirroring."
      });
      return { status: 'created', message: `Repository ${fullName} created` };
    } else {
      const errText = createRes ? await createRes.text() : "No response from provider";
      sysLog.error(`Provisioning failed for ${fullName} on ${provider.name}: ${errText}`);
      await addLog({
        level: "error",
        code: "H-TARGET-FAIL",
        provider: provider.type,
        message: `Failed to create target repository '${fullName}' on ${provider.name}`,
        technical_context: `API status: ${createRes?.status || 'ERR'}. Error: ${errText}. Payload: { name: ${name}, desc: ${finalDescription} }`,
        ui_message: `Failed to provision repository: ${fullName}`,
        resolution: "Check description for control characters and verify provider permissions."
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
  const token = getRequestToken(req, securityConfig.authCookieName);

  if (!token) return res.status(401).json({ error: "Authentication required" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(401).json({ error: "Session is invalid or expired" });
    req.user = user;
    next();
  });
};

// --- Sync Engine ---

function getGitRemote(provider: any, token: string, repoName: string) {
  const type = provider.type.toLowerCase();
  let baseUrl = provider.url.replace(/\/$/, '').replace(/^https?:\/\//, '');
  
  // GitHub and Bitbucket APIs are on subdomains, but Git is on the main domain
  if (type === 'github' && baseUrl === 'api.github.com') {
    baseUrl = 'github.com';
  } else if (type === 'bitbucket' && baseUrl === 'api.bitbucket.org') {
    baseUrl = 'bitbucket.org';
  }
  
  const username = type === "github"
    ? "x-access-token"
    : type.includes("gitlab")
      ? "oauth2"
      : type === "bitbucket"
        ? "x-token-auth"
        : token;

  return {
    url: `https://${baseUrl}/${repoName}.git`,
    credentials: {
      username,
      password: type === "gitea" || type === "forgejo" || type === "gogs" ? "" : token
    }
  };
}

async function syncCode(source: any, target: any, repoName: string, sourceToken: string, targetToken: string) {
  const tmpRoot = path.join(os.tmpdir(), `hydrozoa-${crypto.randomUUID()}`);
  const mirrorDir = path.join(tmpRoot, "mirror.git");
  fs.mkdirSync(tmpRoot, { recursive: true, mode: 0o700 });

  try {
    const sourceRemote = getGitRemote(source, sourceToken, repoName);
    const targetRemote = getGitRemote(target, targetToken, repoName);

    sysLog.info(`Mirroring code: ${repoName} -> ${target.name}`);
    
    try {
      sysLog.info(`Cloning from source: ${repoName}...`);
      await runGit(["clone", "--mirror", sourceRemote.url, mirrorDir], {
        askPassDirectory: tmpRoot,
        credentials: sourceRemote.credentials
      });
      sysLog.info(`Successfully cloned ${repoName}. Pushing to target...`);
      await runGit(["push", "--mirror", targetRemote.url], {
        cwd: mirrorDir,
        askPassDirectory: tmpRoot,
        credentials: targetRemote.credentials
      });
      sysLog.success(`Code sync successful for ${repoName} -> ${target.name}`);
    } catch (gitErr: any) {
      const safeMessage = redactSensitiveText(gitErr.message, [sourceToken, targetToken]);
      sysLog.error(`Git operation failed for ${repoName}: ${safeMessage}`);
      throw new Error(safeMessage);
    }
    
    return true;
  } catch (err: any) {
    sysLog.error(`Code sync failed for ${repoName}: ${err.message}`);
    throw err;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function syncIssues(source: any, target: any, repoName: string, sourceToken: string, targetToken: string, milestoneMap?: Record<string, any>) {
  const sourceBase = source.url.replace(/\/$/, "");
  const targetBase = target.url.replace(/\/$/, "");
  const headersSource: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json" };
  const headersTarget: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json", "Content-Type": "application/json" };

  Object.assign(headersSource, getProviderHeaders(source, sourceToken));
  Object.assign(headersTarget, getProviderHeaders(target, targetToken));

  try {
    const sourcePath = source.type.toLowerCase().includes("gitlab")
      ? `${sourceBase}/api/v4/projects/${encodeURIComponent(repoName)}/issues?per_page=100`
      : source.type.toLowerCase() === "github"
        ? `${sourceBase}/repos/${repoName}/issues?state=all&per_page=100`
        : source.type.toLowerCase() === "bitbucket"
          ? `${sourceBase}/2.0/repositories/${repoName}/issues?pagelen=100`
          : `${sourceBase}/api/v1/repos/${repoName}/issues?state=all&per_page=100`;

    const sourceIssues = await fetchProviderCollection(source.id, sourcePath, headersSource);

    if (!Array.isArray(sourceIssues)) return false;

    const targetPath = target.type.toLowerCase().includes("gitlab")
      ? `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/issues?per_page=100`
      : target.type.toLowerCase() === "github"
        ? `${targetBase}/repos/${repoName}/issues?state=all&per_page=100`
        : target.type.toLowerCase() === "bitbucket"
          ? `${targetBase}/2.0/repositories/${repoName}/issues?pagelen=100`
          : `${targetBase}/api/v1/repos/${repoName}/issues?state=all&per_page=100`;

    const targetIssues = await fetchProviderCollection(target.id, targetPath, headersTarget);

    const existingTitles = new Set(targetIssues.map((i: any) => i.title));
    let created = 0;
    let skipped = 0;

    for (const issue of sourceIssues) {
      if (issue.pull_request) continue;

      const title = issue.title;
      const body = source.type.toLowerCase() === "github" ? issue.body : (issue.description || issue.body);
      
      // Resolve milestone
      let targetMilestoneId = null;
      if (issue.milestone && milestoneMap) {
        const sourceMsTitle = typeof issue.milestone === 'string' ? issue.milestone : issue.milestone.title;
        targetMilestoneId = milestoneMap[sourceMsTitle];
      }

      // Normalize labels
      let labels: string[] = [];
      if (Array.isArray(issue.labels)) {
        labels = issue.labels.map((l: any) => typeof l === 'string' ? l : (l.name || l.title));
      } else if (typeof issue.labels === 'string') {
        labels = issue.labels.split(',').map((label: string) => label.trim());
      }

      if (existingTitles.has(title)) {
        skipped++;
        continue;
      }

      try {
        let createRes;
        if (target.type.toLowerCase().includes("gitlab")) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/issues`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ 
              title, 
              description: body, 
              labels: labels.join(','),
              milestone_id: targetMilestoneId 
            })
          });
        } else if (target.type.toLowerCase() === "github") {
          createRes = await trackedFetch(target.id, `${targetBase}/repos/${repoName}/issues`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ 
              title: sanitizeForGithub(title), 
              body: sanitizeForGithub(body), 
              labels,
              milestone: targetMilestoneId
            })
          });
        } else if (target.type.toLowerCase() === "bitbucket") {
          // Bitbucket doesn't have native 'labels' or standard 'milestone' on issues API 2.0
          createRes = await trackedFetch(target.id, `${targetBase}/2.0/repositories/${repoName}/issues`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, content: { raw: body } })
          });
        } else if (["gitea", "forgejo", "gogs"].includes(target.type.toLowerCase())) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v1/repos/${repoName}/issues`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, body, labels, milestone: targetMilestoneId })
          });
        }

        if (createRes && createRes.ok) {
          created++;
        } else {
          sysLog.warn(`Failed to create issue "${title}" on ${target.name}: ${createRes ? await createRes.text() : "Unknown error"}`);
        }
      } catch (e) {
        sysLog.error(`Error creating issue "${title}" on ${target.name}: ${e}`);
      }
    }
    sysLog.success(`Issue sync complete for ${repoName}: ${created} created, ${skipped} skipped.`);
    return true;
  } catch (err) {
    sysLog.error(`Issue sync failed for ${repoName}: ${err}`);
    throw err;
  }
}

async function syncMilestones(source: any, target: any, repoName: string, sourceToken: string, targetToken: string): Promise<Record<string, any>> {
  const sourceBase = source.url.replace(/\/$/, "");
  const targetBase = target.url.replace(/\/$/, "");
  const headersSource: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json" };
  const headersTarget: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json", "Content-Type": "application/json" };

  Object.assign(headersSource, getProviderHeaders(source, sourceToken));
  Object.assign(headersTarget, getProviderHeaders(target, targetToken));

  const milestoneMap: Record<string, any> = {};

  try {
    const sourcePath = source.type.toLowerCase().includes("gitlab")
      ? `${sourceBase}/api/v4/projects/${encodeURIComponent(repoName)}/milestones?per_page=100`
      : source.type.toLowerCase() === "github"
        ? `${sourceBase}/repos/${repoName}/milestones?state=all&per_page=100`
        : source.type.toLowerCase() === "bitbucket"
          ? `${sourceBase}/2.0/repositories/${repoName}/issues/milestones?pagelen=100`
          : `${sourceBase}/api/v1/repos/${repoName}/milestones?state=all&per_page=100`;

    const sourceMilestones = await fetchProviderCollection(source.id, sourcePath, headersSource);

    if (!Array.isArray(sourceMilestones)) return {};

    const targetPath = target.type.toLowerCase().includes("gitlab")
      ? `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/milestones?per_page=100`
      : target.type.toLowerCase() === "github"
        ? `${targetBase}/repos/${repoName}/milestones?state=all&per_page=100`
        : target.type.toLowerCase() === "bitbucket"
          ? `${targetBase}/2.0/repositories/${repoName}/issues/milestones?pagelen=100`
          : `${targetBase}/api/v1/repos/${repoName}/milestones?state=all&per_page=100`;

    const targetMilestones = await fetchProviderCollection(target.id, targetPath, headersTarget);

    // Map existing target milestones
    targetMilestones.forEach((m: any) => {
      milestoneMap[m.title] = m.id || m.iid || m.number;
    });

    let created = 0;
    let skipped = 0;

    for (const ms of sourceMilestones) {
      const title = ms.title;
      const description = ms.description;

      if (milestoneMap[title]) {
        skipped++;
        continue;
      }

      try {
        let createRes;
        if (target.type.toLowerCase().includes("gitlab")) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/milestones`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, description })
          });
        } else if (target.type.toLowerCase() === "github") {
          createRes = await trackedFetch(target.id, `${targetBase}/repos/${repoName}/milestones`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ 
              title: sanitizeForGithub(title), 
              description: sanitizeForGithub(description) 
            })
          });
        } else if (target.type.toLowerCase() === "bitbucket") {
          createRes = await trackedFetch(target.id, `${targetBase}/2.0/repositories/${repoName}/issues/milestones`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ name: title })
          });
        } else if (["gitea", "forgejo", "gogs"].includes(target.type.toLowerCase())) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v1/repos/${repoName}/milestones`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, description })
          });
        }

        if (createRes && createRes.ok) {
          const newMs = await createRes.json();
          milestoneMap[title] = newMs.id || newMs.iid || newMs.number;
          created++;
        } else {
          sysLog.warn(`Failed to create milestone "${title}" on ${target.name}: ${createRes ? await createRes.text() : "Unknown error"}`);
        }
      } catch (e) {
        sysLog.error(`Error creating milestone "${title}" on ${target.name}: ${e}`);
      }
    }
    sysLog.success(`Milestone sync complete for ${repoName}: ${created} created, ${skipped} skipped.`);
    return milestoneMap;
  } catch (err) {
    sysLog.error(`Milestone sync failed for ${repoName}: ${err}`);
    throw err;
  }
}
async function syncReleases(source: any, target: any, repoName: string, sourceToken: string, targetToken: string) {
  const sourceBase = source.url.replace(/\/$/, "");
  const targetBase = target.url.replace(/\/$/, "");
  const headersSource: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json" };
  const headersTarget: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json", "Content-Type": "application/json" };

  Object.assign(headersSource, getProviderHeaders(source, sourceToken));
  Object.assign(headersTarget, getProviderHeaders(target, targetToken));

  try {
    const sourcePath = source.type.toLowerCase().includes("gitlab")
      ? `${sourceBase}/api/v4/projects/${encodeURIComponent(repoName)}/releases?per_page=100`
      : source.type.toLowerCase() === "github"
        ? `${sourceBase}/repos/${repoName}/releases?per_page=100`
        : source.type.toLowerCase() === "bitbucket"
          ? `${sourceBase}/2.0/repositories/${repoName}/refs/tags?pagelen=100`
          : `${sourceBase}/api/v1/repos/${repoName}/releases?per_page=100`;

    const sourceReleases = await fetchProviderCollection(source.id, sourcePath, headersSource);

    if (!Array.isArray(sourceReleases)) return false;

    const targetPath = target.type.toLowerCase().includes("gitlab")
      ? `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/releases?per_page=100`
      : target.type.toLowerCase() === "github"
        ? `${targetBase}/repos/${repoName}/releases?per_page=100`
        : target.type.toLowerCase() === "bitbucket"
          ? `${targetBase}/2.0/repositories/${repoName}/refs/tags?pagelen=100`
          : `${targetBase}/api/v1/repos/${repoName}/releases?per_page=100`;

    const targetReleases = await fetchProviderCollection(target.id, targetPath, headersTarget);

    const existingTags = new Set(targetReleases.map((r: any) => r.tag_name));
    let created = 0;
    let skipped = 0;

    for (const rel of sourceReleases) {
      const tagName = rel.tag_name || rel.name; // Bitbucket uses name
      const name = rel.name;
      const body = source.type.toLowerCase() === "github" 
        ? rel.body 
        : source.type.toLowerCase() === "bitbucket"
          ? (rel.message || rel.target?.message || "")
          : (rel.description || rel.body);

      if (existingTags.has(tagName)) {
        skipped++;
        continue;
      }

      try {
        let createRes;
        if (target.type.toLowerCase().includes("gitlab")) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/releases`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ name, tag_name: tagName, description: body })
          });
        } else if (target.type.toLowerCase() === "github") {
          createRes = await trackedFetch(target.id, `${targetBase}/repos/${repoName}/releases`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ 
              name: sanitizeForGithub(name), 
              tag_name: tagName, 
              body: sanitizeForGithub(body) 
            })
          });
        } else if (target.type.toLowerCase() === "bitbucket") {
          createRes = await trackedFetch(target.id, `${targetBase}/2.0/repositories/${repoName}/refs/tags`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ name: tagName, message: body })
          });
        } else if (["gitea", "forgejo", "gogs"].includes(target.type.toLowerCase())) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v1/repos/${repoName}/releases`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ name, tag_name: tagName, body })
          });
        }

        if (createRes && createRes.ok) {
          const createdRelease = await createRes.json();
          created++;

          // --- Asset Mirroring ---
          // Extract source assets
          let sourceAssets = [];
          if (source.type === 'github') sourceAssets = rel.assets || [];
          else if (source.type.includes('gitlab')) sourceAssets = (rel.assets && rel.assets.links) || [];
          else if (['gitea', 'forgejo'].includes(source.type)) sourceAssets = rel.assets || [];

          for (const asset of sourceAssets) {
            try {
              const assetName = asset.name;
              const downloadUrl = asset.browser_download_url || asset.url;
              if (!downloadUrl) continue;

              sysLog.info(`Mirroring release asset: ${assetName} for ${tagName}`);
              
              // Download asset
              const assetRes = await fetch(downloadUrl, { headers: headersSource });
              if (!assetRes.ok) continue;
              const assetBuffer = await assetRes.arrayBuffer();

              // Upload to target
              if (target.type === 'github') {
                // GitHub uses a separate upload URL
                const uploadUrl = createdRelease.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(assetName)}`);
                await fetch(uploadUrl, {
                  method: 'POST',
                  headers: { 
                    ...headersTarget, 
                    'Content-Type': asset.content_type || 'application/octet-stream',
                    'Content-Length': assetBuffer.byteLength.toString()
                  },
                  body: assetBuffer
                });
              } else if (target.type.includes('gitlab')) {
                sysLog.info(`GitLab asset upload for ${assetName} skipped (requires Generic Package API)`);
              } else if (['gitea', 'forgejo'].includes(target.type)) {
                await fetch(`${targetBase}/api/v1/repos/${repoName}/releases/${createdRelease.id}/assets`, {
                  method: 'POST',
                  headers: headersTarget,
                  body: JSON.stringify({ name: assetName, attachment: Buffer.from(assetBuffer).toString('base64') })
                });
              }
            } catch (assetErr) {
              sysLog.error(`Failed to mirror asset ${asset.name}: ${assetErr}`);
            }
          }
        } else {
          sysLog.warn(`Failed to create release "${tagName}" on ${target.name}: ${createRes ? await createRes.text() : "Unknown error"}`);
        }
      } catch (e) {
        sysLog.error(`Error creating release "${tagName}" on ${target.name}: ${e}`);
      }
    }
    sysLog.success(`Release sync complete for ${repoName}: ${created} created, ${skipped} skipped.`);
    return true;
  } catch (err) {
    sysLog.error(`Release sync failed for ${repoName}: ${err}`);
    throw err;
  }
}

async function syncSnippets(source: any, target: any, repoName: string, sourceToken: string, targetToken: string) {
  const sourceBase = source.url.replace(/\/$/, "");
  const targetBase = target.url.replace(/\/$/, "");
  const headersSource: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json" };
  const headersTarget: any = { "User-Agent": "Hydrozoa-Mirror-Agent", "Accept": "application/json", "Content-Type": "application/json" };

  Object.assign(headersSource, getProviderHeaders(source, sourceToken));
  Object.assign(headersTarget, getProviderHeaders(target, targetToken));

  try {
    const sourcePath = source.type.toLowerCase().includes("gitlab")
      ? `${sourceBase}/api/v4/projects/${encodeURIComponent(repoName)}/snippets?per_page=100`
      : source.type.toLowerCase() === "github"
        ? `${sourceBase}/gists?per_page=100` // GitHub Gists are global, but we try to match by name
        : source.type.toLowerCase() === "bitbucket"
          ? `${sourceBase}/2.0/repositories/${repoName}/snippets?pagelen=100`
          : `${sourceBase}/api/v1/repos/${repoName}/snippets?per_page=100`;

    const sourceSnippets = await fetchProviderCollection(source.id, sourcePath, headersSource);

    if (!Array.isArray(sourceSnippets)) return false;

    const targetPath = target.type.toLowerCase().includes("gitlab")
      ? `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/snippets?per_page=100`
      : target.type.toLowerCase() === "github"
        ? `${targetBase}/gists?per_page=100`
        : target.type.toLowerCase() === "bitbucket"
          ? `${targetBase}/2.0/repositories/${repoName}/snippets?pagelen=100`
          : `${targetBase}/api/v1/repos/${repoName}/snippets?per_page=100`;

    const targetSnippets = await fetchProviderCollection(target.id, targetPath, headersTarget);

    const existingTitles = new Set(targetSnippets.map((s: any) => s.title || s.description || "Untitled"));
    let created = 0;
    let skipped = 0;

    for (const snip of sourceSnippets) {
      const title = snip.title || snip.description || "Untitled";
      const fileName = snip.file_name || (snip.files ? Object.keys(snip.files)[0] : "snippet.txt");
      const content = snip.content || (snip.files && snip.files[fileName] ? snip.files[fileName].content : "");

      if (existingTitles.has(title)) {
        skipped++;
        continue;
      }

      try {
        let createRes;
        if (target.type.toLowerCase().includes("gitlab")) {
          createRes = await trackedFetch(target.id, `${targetBase}/api/v4/projects/${encodeURIComponent(repoName)}/snippets`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, file_name: fileName, content, visibility: 'private' })
          });
        } else if (target.type.toLowerCase() === "github") {
          createRes = await trackedFetch(target.id, `${targetBase}/gists`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ description: title, public: false, files: { [fileName]: { content } } })
          });
        } else if (target.type.toLowerCase() === "bitbucket") {
          createRes = await trackedFetch(target.id, `${targetBase}/2.0/repositories/${repoName}/snippets`, {
            method: "POST",
            headers: headersTarget,
            body: JSON.stringify({ title, text: content })
          });
        }

        if (createRes && createRes.ok) {
          created++;
        }
      } catch (e) {
        sysLog.error(`Error creating snippet "${title}" on ${target.name}: ${e}`);
      }
    }
    sysLog.success(`Snippet sync complete for ${repoName}: ${created} created, ${skipped} skipped.`);
    return true;
  } catch (err) {
    sysLog.error(`Snippet sync failed for ${repoName}: ${err}`);
    throw err;
  }
}

interface SyncProcessOptions {
  targetProviderIds?: Set<string>;
  replayDlqId?: string;
}

async function processSyncItem(item: any, options: SyncProcessOptions = {}): Promise<boolean> {
  sysLog.info(`Processing mirror item: ${item.source_repo}`);
  const lockClient = await pool.connect();
  const lockKey = `sync:${item.id}`;
  let lockAcquired = false;
  let allTargetsSucceeded = true;
  try {
  const lockResult = await lockClient.query(
    "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
    [lockKey]
  );
  lockAcquired = Boolean(lockResult.rows[0]?.acquired);
  if (!lockAcquired) {
    sysLog.info(`Sync already active for ${item.source_repo}; duplicate trigger ignored.`);
    return false;
  }

  // Fetch latest settings
  const settingsRes = await pool.query('SELECT * FROM system_settings WHERE id = 1');
  const settings = settingsRes.rows[0];

  const sourceRes = await pool.query('SELECT * FROM providers WHERE id = $1', [item.source_provider]);
  const sourceProvider = sourceRes.rows[0];
  if (!sourceProvider) return false;

  const sourceToken = decrypt(sourceProvider.token);
  if (sourceToken === "DECRYPTION_FAILED") {
    throw new Error(`Source credentials cannot be decrypted for ${sourceProvider.name}`);
  }
  const entities = Array.isArray(item.entities) ? item.entities : ['code'];

  for (const targetRef of item.targets) {
    if (options.targetProviderIds && !options.targetProviderIds.has(targetRef.provider_id)) continue;

    const targetRes = await pool.query('SELECT * FROM providers WHERE id = $1', [targetRef.provider_id]);
    const targetProvider = targetRes.rows[0];
    if (!targetProvider) {
      allTargetsSucceeded = false;
      continue;
    }

    const targetToken = decrypt(targetProvider.token);
    if (targetToken === "DECRYPTION_FAILED") {
      allTargetsSucceeded = false;
      targetRef.status = "error";
      targetRef.failure_reason = `Target credentials cannot be decrypted for ${targetProvider.name}`;
      continue;
    }
    const syncStart = Date.now();
    sysLog.info(`Sync starting: ${item.source_repo} -> ${targetProvider.name} (Entities: ${entities.join(', ')})`);

    try {
      // Step 1: Forward Sync (Source -> Target)
      targetRef.status = 'syncing';
      targetRef.progress = 10;
      await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(item.targets), item.id]);

      if (entities.includes('code')) {
        sysLog.debug(`[${item.source_repo}] Pushing code...`);
        await syncCode(sourceProvider, targetProvider, item.source_repo, sourceToken, targetToken);
      }
      
      let milestoneMap = {};
      if (entities.includes('milestones')) {
        sysLog.debug(`[${item.source_repo}] Mapping milestones...`);
        milestoneMap = await syncMilestones(sourceProvider, targetProvider, item.source_repo, sourceToken, targetToken);
      }

      // Step 2: Bidirectional Sync (Target -> Source) if enabled
      if (settings?.bidirectional_sync) {
        sysLog.info(`[${item.source_repo}] Reverse sync active.`);
        let revMilestoneMap = {};
        if (entities.includes('milestones')) {
          revMilestoneMap = await syncMilestones(targetProvider, sourceProvider, item.source_repo, targetToken, sourceToken);
        }
        if (entities.includes('issues')) await syncIssues(targetProvider, sourceProvider, item.source_repo, targetToken, sourceToken, revMilestoneMap);
        if (entities.includes('releases')) await syncReleases(targetProvider, sourceProvider, item.source_repo, targetToken, sourceToken);
        if (entities.includes('snippets')) await syncSnippets(targetProvider, sourceProvider, item.source_repo, targetToken, sourceToken);
      }

      targetRef.progress = 60;
      await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(item.targets), item.id]);

      if (entities.includes('issues')) {
        sysLog.debug(`[${item.source_repo}] Syncing issues...`);
        await syncIssues(sourceProvider, targetProvider, item.source_repo, sourceToken, targetToken, milestoneMap);
      }
      if (entities.includes('releases')) {
        sysLog.debug(`[${item.source_repo}] Syncing releases...`);
        await syncReleases(sourceProvider, targetProvider, item.source_repo, sourceToken, targetToken);
      }
      if (entities.includes('snippets')) {
        sysLog.debug(`[${item.source_repo}] Syncing snippets...`);
        await syncSnippets(sourceProvider, targetProvider, item.source_repo, sourceToken, targetToken);
      }
      
      const durationSeconds = Math.floor((Date.now() - syncStart) / 1000);
      const durationStr = `${durationSeconds}s`;

      targetRef.status = 'synced';
      targetRef.progress = 100;
      targetRef.last_sync = new Date().toISOString();
      
      await pool.query(
        'UPDATE sync_matrix SET targets = $1, last_sync_duration = $2 WHERE id = $3', 
        [JSON.stringify(item.targets), durationStr, item.id]
      );
      
      sysLog.success(`Sync finished: ${item.source_repo} -> ${targetProvider.name} (${durationStr})`);
      
      await addLog({
        level: "info",
        code: "H-SYNC-OK",
        provider: targetProvider.type,
        message: `Successfully synced ${item.source_repo} to ${targetProvider.name}`,
        technical_context: `Entities: ${entities.join(', ')}`,
        ui_message: `Mirroring complete: ${item.source_repo}`,
        resolution: "No action required."
      });

    } catch (err: any) {
      allTargetsSucceeded = false;
      targetRef.status = 'error';
      targetRef.failure_reason = err.message;
      
      if (options.replayDlqId) {
        await pool.query(
          `UPDATE dlq_items
           SET error_message = $1, timestamp = CURRENT_TIMESTAMP, status = 'pending'
           WHERE id = $2`,
          [err.message, options.replayDlqId]
        );
      } else {
        await pool.query(
          `INSERT INTO dlq_items
            (id, sync_matrix_id, source_repo, target_node, target_provider_id, error_code, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [crypto.randomUUID(), item.id, item.source_repo, targetProvider.name, targetProvider.id, 'SYNC_FAIL', err.message]
        );
      }
        
      await addLog({
        level: "error",
        code: "H-SYNC-FAIL",
        provider: targetProvider.type,
        message: `Sync failed for ${item.source_repo} -> ${targetProvider.name}`,
        technical_context: err.message,
        ui_message: `Mirroring failed: ${item.source_repo}`,
        resolution: "Check DLQ for details and trigger manual replay."
      });

      sysLog.error(`Sync failed for ${item.source_repo} -> ${targetProvider.name}: ${err.message}`);
    }

    await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(item.targets), item.id]);
  }
  return allTargetsSucceeded;
  } finally {
    if (lockAcquired) {
      await lockClient.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined);
    }
    lockClient.release();
  }
}

// Background tasks
let isSyncing = false;
let syncTimer: NodeJS.Timeout | null = null;
const runSyncEngine = async () => {
  if (isSyncing) return;
  isSyncing = true;
  let syncIntervalMinutes = 1; // Default fallback
  try {
    sysLog.info("Sync engine heartbeat: Checking for items to mirror...");
    const settingsRes = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    syncIntervalMinutes = settings?.sync_interval || 15;
    await runRetentionCleanup();

    const matrixRes = await pool.query('SELECT * FROM sync_matrix');
    if (matrixRes.rows.length === 0) {
      sysLog.info("Sync engine: No repositories configured for mirroring yet.");
    } else {
      sysLog.info(`Sync engine: Processing ${matrixRes.rows.length} synchronization items...`);
      matrixRes.rows.forEach(row => {
        sysLog.info(` - Sync Item: ${row.source_repo} (Entities: ${row.entities || 'default'})`);
      });
    }
    
    // Process items in chunks based on max_concurrent_syncs to stagger performance
    const maxConcurrent = settings?.max_concurrent_syncs || 5;
    for (let i = 0; i < matrixRes.rows.length; i += maxConcurrent) {
      const chunk = matrixRes.rows.slice(i, i + maxConcurrent);
      await Promise.all(chunk.map(item => processSyncItem(item).catch(err => sysLog.error(`Item sync error: ${err}`))));
      
      // Stagger chunks to prevent network/CPU spikes
      if (i + maxConcurrent < matrixRes.rows.length) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second stagger
      }
    }
  } catch (err) {
    sysLog.error(`Sync engine error: ${err}`);
  } finally {
    isSyncing = false;
    sysLog.info(`Sync engine cycle complete. Next run in ${syncIntervalMinutes} minutes.`);
    syncTimer = setTimeout(runSyncEngine, syncIntervalMinutes * 60 * 1000);
  }
};

async function startServer() {

  const app = express();
  const PORT = 3000;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: securityConfig.isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    } : false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(cookieParser());
  app.use(express.json({
    limit: "1mb",
    verify: (req: any, _res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    }
  }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: "Too many failed login attempts; retry later" }
  });

  app.use("/api/v1", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/webhooks/")) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (origin && securityConfig.appOrigin && origin !== securityConfig.appOrigin) {
      res.status(403).json({ error: "Request origin is not allowed" });
      return;
    }
    next();
  });

  app.get("/health", async (req, res) => {
    try {
      await pool.query('SELECT 1');
      const gitVersion = (await runGit(["--version"])).trim();
      res.json({ 
        status: "UP", 
        database: "connected", 
        git: gitVersion,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(503).json({ status: "DOWN", error: err.message });
    }
  });
  app.get("/health/live", (_req, res) => res.json({ status: "UP" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "READY" });
    } catch {
      res.status(503).json({ status: "NOT_READY" });
    }
  });

  // API Routes
  app.post("/api/v1/auth/login", loginLimiter, async (req, res) => {
    const body = parseRequestBody(loginSchema, req, res);
    if (!body) return;
    const { email, password } = body;
    
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

      res.cookie(securityConfig.authCookieName, token, securityConfig.authCookieOptions);
      res.json({ 
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

  app.get("/api/v1/auth/session", authenticateToken, async (req, res) => {
    const identity = (req as any).user;
    const result = await pool.query(
      "SELECT email, name, is_default_password FROM users WHERE email = $1",
      [identity.email]
    );
    const user = result.rows[0];
    if (!user) {
      res.clearCookie(securityConfig.authCookieName, securityConfig.authCookieOptions);
      res.status(401).json({ error: "Session user no longer exists" });
      return;
    }
    res.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        isDefaultPassword: user.is_default_password
      }
    });
  });

  app.post("/api/v1/auth/logout", authenticateToken, (_req, res) => {
    res.clearCookie(securityConfig.authCookieName, securityConfig.authCookieOptions);
    res.status(204).end();
  });

  app.post("/api/v1/auth/reset-password", authenticateToken, async (req, res) => {
    const body = parseRequestBody(passwordResetSchema, req, res);
    if (!body) return;
    const { currentPassword, newPassword } = body;
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
      if (token === "DECRYPTION_FAILED") {
        return res.status(500).json({
          error: "Source provider credentials cannot be decrypted",
          detail: "Re-register the provider using the current HYDROZOA_MASTER_KEY."
        });
      }
      let baseUrl = sourceProvider.url.replace(/\/$/, '');
      if (sourceProvider.type === 'github' && (baseUrl === 'https://github.com' || baseUrl === 'http://github.com')) {
        baseUrl = 'https://api.github.com';
      }
      const headers: Record<string, string> = {
        'User-Agent': 'Hydrozoa-Mirror-Agent',
        'Accept': 'application/json'
      };
      
      if (sourceProvider.type === 'github') {
        headers['Authorization'] = `token ${token}`;
        sysLog.info("Fetching GitHub namespaces...");
        
        const userRes = await trackedFetch(sourceProvider.id, `${baseUrl}/user`, { headers });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`GitHub User API failed (${userRes.status}): ${errText}`);
          return res.status(502).json({ error: "GitHub API authentication failed", detail: errText });
        }

        const userData = await userRes.json();
        
        const orgsRes = await trackedFetch(sourceProvider.id, `${baseUrl}/user/orgs`, { headers });
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

        const userRes = await trackedFetch(sourceProvider.id, `${baseUrl}/api/v4/user`, { headers });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`GitLab User API failed (${userRes.status}): ${errText}`);
          return res.status(502).json({ error: "GitLab API authentication failed", detail: errText });
        }

        const userData = await userRes.json();

        const groupsRes = await trackedFetch(sourceProvider.id, `${baseUrl}/api/v4/groups`, { headers });
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
        const userRes = await trackedFetch(sourceProvider.id, `${baseUrl}/api/v1/user`, { headers: { 'Authorization': `token ${token}` } });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`${sourceProvider.type} User API failed (${userRes.status}): ${errText}`);
          const hydrozoaStatus = [401, 403].includes(userRes.status) ? 502 : userRes.status;
          return res.status(hydrozoaStatus).json({ error: `${sourceProvider.type} API authentication failed`, detail: errText });
        }
        const userData = await userRes.json();

        const orgsRes = await trackedFetch(sourceProvider.id, `${baseUrl}/api/v1/user/orgs`, { headers: { 'Authorization': `token ${token}` } });
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
        const userRes = await trackedFetch(sourceProvider.id, 'https://api.bitbucket.org/2.0/user', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!userRes.ok) {
          const errText = await userRes.text();
          sysLog.error(`Bitbucket User API failed (${userRes.status}): ${errText}`);
          const hydrozoaStatus = [401, 403].includes(userRes.status) ? 502 : userRes.status;
          return res.status(hydrozoaStatus).json({ error: "Bitbucket API authentication failed", detail: errText });
        }
        const userData = await userRes.json();

        const workspacesRes = await trackedFetch(sourceProvider.id, 'https://api.bitbucket.org/2.0/workspaces', { headers: { 'Authorization': `Bearer ${token}` } });
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
    const namespaceType = String(req.query.type || '').toLowerCase();
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 100;
    
    const result = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = result.rows[0];

    if (!sourceProvider) return res.json([]);

    try {
      const token = decrypt(sourceProvider.token);
      if (token === "DECRYPTION_FAILED") {
        return res.status(500).json({
          error: "Source provider credentials cannot be decrypted",
          detail: "Re-register the provider using the current HYDROZOA_MASTER_KEY."
        });
      }
      let baseUrl = sourceProvider.url.replace(/\/$/, '');
      if (sourceProvider.type === 'github' && (baseUrl === 'https://github.com' || baseUrl === 'http://github.com')) {
        baseUrl = 'https://api.github.com';
      }
      const headers: Record<string, string> = {
        'User-Agent': 'Hydrozoa-Mirror-Agent',
        'Accept': 'application/json'
      };
      
      if (sourceProvider.type === 'github') {
        headers['Authorization'] = `token ${token}`;
        const url = namespaceType === 'organization'
          ? `${baseUrl}/orgs/${encodeURIComponent(id)}/repos?per_page=${perPage}&page=${page}`
          : `${baseUrl}/user/repos?affiliation=owner&per_page=${perPage}&page=${page}`;
        sysLog.info(`Fetching GitHub repos for ${id} from ${url}`);

        const reposRes = await trackedFetch(sourceProvider.id, url, { headers });
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
          description: repo.description,
          web_url: repo.html_url,
          visibility: repo.private ? 'private' : 'public'
        })));
      }

      if (sourceProvider.type.includes('gitlab')) {
        headers['Private-Token'] = token;
        const url = id.startsWith('group-') 
          ? `${baseUrl}/api/v4/groups/${id.replace('group-', '')}/projects?per_page=${perPage}&page=${page}`
          : `${baseUrl}/api/v4/projects?owned=true&per_page=${perPage}&page=${page}`;
        
        sysLog.info(`Fetching GitLab projects for ${id} from ${url}`);

        const reposRes = await trackedFetch(sourceProvider.id, url, { headers });
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
          description: project.description,
          web_url: project.web_url,
          visibility: project.visibility === 'public' ? 'public' : 'private'
        })));
      }

      if (['gitea', 'forgejo', 'gogs'].includes(sourceProvider.type)) {
        // We try organization repos first, then fall back to user repos if needed
        let url = `${baseUrl}/api/v1/orgs/${id}/repos?limit=${perPage}&page=${page}`;
        sysLog.info(`Fetching ${sourceProvider.type} repos for ${id} from ${url}`);
        let reposRes = await trackedFetch(sourceProvider.id, url, { headers: { ...headers, 'Authorization': `token ${token}` } });
        
        if (!reposRes.ok) {
          // Fallback to user repos if org repos fail
          url = `${baseUrl}/api/v1/user/repos?limit=${perPage}&page=${page}`;
          sysLog.info(`Falling back to ${sourceProvider.type} user repos for ${id} from ${url}`);
          reposRes = await trackedFetch(sourceProvider.id, url, { headers: { ...headers, 'Authorization': `token ${token}` } });
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
        return res.json(safeReposData.map((repo: any) => ({ 
          id: repo.id.toString(), 
          name: repo.full_name || repo.name, 
          description: repo.description,
          web_url: repo.html_url || repo.web_url || (repo.links?.html?.href),
          visibility: repo.private || repo.is_private ? 'private' : 'public'
        })));
      }

      if (sourceProvider.type === 'bitbucket') {
        const url = `https://api.bitbucket.org/2.0/repositories/${id}?pagelen=${perPage}&page=${page}`;
        sysLog.info(`Fetching Bitbucket repos for ${id} from ${url}`);
        const reposRes = await trackedFetch(sourceProvider.id, url, { headers: { ...headers, 'Authorization': `Bearer ${token}` } });
        if (!reposRes.ok) {
          const errText = await reposRes.text();
          sysLog.error(`Bitbucket Repos API failed (${reposRes.status}) for ${id}: ${errText}`);
          const hydrozoaStatus = [401, 403].includes(reposRes.status) ? 502 : reposRes.status;
          return res.status(hydrozoaStatus).json({ error: "Bitbucket Repos API failed", detail: errText });
        }
        const reposData = await reposRes.json();
        const reposList = Array.isArray(reposData.values) ? reposData.values : [];
        sysLog.success(`Found ${reposList.length} repos for Bitbucket namespace ${id}`);
        return res.json(reposList.map((repo: any) => ({ 
          id: repo.uuid, 
          name: repo.full_name, 
          description: repo.description,
          web_url: repo.links?.html?.href,
          visibility: repo.is_private ? 'private' : 'public'
        })));
      }


      return res.json([]);
    } catch (err: any) {
      sysLog.error(`Failed to fetch repos: ${err.message}${err.cause ? ` (Cause: ${err.cause})` : ''}`);
      res.status(500).json({ error: "Failed to fetch repositories from provider" });
    }
  });

  app.post("/api/v1/auth/providers", authenticateToken, async (req, res) => {
    const body = parseRequestBody(providerSchema, req, res);
    if (!body) return;
    let { name, type, url, token, isSource, baseUrl, webhookSecret } = body;
    
    // Support both 'url' and 'baseUrl' (frontend uses baseUrl)
    let effectiveUrl = url || baseUrl || (type === 'github' ? 'https://api.github.com' : (type === 'bitbucket' ? 'https://api.bitbucket.org' : null));
    
    // Auto-fix GitHub and Bitbucket standard URLs to API URLs
    if (effectiveUrl) {
      const normalized = effectiveUrl.replace(/\/$/, '').toLowerCase();
      if (type === 'github' && (normalized === 'https://github.com' || normalized === 'http://github.com')) {
        effectiveUrl = 'https://api.github.com';
      } else if (type === 'bitbucket' && (normalized === 'https://bitbucket.org' || normalized === 'http://bitbucket.org' || normalized === 'https://api.bitbucket.org/2.0')) {
        effectiveUrl = 'https://api.bitbucket.org';
      }
    }

    // Basic validation
    if (!name || !type || !effectiveUrl || !token) {
      return res.status(400).json({ error: "Missing required fields: name, type, url/baseUrl, and token are mandatory." });
    }
    try {
      effectiveUrl = validateProviderBaseUrl(effectiveUrl);
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Invalid provider URL" });
    }

    const id = crypto.randomUUID();
    const credentialProbe = {
      id,
      name,
      type,
      url: effectiveUrl
    };

    const providerUser = await getProviderUser(credentialProbe, token);
    if (!providerUser) {
      return res.status(401).json({
        error: "Provider authentication failed",
        detail: `The ${type} user API rejected these credentials. Verify the token, API scopes, and provider URL.`
      });
    }

    const encryptedToken = encrypt(token);
    const encryptedWebhookSecret = webhookSecret ? encrypt(webhookSecret) : null;
    
    const provider = {
      id,
      name,
      type,
      url: effectiveUrl,
      isSource: isSource || false,
      webhookSecret: webhookSecret ? "****" : null,
      token: "glpat-****" // Masked for UI
    };

    try {
      if (provider.isSource) {
        await pool.query('UPDATE providers SET is_source = false');
      }
      await pool.query(
        'INSERT INTO providers (id, name, type, url, token, is_source, webhook_secret) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, name, type, provider.url, encryptedToken, provider.isSource, encryptedWebhookSecret]
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

  app.post("/api/v1/webhooks/incoming/:providerId", async (req, res) => {
    const { providerId } = req.params;
    sysLog.info(`Incoming webhook for ${providerId}`);
    
    try {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [providerId]);
      const provider = result.rows[0];
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      if (!provider.webhook_secret) {
        return res.status(401).json({ error: "Webhook authentication is not configured for this provider" });
      }

      const secret = decrypt(provider.webhook_secret);
      if (secret === "DECRYPTION_FAILED") {
        return res.status(500).json({ error: "Webhook secret cannot be decrypted" });
      }
      const type = provider.type.toLowerCase();
      const rawBody = (req as any).rawBody as Buffer | undefined;
      if (!rawBody) {
        return res.status(400).json({ error: "Raw webhook body is unavailable" });
      }

      if (type === 'github') {
        const signature = req.headers['x-hub-signature-256'];
        const digest = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        if (!timingSafeStringEqual(signature, digest)) {
          sysLog.error(`Invalid HMAC signature for ${provider.name}`);
          return res.status(401).json({ error: "Invalid signature" });
        }
      } else if (type.includes('gitlab')) {
        if (!timingSafeStringEqual(req.headers['x-gitlab-token'], secret)) {
          sysLog.error(`Invalid GitLab token for ${provider.name}`);
          return res.status(401).json({ error: "Invalid token" });
        }
      } else if (['gitea', 'forgejo'].includes(type)) {
        const signature = req.headers['x-gitea-signature'];
        const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        if (!timingSafeStringEqual(signature, digest)) {
          sysLog.error(`Invalid Gitea/Forgejo HMAC signature for ${provider.name}`);
          return res.status(401).json({ error: "Invalid signature" });
        }
      } else if (type === 'bitbucket') {
        if (!timingSafeStringEqual(req.headers['x-hook-secret'], secret)) {
          sysLog.error(`Invalid Bitbucket hook secret for ${provider.name}`);
          return res.status(401).json({ error: "Invalid secret" });
        }
      }

      const deliveryHeader = type === "github"
        ? req.headers["x-github-delivery"]
        : type.includes("gitlab")
          ? req.headers["x-gitlab-event-uuid"]
          : req.headers["x-gitea-delivery"] || req.headers["x-request-uuid"];
      const deliveryId = typeof deliveryHeader === "string"
        ? deliveryHeader
        : crypto.createHash("sha256").update(rawBody).digest("hex");
      const deliveryResult = await pool.query(
        `INSERT INTO webhook_deliveries (provider_id, delivery_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING delivery_id`,
        [providerId, deliveryId]
      );
      if (deliveryResult.rowCount === 0) {
        return res.status(202).json({ message: "Duplicate webhook ignored" });
      }

      // Trigger sync for all matrix items using this provider as source
      const matrixRes = await pool.query('SELECT * FROM sync_matrix WHERE source_provider = $1', [providerId]);
      
      const settingsRes = await pool.query('SELECT * FROM system_settings WHERE id = 1');
      const maxConcurrent = settingsRes.rows[0]?.max_concurrent_syncs || 5;

      // Run staggered sync in the background so we don't hold the webhook response open
      const runWebhookSync = async () => {
        for (let i = 0; i < matrixRes.rows.length; i += maxConcurrent) {
          const chunk = matrixRes.rows.slice(i, i + maxConcurrent);
          await Promise.all(chunk.map(item => processSyncItem(item).catch(err => sysLog.error(`Webhook sync error: ${err}`))));
          if (i + maxConcurrent < matrixRes.rows.length) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      };
      
      runWebhookSync().catch(err => sysLog.error(`Webhook background sync failed: ${err}`));

      res.status(202).json({ message: "Sync triggered" });
    } catch (err) {
      sysLog.error(`Webhook handler failed: ${err}`);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  app.delete("/api/v1/auth/providers/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query('SELECT * FROM providers WHERE id = $1 FOR UPDATE', [id]);
      const deleted = result.rows[0];
      if (!deleted) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Provider not found" });
      }

      const matrixResult = await client.query("SELECT * FROM sync_matrix FOR UPDATE");
      for (const matrixItem of matrixResult.rows) {
        if (matrixItem.source_provider === id) {
          await client.query("DELETE FROM dlq_items WHERE sync_matrix_id = $1", [matrixItem.id]);
          await client.query("DELETE FROM sync_matrix WHERE id = $1", [matrixItem.id]);
          continue;
        }
        const remainingTargets = matrixItem.targets.filter((target: any) => target.provider_id !== id);
        if (remainingTargets.length === 0) {
          await client.query("DELETE FROM dlq_items WHERE sync_matrix_id = $1", [matrixItem.id]);
          await client.query("DELETE FROM sync_matrix WHERE id = $1", [matrixItem.id]);
        } else if (remainingTargets.length !== matrixItem.targets.length) {
          await client.query("UPDATE sync_matrix SET targets = $1 WHERE id = $2", [
            JSON.stringify(remainingTargets),
            matrixItem.id
          ]);
        }
      }
      await client.query("DELETE FROM dlq_items WHERE target_provider_id = $1", [id]);
      await client.query('DELETE FROM providers WHERE id = $1', [id]);
      await client.query("COMMIT");
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
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      sysLog.error(`Provider deletion failed: ${error}`);
      res.status(500).json({ error: "Provider deletion failed" });
    } finally {
      client.release();
    }
  });

  app.put("/api/v1/auth/providers/:id/credentials", authenticateToken, async (req, res) => {
    const body = parseRequestBody(providerCredentialsSchema, req, res);
    if (!body) return;
    const result = await pool.query("SELECT * FROM providers WHERE id = $1", [req.params.id]);
    const provider = result.rows[0];
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const providerUser = await getProviderUser(provider, body.token);
    if (!providerUser) {
      return res.status(401).json({
        error: "Provider authentication failed",
        detail: `The ${provider.type} user API rejected these credentials. Verify token scopes and expiry.`
      });
    }

    await pool.query(
      "UPDATE providers SET token = $1, webhook_secret = $2 WHERE id = $3",
      [
        encrypt(body.token),
        body.webhookSecret ? encrypt(body.webhookSecret) : provider.webhook_secret,
        provider.id
      ]
    );
    res.json({ message: "Provider credentials rotated", providerUser });
  });

  app.get("/api/v1/system/ping/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [id]);
      const provider = result.rows[0];
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      const token = decrypt(provider.token);
      if (token === "DECRYPTION_FAILED") {
        return res.status(500).json({ latency: "error", status: "credentials-unreadable" });
      }
      const start = Date.now();
      const providerUser = await getProviderUser(provider, token);
      const latency = Date.now() - start;
      res.json({
        latency: `${latency}ms`,
        status: providerUser ? "healthy" : "authentication-failed"
      });
    } catch (err) {
      res.json({ latency: "timeout", status: "offline" });
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

  app.patch("/api/v1/system/sync-matrix/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const body = parseRequestBody(syncMatrixPatchSchema, req, res);
    if (!body) return;
    const { entities, sync_interval, branch } = body;
    
    try {
      const result = await pool.query('SELECT * FROM sync_matrix WHERE id = $1', [id]);
      const item = result.rows[0];
      if (!item) return res.status(404).json({ error: "Sync item not found" });

      const updatedEntities = entities || item.entities;
      const updatedInterval = sync_interval || item.sync_interval;
      const updatedBranch = branch || item.branch;

      await pool.query(
        'UPDATE sync_matrix SET entities = $1, sync_interval = $2, branch = $3 WHERE id = $4',
        [JSON.stringify(updatedEntities), updatedInterval, updatedBranch, id]
      );

      await addLog({
        level: "info",
        code: "H-SYNC-UPDATE",
        provider: item.source_provider,
        message: `Updated configuration for ${item.source_repo}`,
        technical_context: `New Entities: ${JSON.stringify(updatedEntities)}, Interval: ${updatedInterval}m`,
        ui_message: `Mirror settings updated: ${item.source_repo}`,
        resolution: "Settings applied to next sync cycle."
      });

      res.json({ message: "Sync configuration updated" });
    } catch (err) {
      sysLog.error(`Failed to update sync matrix: ${err}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/v1/system/sync-matrix/:id", authenticateToken, async (req, res) => {
    const sourceProvider = await pool.query("SELECT id FROM providers WHERE is_source = true");
    const sourceProviderId = sourceProvider.rows[0]?.id;
    if (!sourceProviderId) {
      return res.status(409).json({ error: "No source provider is configured" });
    }
    const result = await pool.query(
      "DELETE FROM sync_matrix WHERE id = $1 AND source_provider = $2 RETURNING id, source_repo",
      [req.params.id, sourceProviderId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Sync item not found for the active source provider" });
    }
    await pool.query("DELETE FROM dlq_items WHERE sync_matrix_id = $1", [req.params.id]);
    res.json({ message: "Mirror decommissioned", item: result.rows[0] });
  });

  app.post("/api/v1/system/dlq/:id/replay", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM dlq_items WHERE id = $1', [id]);
    const item = result.rows[0];
    if (item) {
      if (!item.sync_matrix_id || !item.target_provider_id) {
        return res.status(409).json({
          error: "Legacy DLQ item cannot be replayed automatically",
          detail: "Remove this item after verifying the mirror and trigger a manual sync."
        });
      }
      const matrixResult = await pool.query("SELECT * FROM sync_matrix WHERE id = $1", [item.sync_matrix_id]);
      const matrixItem = matrixResult.rows[0];
      if (!matrixItem) {
        return res.status(409).json({ error: "The source sync configuration no longer exists" });
      }
      await pool.query("UPDATE dlq_items SET status = 'replaying' WHERE id = $1", [id]);
      const targets = matrixItem.targets.map((target: any) =>
        target.provider_id === item.target_provider_id
          ? { ...target, status: "pending", progress: 0 }
          : target
      );
      await pool.query("UPDATE sync_matrix SET targets = $1 WHERE id = $2", [JSON.stringify(targets), matrixItem.id]);

      processSyncItem(
        { ...matrixItem, targets },
        { targetProviderIds: new Set([item.target_provider_id]), replayDlqId: id }
      ).then(async succeeded => {
        if (succeeded) await pool.query("DELETE FROM dlq_items WHERE id = $1", [id]);
      }).catch(async error => {
        await pool.query(
          "UPDATE dlq_items SET status = 'pending', error_message = $1, timestamp = CURRENT_TIMESTAMP WHERE id = $2",
          [error instanceof Error ? error.message : String(error), id]
        );
      });
      await addLog({
        level: "info",
        code: "H-DLQ-REPLAY",
        provider: item.target_provider_id,
        message: `Replay initiated for DLQ item: ${item.id}`,
        technical_context: `Replaying sync for ${item.source_repo} -> ${item.target_node}`,
        ui_message: `Replaying failed sync for ${item.source_repo}`,
        resolution: "Monitoring replay progress."
      });
      res.status(202).json({ message: "Replay initiated" });
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
    const body = parseRequestBody(sourceSelectionSchema, req, res);
    if (!body) return;
    const { selectedRepos, targetProviderIds, entities } = body;
    const selectedRepoDetails = selectedRepos.map((repo: any) => {
      return {
        id: repo.id,
        name: repo.name,
        description: repo.description || "Automated mirror target",
        tags: repo.tags || ["hydrozoa", "mirror"],
        entities: repo.entities || entities || ["code"],
        branch: repo.branch || "main",
        visibility: repo.visibility || "private",
        web_url: repo.web_url
      };
    });

    const sourceProviderRes = await pool.query('SELECT * FROM providers WHERE is_source = true');
    const sourceProvider = sourceProviderRes.rows[0];
    if (!sourceProvider) {
      return res.status(409).json({ error: "No source provider is configured" });
    }
    const sourceProviderId = sourceProvider.id;
    if (targetProviderIds.includes(sourceProviderId)) {
      return res.status(422).json({ error: "The source provider cannot also be selected as a mirror target" });
    }

    const selectedRepoNames = selectedRepoDetails.map(repo => repo.name);
    const provisionSummary: Array<{ provider: string; providerId: string; repo: string; status: string; message: string }> = [];

    for (const providerId of targetProviderIds) {
      const result = await pool.query('SELECT * FROM providers WHERE id = $1', [providerId]);
      const provider = result.rows[0];

      if (!provider) {
        return res.status(422).json({ error: `Target provider ${providerId} does not exist` });
      }

      const decryptedToken = decrypt(provider.token);
      if (decryptedToken === "DECRYPTION_FAILED") {
        provisionSummary.push({
          provider: provider.name,
          providerId,
          repo: "*",
          status: "failed",
          message: "Target credentials cannot be decrypted"
        });
        continue;
      }

      for (const repo of selectedRepoDetails) {
        const provisionResult = await provisionTargetRepository(provider, repo.name, repo.description, decryptedToken, repo.web_url, repo.visibility);

        provisionSummary.push({
          provider: provider.name,
          providerId,
          repo: repo.name,
          status: provisionResult.status,
          message: provisionResult.message
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const currentSyncsRes = await client.query(
        "SELECT * FROM sync_matrix WHERE source_provider = $1 FOR UPDATE",
        [sourceProviderId]
      );
      for (const row of currentSyncsRes.rows) {
        if (!selectedRepoNames.includes(row.source_repo)) {
          await client.query("DELETE FROM dlq_items WHERE sync_matrix_id = $1", [row.id]);
          await client.query("DELETE FROM sync_matrix WHERE id = $1 AND source_provider = $2", [row.id, sourceProviderId]);
        }
      }

      for (const repo of selectedRepoDetails) {
        const existingSync = currentSyncsRes.rows.find(row => row.source_repo === repo.name);
        const existingTargets = new Map((existingSync?.targets || []).map((target: any) => [target.provider_id, target]));
        const successfulTargetIds = targetProviderIds.filter(providerId =>
          provisionSummary.some(result =>
            result.providerId === providerId
            && result.repo === repo.name
            && result.status !== "failed"
          )
        );
        const targets = successfulTargetIds.map(providerId => existingTargets.get(providerId) || ({
          provider_id: providerId,
          status: "pending",
          last_sync: null,
          bytes_transferred: "0B",
          progress: 0
        }));

        if (targets.length === 0) {
          if (existingSync) {
            await client.query("DELETE FROM dlq_items WHERE sync_matrix_id = $1", [existingSync.id]);
            await client.query("DELETE FROM sync_matrix WHERE id = $1", [existingSync.id]);
          }
          continue;
        }

        if (existingSync) {
          await client.query(
            "UPDATE sync_matrix SET targets = $1, entities = $2, branch = $3 WHERE id = $4",
            [JSON.stringify(targets), JSON.stringify(repo.entities), repo.branch, existingSync.id]
          );
        } else {
          await client.query(
            `INSERT INTO sync_matrix
              (id, source_repo, source_provider, branch, last_commit, sync_interval, last_sync_duration, success_rate, targets, entities)
             VALUES ($1, $2, $3, $4, 'initial', 15, '0s', 100, $5, $6)`,
            [
              `sm-${crypto.randomUUID().slice(0, 8)}`,
              repo.name,
              sourceProviderId,
              repo.branch,
              JSON.stringify(targets),
              JSON.stringify(repo.entities)
            ]
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({ 
      message: "Selection saved and targets provisioned", 
      count: selectedRepos.length,
      summary: provisionSummary
    });
  });

  // Analytics endpoint for ApexCharts
  app.get("/api/v1/analytics/sync-metrics", authenticateToken, async (req, res) => {
    try {
      // Query successful syncs over the last 24 hours, grouped by hour
      const result = await pool.query(`
        SELECT 
          date_trunc('hour', timestamp) as hour,
          count(*) as count
        FROM logs 
        WHERE code = 'H-SYNC-OK' 
          AND timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour ASC
      `);

      // Fill in gaps for hours with no data
      const dataMap = new Map(result.rows.map(r => [new Date(r.hour).getTime(), parseInt(r.count)]));
      const data = [];
      const now = new Date();
      now.setMinutes(0, 0, 0);

      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 3600000);
        data.push({
          x: hour.toISOString(),
          y: dataMap.get(hour.getTime()) || 0
        });
      }

      res.json(data);
    } catch (err) {
      sysLog.error(`Failed to fetch analytics: ${err}`);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.post("/api/v1/sync/manual/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM sync_matrix WHERE id = $1', [id]);
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: "Sync item not found" });

    const targets = item.targets.map((t: any) => ({
      ...t,
      status: 'pending',
      progress: 0,
      last_sync: new Date().toISOString()
    }));

    await pool.query('UPDATE sync_matrix SET targets = $1 WHERE id = $2', [JSON.stringify(targets), id]);
    
    // Trigger sync immediately in background
    processSyncItem({ ...item, targets }).catch(err => sysLog.error(`Manual sync background error: ${err}`));
    
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

  app.get("/api/v1/system/settings", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM system_settings WHERE id = 1');
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/v1/system/settings", authenticateToken, async (req, res) => {
    const body = parseRequestBody(settingsSchema, req, res);
    if (!body) return;
    const {
      sync_interval,
      log_retention_days,
      max_concurrent_syncs,
      bidirectional_sync,
      conflict_strategy,
      mirror_description_mode,
      mirror_description_text
    } = body;
    try {
      await pool.query(
        `UPDATE system_settings SET 
          sync_interval = $1, 
          log_retention_days = $2, 
          max_concurrent_syncs = $3, 
          bidirectional_sync = $4, 
          conflict_strategy = $5,
          mirror_description_mode = $6,
          mirror_description_text = $7
        WHERE id = 1`,
        [
          sync_interval,
          log_retention_days,
          max_concurrent_syncs,
          bidirectional_sync,
          conflict_strategy,
          mirror_description_mode,
          mirror_description_mode === "custom" ? mirror_description_text?.trim() : null
        ]
      );
      
      await addLog({
        level: "info",
        code: "H-SYS-CONFIG",
        provider: "system",
        message: "System settings updated",
        technical_context: `Updated settings: ${JSON.stringify(body)}`,
        ui_message: "Configuration synchronized successfully.",
        resolution: "No action required."
      });
      res.json({ message: "Settings updated", settings: body });
    } catch (err) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  return await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      server.requestTimeout = 15 * 60_000;
      server.headersTimeout = 15_000;
      server.keepAliveTimeout = 5_000;
      sysLog.startup(`Server running on http://localhost:${PORT}`);
      resolve(server);
    });
    server.once("error", reject);
  });
}

sysLog.info("Calling startServer...");
async function bootstrap() {
  await initDb();
  const server = await startServer();
  syncTimer = setTimeout(runSyncEngine, 5000);
  const shutdown = (signal: string) => {
    sysLog.info(`${signal} received; draining HTTP and database connections.`);
    if (syncTimer) clearTimeout(syncTimer);
    server.close(async () => {
      await pool.end().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  sysLog.error(`Hydrozoa startup failed: ${error instanceof Error ? error.message : error}`);
  pool.end().catch(() => undefined).finally(() => process.exit(1));
});
