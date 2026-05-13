-- Синхронизация денормализованных счётчиков с реальными данными в article_reactions

UPDATE news_articles a
SET
  likes_count    = (SELECT COUNT(*) FROM article_reactions WHERE article_id = a.id AND type = 'like'),
  dislikes_count = (SELECT COUNT(*) FROM article_reactions WHERE article_id = a.id AND type = 'dislike');
