import { describe, expect, it } from "vitest";
import { loadSecurityConfiguration, redactSensitiveText, timingSafeStringEqual, validateProviderBaseUrl } from "./security.js";
describe("security configuration", () => {
    it("fails closed when production secrets are absent", () => {
        expect(() => loadSecurityConfiguration({ NODE_ENV: "production" }))
            .toThrow(/JWT_SECRET/);
    });
    it("requires the production application origin to use TLS", () => {
        const env = {
            NODE_ENV: "production",
            JWT_SECRET: "j".repeat(32),
            HYDROZOA_MASTER_KEY: "m".repeat(32),
            APP_URL: "http://hydrozoa.example.com"
        };
        expect(() => loadSecurityConfiguration(env)).toThrow(/HTTPS/);
    });
    it("creates a secure, strict, http-only production cookie", () => {
        const config = loadSecurityConfiguration({
            NODE_ENV: "production",
            JWT_SECRET: "j".repeat(32),
            HYDROZOA_MASTER_KEY: "m".repeat(32),
            APP_URL: "https://hydrozoa.example.com"
        });
        expect(config.authCookieOptions).toMatchObject({
            httpOnly: true,
            secure: true,
            sameSite: "strict"
        });
    });
});
describe("security primitives", () => {
    it("uses exact timing-safe string equality semantics", () => {
        expect(timingSafeStringEqual("delivery-secret", "delivery-secret")).toBe(true);
        expect(timingSafeStringEqual("delivery-secreu", "delivery-secret")).toBe(false);
        expect(timingSafeStringEqual("short", "delivery-secret")).toBe(false);
    });
    it("rejects unsafe provider URL schemes and embedded credentials", () => {
        expect(() => validateProviderBaseUrl("file:///etc/passwd")).toThrow(/HTTP/);
        expect(() => validateProviderBaseUrl("https://token@example.com")).toThrow(/credentials/);
        expect(validateProviderBaseUrl("https://git.example.com/path/?secret=yes#x"))
            .toBe("https://git.example.com/path");
    });
    it("redacts every occurrence of supplied secrets", () => {
        expect(redactSensitiveText("token one token", ["token"]))
            .toBe("[REDACTED] one [REDACTED]");
    });
});
