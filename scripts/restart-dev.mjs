import { execFileSync, spawnSync } from "node:child_process";

const port = process.env.WIGGLI_DEV_PORT || "3100";

function listeningPids() {
  try {
    const output = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    return output.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

const pids = listeningPids();
for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Stopped server process ${pid} on port ${port}`);
  } catch {
    // The process may have exited between lsof and kill.
  }
}

if (pids.length > 0) {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log(`Starting Wiggli Calendar demo on http://localhost:${port}/dashboard/calendar`);
spawnSync("npm", ["run", "dev", "--", "--port", port], {
  cwd: process.cwd(),
  stdio: "inherit",
});
