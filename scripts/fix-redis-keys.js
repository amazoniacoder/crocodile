// Очистка проблемных ключей Redis
// Запуск: node scripts/fix-redis-keys.js

import { createClient } from 'redis';

async function fixRedisKeys() {
  console.log('🔧 Исправление Redis ключей...\n');

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await client.connect();
    console.log('✅ Подключено к Redis\n');

    // 1. Удаляем старые ключи timestamps:* (без префикса ratelimit:)
    console.log('1️⃣ Поиск старых ключей timestamps:*...');
    const oldTimestamps = await client.keys('timestamps:*');
    if (oldTimestamps.length > 0) {
      console.log(`   Найдено: ${oldTimestamps.length}`);
      await client.del(oldTimestamps);
      console.log(`   ✅ Удалено: ${oldTimestamps.length}\n`);
    } else {
      console.log('   Нет старых ключей\n');
    }

    // 2. Проверяем и исправляем ключи ratelimit:timestamps:*
    console.log('2️⃣ Проверка ключей ratelimit:timestamps:*...');
    const rateLimitTimestamps = await client.keys('ratelimit:timestamps:*');
    let fixed = 0;
    
    for (const key of rateLimitTimestamps) {
      try {
        const type = await client.type(key);
        if (type !== 'list') {
          console.log(`   ⚠️  ${key} имеет тип ${type}, ожидается list`);
          await client.del(key);
          fixed++;
        }
      } catch (error) {
        console.log(`   ❌ Ошибка проверки ${key}:`, error.message);
        await client.del(key);
        fixed++;
      }
    }
    
    if (fixed > 0) {
      console.log(`   ✅ Исправлено: ${fixed}\n`);
    } else {
      console.log(`   Все ключи корректны (${rateLimitTimestamps.length})\n`);
    }

    // 3. Статистика
    console.log('3️⃣ Статистика Redis:');
    const dbSize = await client.dbSize();
    console.log(`   Всего ключей: ${dbSize}`);
    
    const rateLimitKeys = await client.keys('ratelimit:*');
    console.log(`   Rate limit ключей: ${rateLimitKeys.length}`);
    
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

fixRedisKeys();
