import { config } from 'dotenv';

// Загружаем переменные окружения
config();

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  url: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeoutMs?: number;
}

/**
 * Парсинг DATABASE_URL в компоненты
 */
function parseDatabaseUrl(url: string): Omit<DatabaseConfig, 'url'> {
  try {
    const parsed = new URL(url);
    
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.slice(1), // убираем ведущий слэш
      ssl: parsed.searchParams.get('ssl') === 'true' || parsed.searchParams.get('sslmode') === 'require',
      maxConnections: parsed.searchParams.get('max_connections') 
        ? parseInt(parsed.searchParams.get('max_connections')!) 
        : undefined,
      connectionTimeoutMs: parsed.searchParams.get('timeout') 
        ? parseInt(parsed.searchParams.get('timeout')!) * 1000 
        : undefined
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Построение DATABASE_URL из компонентов
 */
function buildDatabaseUrl(config: Omit<DatabaseConfig, 'url'>): string {
  const { host, port, user, password, database, ssl, maxConnections, connectionTimeoutMs } = config;
  
  let url = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  
  const params = new URLSearchParams();
  if (ssl) params.set('sslmode', 'require');
  if (maxConnections) params.set('max_connections', maxConnections.toString());
  if (connectionTimeoutMs) params.set('timeout', (connectionTimeoutMs / 1000).toString());
  
  const paramString = params.toString();
  if (paramString) {
    url += `?${paramString}`;
  }
  
  return url;
}

/**
 * Получение конфигурации базы данных из переменных окружения
 */
export function getDatabaseConfig(): DatabaseConfig {
  // Приоритет 1: DATABASE_URL (полная строка подключения)
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    try {
      const parsed = parseDatabaseUrl(databaseUrl);
      return {
        ...parsed,
        url: databaseUrl
      };
    } catch (error) {
      console.warn('Failed to parse DATABASE_URL, falling back to individual variables:', error);
    }
  }
  
  // Приоритет 2: Отдельные переменные (для совместимости с Drizzle Kit)
  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432');
  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || 'news_aggregator';
  
  // Дополнительные параметры
  const ssl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
  const maxConnections = process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS) : 20;
  const connectionTimeoutMs = process.env.DB_TIMEOUT ? parseInt(process.env.DB_TIMEOUT) * 1000 : 30000;
  
  const config: Omit<DatabaseConfig, 'url'> = {
    host,
    port,
    user,
    password,
    database,
    ssl,
    maxConnections,
    connectionTimeoutMs
  };
  
  return {
    ...config,
    url: buildDatabaseUrl(config)
  };
}

/**
 * Валидация конфигурации базы данных
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  const required = ['host', 'port', 'user', 'database'];
  const missing = required.filter(key => !config[key as keyof DatabaseConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }
  
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid database port: ${config.port}`);
  }
  
  if (config.maxConnections && (config.maxConnections < 1 || config.maxConnections > 100)) {
    throw new Error(`Invalid max connections: ${config.maxConnections}`);
  }
}

/**
 * Получение конфигурации для Drizzle ORM
 */
export function getDrizzleConfig() {
  const config = getDatabaseConfig();
  validateDatabaseConfig(config);
  
  return {
    connectionString: config.url,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.maxConnections || 20,
    connectionTimeoutMillis: config.connectionTimeoutMs || 30000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true
  };
}

/**
 * Получение конфигурации для миграций
 */
export function getMigrationConfig() {
  const config = getDatabaseConfig();
  validateDatabaseConfig(config);
  
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
    // Для миграций используем меньше соединений
    max: 5,
    connectionTimeoutMillis: config.connectionTimeoutMs || 30000
  };
}

/**
 * Логирование конфигурации (без паролей)
 */
export function logDatabaseConfig(): void {
  const config = getDatabaseConfig();
  
  console.log('📊 Database Configuration:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   SSL: ${config.ssl ? 'enabled' : 'disabled'}`);
  console.log(`   Max Connections: ${config.maxConnections || 'default'}`);
  console.log(`   Timeout: ${config.connectionTimeoutMs || 'default'}ms`);
}

// Экспорт для обратной совместимости
export const dbConfig = getDatabaseConfig();

// Валидация при импорте модуля
try {
  validateDatabaseConfig(dbConfig);
} catch (error) {
  console.error('❌ Database configuration error:', error);
  process.exit(1);
}