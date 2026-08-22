import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

// Load .env.local if DATABASE_URL is not set in environment
if (!process.env.DATABASE_URL) {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envLocalPath);
    } catch {
      // Ignore if cannot load
    }
  }
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
