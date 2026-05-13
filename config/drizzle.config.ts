import { defineConfig } from "drizzle-kit";
import { getMigrationConfig } from "../server/config/database";

// Получаем унифицированную конфигурацию
const dbConfig = getMigrationConfig();

export default defineConfig({
  out: "./drizzle",
  schema: "./shared/types/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl
  },
  verbose: true,
  strict: true
});