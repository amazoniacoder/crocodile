// Проверка API доступных каналов
// Запуск: node scripts/test-available-channels.js ADMIN_TOKEN

const adminToken = process.argv[2];

if (!adminToken) {
  console.error('Usage: node scripts/test-available-channels.js ADMIN_TOKEN');
  process.exit(1);
}

async function testAvailableChannels() {
  console.log('🔍 Проверка /api/my/available-channels...\n');

  try {
    const res = await fetch('http://localhost:5000/api/my/available-channels', {
      headers: {
        'x-user-token': adminToken,
      },
    });

    console.log('Status:', res.status);
    const data = await res.json();
    
    console.log('\n📊 Результат:');
    console.log('Всего каналов:', data.channels?.length || 0);
    
    const privateChannels = data.channels?.filter(c => c.isPrivate) || [];
    console.log('Приватных каналов:', privateChannels.length);
    
    const youtubeChannels = data.channels?.filter(c => c.sourceType === 'youtube') || [];
    console.log('YouTube каналов:', youtubeChannels.length);
    
    const privateYouTube = data.channels?.filter(c => c.isPrivate && c.sourceType === 'youtube') || [];
    console.log('Приватных YouTube:', privateYouTube.length);
    
    if (privateYouTube.length > 0) {
      console.log('\n📋 Приватные YouTube каналы:');
      privateYouTube.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} (ID: ${c.id}, channelId: ${c.channelId})`);
      });
    } else {
      console.log('\n⚠️  Приватные YouTube каналы не найдены!');
      console.log('\nПроверьте:');
      console.log('1. Токен админский? (is_admin = true в user_tokens)');
      console.log('2. Есть ли записи в admin_channel_access?');
      console.log('3. Поле isPrivate = true в news_sources?');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testAvailableChannels();
