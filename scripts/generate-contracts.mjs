// Generates the TypeScript API contract from the FastAPI OpenAPI schema.
// Run with `pnpm contract:generate` from the repo root.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const packageDir = path.join(root, "packages", "api-contract");
const schemaPath = path.join(packageDir, "openapi.json");

const python =
  process.platform === "win32"
    ? path.join(apiDir, ".venv", "Scripts", "python.exe")
    : path.join(apiDir, ".venv", "bin", "python");

const dumpScript = [
  "import json",
  "from app.main import app",
  "print(json.dumps(app.openapi(), indent=2))",
].join("; ");

console.log(`Dumping OpenAPI schema from ${apiDir}`);
const schema = execSync(`"${python}" -c "${dumpScript}"`, {
  cwd: apiDir,
  encoding: "utf8",
});
fs.writeFileSync(schemaPath, schema);

console.log("Generating TypeScript types");
execSync(
  [
    "pnpm",
    "--filter",
    "@careeros/api-contract",
    "exec",
    "openapi-typescript",
    "openapi.json",
    "-o",
    path.join("src", "generated", "api.ts"),
  ].join(" "),
  { cwd: root, stdio: "inherit", shell: true },
);

console.log(`Contract generated at ${path.join(packageDir, "src", "generated", "api.d.ts")}`);
