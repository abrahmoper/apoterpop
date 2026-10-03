import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DB_PATH = process.env.LOCAL_DB_PATH || path.resolve(process.cwd(), "data/kiray.sqlite");

console.log("[reset] Resetting local database...");
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log(`[reset] Deleted: ${DB_PATH}`);
}

execSync("node scripts/setup.mjs", { stdio: "inherit" });
console.log("[reset] Database reset and re-seeded successfully!");
