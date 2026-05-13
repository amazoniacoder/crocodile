import pkg from "pg";
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import { 
  newsSources,
  newsArticles,
  newsClusters,
  userTokens,
  userChannelSubscriptions,
} from "../../shared/types/schema";
import { getDrizzleConfig, logDatabaseConfig } from '../config/database';

// Получаем унифицированную конфигурацию
const dbConfig = getDrizzleConfig();

// Создаем пул соединений с унифицированной конфигурацией
export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
  max: dbConfig.max,
  min: 2, // Минимальное количество соединений
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
  allowExitOnIdle: dbConfig.allowExitOnIdle,
});

// Add error handling for the pool
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// Initialize Drizzle with specific schema tables
export const db = drizzle(pool, { 
  schema: { 
    newsSources,
    newsArticles,
    newsClusters,
    userTokens,
    userChannelSubscriptions,
  } 
});

// Функция проверки подключения с retry логикой
export async function checkDatabaseConnection(retries = 3, delay = 1000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("✅ Database connection successful");
      
      // Проверяем версию PostgreSQL
      const result = await client.query('SELECT version()');
      console.log(`📊 PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
      
      client.release();
      return true;
    } catch (error) {
      if (i < retries - 1) {
        console.log(`⚠️  Database connection attempt ${i + 1}/${retries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Экспоненциальная задержка
      } else {
        console.error("❌ Database connection failed after retries:", error);
        return false;
      }
    }
  }
  return false;
}

// Логируем конфигурацию при инициализации
logDatabaseConfig();

// Проверяем подключение при импорте
checkDatabaseConnection().catch(err => {
  console.error("Initial database connection check failed:", err);
});