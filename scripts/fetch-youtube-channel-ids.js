/**
 * Скрипт для получения YouTube Channel ID по handle
 * 
 * Использование:
 * node scripts/fetch-youtube-channel-ids.js
 */

import https from 'https';

const channels = [
  { handle: '@ivansbobrovs2751', name: 'Ivans Bobrovs 2' },
  { handle: '@cameronmye', name: 'Cameron' },
  { handle: '@JonatheDropped', name: 'Jona the Dropped' },
  { handle: '@ИринаПелихова', name: 'Новости грядущего от Ирины Пелиховой' },
  { handle: '@justus.pianist', name: 'Justus Eichhorn' },
  { handle: '@Миша_может', name: 'Миша может' },
  { handle: '@antik_ruins', name: '@antik_ruins' },
  { handle: '@astralionica', name: 'Astralionica' },
  { handle: '@p.ivanov', name: 'Павел Иванов' },
  { handle: '@guitarhit', name: 'Хиты на гитаре' },
  { handle: '@ЖизньвстранеТроллей', name: 'Жизнь в стране Троллей' },
  { handle: '@ivanzarevich16', name: 'Иван Царевич' },
  { handle: '@edemdalshe1', name: 'Едем Дальше' },
  { handle: '@GoodSimpleLiving', name: 'Good Simple Living' },
  { handle: '@truebloodtheband', name: 'Trueblood' },
  { handle: '@jonnajinton', name: 'Jonna Jinton' },
  { handle: '@ХвойныйКрай', name: 'Хвойный Край' },
  { handle: '@dublincitytoday', name: 'Dublin City Today' },
  { handle: '@garysen-m6s', name: 'Guitar B28' },
  { handle: '@t-guitar', name: 'TGuitar' },
];

/**
 * Получить Channel ID из HTML страницы канала
 */
function fetchChannelId(handle) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/${handle}`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Множественные паттерны для поиска channelId
        const patterns = [
          /"channelId":"(UC[a-zA-Z0-9_-]{22})"/,
          /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
          /"browse_id":"(UC[a-zA-Z0-9_-]{22})"/,
          /channelId=([UC][a-zA-Z0-9_-]{23})/,
          /"channelUrl":"[^"]*\/channel\/(UC[a-zA-Z0-9_-]{22})"/,
        ];
        
        for (const pattern of patterns) {
          const match = data.match(pattern);
          if (match && match[1]) {
            resolve(match[1]);
            return;
          }
        }
        
        reject(new Error('Channel ID not found'));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Задержка между запросами
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Главная функция
 */
async function main() {
  console.log('Fetching YouTube Channel IDs...\n');
  
  const results = [];
  
  for (const channel of channels) {
    try {
      console.log(`Fetching ${channel.handle}...`);
      const channelId = await fetchChannelId(channel.handle);
      results.push({ ...channel, channelId, status: 'success' });
      console.log(`✓ ${channel.handle} → ${channelId}\n`);
    } catch (error) {
      results.push({ ...channel, channelId: null, status: 'error', error: error.message });
      console.log(`✗ ${channel.handle} → Error: ${error.message}\n`);
    }
    
    // Задержка 1 секунда между запросами
    await delay(1000);
  }
  
  // Вывод результатов
  console.log('\n=== RESULTS ===\n');
  console.log('| Handle | Name | Channel ID | Status |');
  console.log('|--------|------|------------|--------|');
  
  for (const result of results) {
    const status = result.status === 'success' ? '✓' : '✗';
    const channelId = result.channelId || 'N/A';
    console.log(`| ${result.handle} | ${result.name} | ${channelId} | ${status} |`);
  }
  
  // Генерация SQL
  console.log('\n\n=== SQL INSERT STATEMENTS ===\n');
  
  const successResults = results.filter(r => r.status === 'success');
  
  if (successResults.length > 0) {
    console.log('-- Добавление приватных YouTube-каналов для админа\n');
    console.log('DO $$');
    console.log('DECLARE');
    console.log('  admin_token_id INTEGER;');
    console.log('  new_source_id INTEGER;');
    console.log('BEGIN');
    console.log('  SELECT id INTO admin_token_id FROM user_tokens WHERE is_admin = true LIMIT 1;\n');
    
    for (const result of successResults) {
      const region = /[а-яА-ЯёЁ]/.test(result.name) ? 'russia' : 'world';
      console.log(`  -- ${result.handle} - ${result.name}`);
      console.log(`  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)`);
      console.log(`  VALUES (`);
      console.log(`    '${result.name.replace(/'/g, "''")}',`);
      console.log(`    'https://youtube.com/${result.handle}',`);
      console.log(`    'https://www.youtube.com/feeds/videos.xml?channel_id=${result.channelId}',`);
      console.log(`    '${region}',`);
      console.log(`    'other',`);
      console.log(`    'youtube',`);
      console.log(`    true,`);
      console.log(`    true,`);
      console.log(`    '${result.channelId}'`);
      console.log(`  )`);
      console.log(`  RETURNING id INTO new_source_id;`);
      console.log(`  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);\n`);
    }
    
    console.log(`  RAISE NOTICE 'Successfully added ${successResults.length} private YouTube channels for admin';`);
    console.log('END $$;');
  }
  
  // Статистика
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
