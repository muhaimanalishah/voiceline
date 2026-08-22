import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Cache database connection across hot reloads in development
declare global {
  var _postgresClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL || "";

function getPostgresClient() {
  if (!connectionString) {
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return postgres(connectionString);
  }

  if (!global._postgresClient) {
    global._postgresClient = postgres(connectionString);
  }
  return global._postgresClient;
}

export const client = getPostgresClient();
export const db = client ? drizzle(client, { schema }) : null;
export { schema };
