import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "./git-process.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("runGit", () => {
  it("executes Git without a shell", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hydrozoa-git-test-"));
    temporaryDirectories.push(directory);
    const marker = path.join(directory, "shell-injection-marker");

    await runGit(["--version", `;touch ${marker}`], { timeoutMs: 5_000 });
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("enforces bounded output", async () => {
    await expect(runGit(["--version"], { maxOutputBytes: 1, timeoutMs: 5_000 }))
      .rejects.toThrow(/safety limit/);
  });
});
