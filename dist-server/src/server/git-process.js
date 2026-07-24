import { spawn } from "child_process";
import fs from "fs";
import path from "path";
function createAskPassScript(directory) {
    const scriptPath = path.join(directory, "git-askpass.sh");
    const content = [
        "#!/bin/sh",
        "case \"$1\" in",
        "  *sername*) printf '%s' \"$HYDROZOA_GIT_USERNAME\" ;;",
        "  *) printf '%s' \"$HYDROZOA_GIT_PASSWORD\" ;;",
        "esac",
        ""
    ].join("\n");
    fs.writeFileSync(scriptPath, content, { encoding: "utf8", mode: 0o700 });
    return scriptPath;
}
export async function runGit(args, options = {}) {
    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
    const maxOutputBytes = options.maxOutputBytes ?? 50 * 1024 * 1024;
    const askPassPath = options.credentials && options.askPassDirectory
        ? createAskPassScript(options.askPassDirectory)
        : null;
    const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
    };
    if (options.credentials && askPassPath) {
        env.GIT_ASKPASS = askPassPath;
        env.HYDROZOA_GIT_USERNAME = options.credentials.username;
        env.HYDROZOA_GIT_PASSWORD = options.credentials.password;
    }
    return await new Promise((resolve, reject) => {
        const child = spawn("git", args, {
            cwd: options.cwd,
            env,
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        const stdout = [];
        const stderr = [];
        let outputBytes = 0;
        let settled = false;
        let timer;
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            if (timer)
                clearTimeout(timer);
            if (askPassPath)
                fs.rmSync(askPassPath, { force: true });
            if (error)
                reject(error);
            else
                resolve(Buffer.concat(stdout).toString("utf8"));
        };
        const collect = (target, chunk) => {
            outputBytes += chunk.length;
            if (outputBytes > maxOutputBytes) {
                child.kill("SIGKILL");
                finish(new Error("Git output exceeded the configured safety limit"));
                return;
            }
            target.push(chunk);
        };
        child.stdout.on("data", (chunk) => collect(stdout, chunk));
        child.stderr.on("data", (chunk) => collect(stderr, chunk));
        child.on("error", (error) => finish(error));
        child.on("close", (code, signal) => {
            if (code === 0) {
                finish();
                return;
            }
            const detail = Buffer.concat(stderr).toString("utf8").trim();
            finish(new Error(`Git exited with ${code ?? signal ?? "unknown"}${detail ? `: ${detail}` : ""}`));
        });
        timer = setTimeout(() => {
            child.kill("SIGKILL");
            finish(new Error(`Git operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
}
