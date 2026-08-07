/**
 * Ensures Postgres database `evolution` exists (used by Evolution API container).
 * Prefers `psql` so the script works without a root `pg` dependency.
 */
const { execFileSync } = require("child_process");
const path = require("path");

function findPsql() {
  const candidates = [
    process.env.PGBIN && path.join(process.env.PGBIN, "psql.exe"),
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
    "psql",
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      /* try next */
    }
  }
  return null;
}

function main() {
  const psql = findPsql();
  if (!psql) {
    console.warn("psql não encontrado — assume que o banco 'evolution' já existe.");
    return;
  }

  const env = {
    ...process.env,
    PGPASSWORD: process.env.PGPASSWORD || "postgres",
  };
  const args = [
    "-h",
    "127.0.0.1",
    "-U",
    process.env.PGUSER || "postgres",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname = 'evolution'",
  ];

  const exists = execFileSync(psql, args, { env, encoding: "utf8" }).trim();
  if (exists === "1") {
    console.log("evolution database already exists");
    return;
  }

  execFileSync(
    psql,
    ["-h", "127.0.0.1", "-U", process.env.PGUSER || "postgres", "-d", "postgres", "-c", "CREATE DATABASE evolution"],
    { env, stdio: "inherit" },
  );
  console.log("created evolution database");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
