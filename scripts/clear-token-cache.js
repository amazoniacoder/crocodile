// Очистка кэша user token
// Запуск: node scripts/clear-token-cache.js

import { createClient } from 'redis';

async function clearTokenCache() {
  console.log('🧹 Очистка кэша user tokens...\n');

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await client.connect();
    console.log('✅ Подключено к Redis\n');

    const keys = await client.keys('user_token:*');
    console.log(`Найдено ключей: ${keys.length}`);
    
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`✅ Удалено: ${keys.length} ключей\n`);
    } else {
      console.log('Нет ключей для удаления\n');
    }

    console.log('✅ Готово! Обновите страницу /my');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await client.quit();
  }
}

clearTokenCache();
