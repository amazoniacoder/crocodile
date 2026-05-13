-- Скрипт добавления приватных YouTube-каналов для админа
-- Выполнить в pgAdmin или psql

-- 1. Получить ID админского токена
DO $$
DECLARE
  admin_token_id INTEGER;
  new_source_id INTEGER;
BEGIN
  -- Найти админский токен
  SELECT id INTO admin_token_id FROM user_tokens WHERE is_admin = true LIMIT 1;
  
  IF admin_token_id IS NULL THEN
    RAISE EXCEPTION 'Admin token not found. Run migration 0032 first.';
  END IF;
  
  RAISE NOTICE 'Admin token ID: %', admin_token_id;
  
  -- 2. Добавить YouTube-каналы как приватные источники
  
  -- @ivansbobrovs2751 - Ivans Bobrovs 2
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Ivans Bobrovs 2',
    'https://youtube.com/@ivansbobrovs2751',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCivansbobrovs2751',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCivansbobrovs2751'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @cameronmye - Cameron
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Cameron',
    'https://youtube.com/@cameronmye',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCcameronmye',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCcameronmye'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @JonatheDropped - Jona the Dropped
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Jona the Dropped',
    'https://youtube.com/@JonatheDropped',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCJonatheDropped',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCJonatheDropped'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @ИринаПелихова - Новости грядущего от Ирины Пелиховой
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Новости грядущего от Ирины Пелиховой',
    'https://youtube.com/@ИринаПелихова',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCИринаПелихова',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCИринаПелихова'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @justus.pianist - Justus Eichhorn
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Justus Eichhorn',
    'https://youtube.com/@justus.pianist',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCjustuspianist',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCjustuspianist'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @Миша_может - Миша может
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Миша может',
    'https://youtube.com/@Миша_может',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCМиша_может',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCМиша_может'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @antik_ruins - @antik_ruins
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    '@antik_ruins',
    'https://youtube.com/@antik_ruins',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCantik_ruins',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCantik_ruins'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @astralionica - Astralionica
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Astralionica',
    'https://youtube.com/@astralionica',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCastralionica',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCastralionica'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @p.ivanov - Павел Иванов
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Павел Иванов',
    'https://youtube.com/@p.ivanov',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCpivanov',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCpivanov'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @guitarhit - Хиты на гитаре
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Хиты на гитаре',
    'https://youtube.com/@guitarhit',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCguitarhit',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCguitarhit'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @ЖизньвстранеТроллей - Жизнь в стране Троллей
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Жизнь в стране Троллей',
    'https://youtube.com/@ЖизньвстранеТроллей',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCЖизньвстранеТроллей',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCЖизньвстранеТроллей'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @ivanzarevich16 - Иван Царевич
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Иван Царевич',
    'https://youtube.com/@ivanzarevich16',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCivanzarevich16',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCivanzarevich16'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @edemdalshe1 - Едем Дальше
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Едем Дальше',
    'https://youtube.com/@edemdalshe1',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCedemdalshe1',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCedemdalshe1'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @GoodSimpleLiving - Good Simple Living
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Good Simple Living',
    'https://youtube.com/@GoodSimpleLiving',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCGoodSimpleLiving',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCGoodSimpleLiving'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @truebloodtheband - Trueblood
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Trueblood',
    'https://youtube.com/@truebloodtheband',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCtruebloodtheband',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCtruebloodtheband'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @jonnajinton - Jonna Jinton
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Jonna Jinton',
    'https://youtube.com/@jonnajinton',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCjonnajinton',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCjonnajinton'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @ХвойныйКрай - Хвойный Край
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Хвойный Край',
    'https://youtube.com/@ХвойныйКрай',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCХвойныйКрай',
    'russia',
    'other',
    'youtube',
    true,
    true,
    'UCХвойныйКрай'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @dublincitytoday - Dublin City Today
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Dublin City Today',
    'https://youtube.com/@dublincitytoday',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCdublincitytoday',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCdublincitytoday'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @garysen-m6s - Guitar B28
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'Guitar B28',
    'https://youtube.com/@garysen-m6s',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCgarysenm6s',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCgarysenm6s'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  -- @t-guitar - TGuitar
  INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_private, channel_id)
  VALUES (
    'TGuitar',
    'https://youtube.com/@t-guitar',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCtguitar',
    'world',
    'other',
    'youtube',
    true,
    true,
    'UCtguitar'
  )
  RETURNING id INTO new_source_id;
  INSERT INTO admin_channel_access (token_id, source_id) VALUES (admin_token_id, new_source_id);
  
  RAISE NOTICE 'Successfully added 20 private YouTube channels for admin';
END $$;

-- Проверка результата
SELECT 
  ns.id,
  ns.name,
  ns.channel_id,
  ns.is_private,
  aca.token_id
FROM news_sources ns
LEFT JOIN admin_channel_access aca ON ns.id = aca.source_id
WHERE ns.is_private = true AND ns.source_type = 'youtube'
ORDER BY ns.id DESC
LIMIT 20;
