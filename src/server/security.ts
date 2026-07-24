import crypto from "crypto";
import type { CookieOptions, Request } from "express";

const DEFAULT_JWT_SECRET = "hydrozoa-deep-sea-secret-99";
const DEFAULT_MASTER_KEY = "default-secret-key-32-chars-long!!";

export interface SecurityConfiguration {
  jwtSecret: string;
  masterKey: string;
  isProduction: boolean;
  authCookieName: string;
  authCookieOptions: CookieOptions;
  appOrigin: string | null;
}

function requireSecret(
  name: string,
  value: string | undefined,
  insecureDefault: string,
  isProduction: boolean
): string {
  const resolved = value || (isProduction ? "" : insecureDefault);
  if (isProduction && (!resolved || resolved === insecureDefault || resolved.length < 32)) {
    throw new Error(`${name} must be explicitly configured with at least 32 characters in production`);
  }
  return resolved;
}

export function loadSecurityConfiguration(env: NodeJS.ProcessEnv = process.env): SecurityConfiguration {
  const isProduction = env.NODE_ENV === "production";
  const jwtSecret = requireSecret("JWT_SECRET", env.JWT_SECRET, DEFAULT_JWT_SECRET, isProduction);
  const masterKey = requireSecret("HYDROZOA_MASTER_KEY", env.HYDROZOA_MASTER_KEY, DEFAULT_MASTER_KEY, isProduction);
  if (isProduction && !env.APP_URL) {
    throw new Error("APP_URL must be explicitly configured in production");
  }
  const appOrigin = env.APP_URL ? new URL(env.APP_URL).origin : null;
  if (isProduction && !appOrigin?.startsWith("https://")) {
    throw new Error("APP_URL must use HTTPS in production");
  }

  return {
    jwtSecret,
    masterKey,
    isProduction,
    appOrigin,
    authCookieName: "hydrozoa_session",
    authCookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000
    }
  };
}

export function getRequestToken(req: Request, cookieName: string): string | null {
  const cookieToken = req.cookies?.[cookieName];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ", 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function timingSafeStringEqual(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function validateProviderBaseUrl(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Provider URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Provider URL must not contain embedded credentials");
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function redactSensitiveText(value: string, secrets: Array<string | null | undefined>): string {
  return secrets.reduce<string>((text, secret) => {
    if (!secret) return text;
    return text.split(secret).join("[REDACTED]");
  }, value);
}
