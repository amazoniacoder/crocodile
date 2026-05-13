import { db } from '../../db/db';
import { userBookmarks, newsArticles, newsSources } from '../../../shared/types/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export class UserBookmarkRepository {
  async add(tokenId: number, articleId: number): Promise<void> {
    await db.insert(userBookmarks)
      .values({ tokenId, articleId })
      .onConflictDoNothing();
  }

  async remove(tokenId: number, articleId: number): Promise<void> {
    await db.delete(userBookmarks)
      .where(and(eq(userBookmarks.tokenId, tokenId), eq(userBookmarks.articleId, articleId)));
  }

  async findByTokenId(tokenId: number): Promise<number[]> {
    const rows = await db
      .select({ articleId: userBookmarks.articleId })
      .from(userBookmarks)
      .where(eq(userBookmarks.tokenId, tokenId))
      .orderBy(desc(userBookmarks.createdAt));
    return rows.map(r => r.articleId);
  }

  async findArticlesByTokenId(tokenId: number) {
    const rows = await db
      .select({
        id: newsArticles.id,
        title: newsArticles.title,
        url: newsArticles.url,
        publishedAt: newsArticles.publishedAt,
        imageUrl: newsArticles.imageUrl,
        sourceId: newsArticles.sourceId,
        sourceType: newsArticles.sourceType,
        sourceName: newsSources.name,
        sourceLogoUrl: newsSources.logoUrl,
        bookmarkedAt: userBookmarks.createdAt,
      })
      .from(userBookmarks)
      .innerJoin(newsArticles, eq(userBookmarks.articleId, newsArticles.id))
      .leftJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(eq(userBookmarks.tokenId, tokenId))
      .orderBy(desc(userBookmarks.createdAt));
    return rows;
  }

  async hasBookmark(tokenId: number, articleId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: userBookmarks.id })
      .from(userBookmarks)
      .where(and(eq(userBookmarks.tokenId, tokenId), eq(userBookmarks.articleId, articleId)))
      .limit(1);
    return !!row;
  }
}

export const userBookmarkRepository = new UserBookmarkRepository();
