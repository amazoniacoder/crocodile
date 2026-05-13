// Тестовый скрипт для проверки приватных каналов
// Запуск: node scripts/test-private-channels.js

import fetch from 'node-fetch';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';
const BASE_URL = 'http://localhost:5000';

async function testPrivateChannels() {
  console.log('🔍 Проверка приватных каналов...\n');

  try {
    // 1. Проверяем админский токен
    console.log('1️⃣ Проверка админского токена...');
    const tokenRes = await fetch(`${BASE_URL}/api/admin/admin-channels/token`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const tokenData = await tokenRes.json();
    console.log('✅ Токен:', tokenData.success ? 'OK' : 'FAIL');
    if (tokenData.token) {
      console.log('   ID:', tokenData.token.id);
      console.log('   Label:', tokenData.token.label);
    }
    console.log();

    // 2. Получаем список приватных каналов
    console.log('2️⃣ Получение списка приватных каналов...');
    const sourcesRes = await fetch(`${BASE_URL}/api/admin/admin-channels/sources`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const sourcesData = await sourcesRes.json();
    console.log('✅ Каналов:', sourcesData.sources?.length || 0);
    
    if (sourcesData.sources && sourcesData.sources.length > 0) {
      console.log('\n📋 Список каналов:');
      sourcesData.sources.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.name} (${s.sourceType})`);
        console.log(`      ID: ${s.id}, Active: ${s.isActive}, Private: ${s.isPrivate}`);
        if (s.sourceType === 'telegram') console.log(`      Username: @${s.username}`);
        if (s.sourceType === 'youtube') console.log(`      Channel ID: ${s.channelId}`);
      });
    }
    console.log();

    // 3. Проверяем доступные каналы для пользователя
    console.log('3️⃣ Проверка доступных каналов через /api/my/available-channels...');
    const availableRes = await fetch(`${BASE_URL}/api/my/available-channels`, {
      headers: { 'x-user-token': tokenData.token?.token || '' },
    });
    const availableData = await availableRes.json();
    console.log('✅ Доступных каналов:', availableData.channels?.length || 0);
    
    const privateChannels = availableData.channels?.filter(c => c.isPrivate) || [];
    console.log('   Из них приватных:', privateChannels.length);
    
    if (privateChannels.length > 0) {
      console.log('\n📋 Приватные каналы:');
      privateChannels.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (${c.sourceType})`);
      });
    }
    console.log();

    // 4. Проверяем статистику Telegram
    console.log('4️⃣ Проверка статистики Telegram...');
    const tgStatsRes = await fetch(`${BASE_URL}/api/admin/telegram/stats`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const tgStatsData = await tgStatsRes.json();
    console.log('✅ Telegram каналов в статистике:', tgStatsData.stats?.length || 0);
    console.log();

    // 5. Проверяем статистику YouTube
    console.log('5️⃣ Проверка статистики YouTube...');
    const ytStatsRes = await fetch(`${BASE_URL}/api/admin/youtube/stats`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const ytStatsData = await ytStatsRes.json();
    console.log('✅ YouTube каналов в статистике:', ytStatsData.stats?.length || 0);
    console.log();

    // Итоги
    console.log('📊 ИТОГИ:');
    console.log(`   Приватных каналов в БД: ${sourcesData.sources?.length || 0}`);
    console.log(`   Доступно пользователю: ${privateChannels.length}`);
    console.log(`   В статистике TG: ${tgStatsData.stats?.length || 0}`);
    console.log(`   В статистике YT: ${ytStatsData.stats?.length || 0}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testPrivateChannels();
