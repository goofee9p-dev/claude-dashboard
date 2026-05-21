import { spawnSync } from "node:child_process";

const pythonPath = "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const scriptPath = "scripts/build-dashboard-data.py";

const result = spawnSync(pythonPath, [scriptPath], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

process.exit(result.status ?? 1);
