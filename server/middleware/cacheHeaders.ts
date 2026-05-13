import { Request, Response, NextFunction } from 'express';

interface CacheHeaderOptions {
  maxAge?: number;
  sMaxAge?: number;
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  etag?: boolean;
}

export const setCacheHeaders = (options: CacheHeaderOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const cacheControl: string[] = [];

    if (options.public) cacheControl.push('public');
    if (options.private) cacheControl.push('private');
    if (options.noCache) cacheControl.push('no-cache');
    if (options.noStore) cacheControl.push('no-store');
    if (options.mustRevalidate) cacheControl.push('must-revalidate');
    if (options.maxAge !== undefined) cacheControl.push(`max-age=${options.maxAge}`);
    if (options.sMaxAge !== undefined) cacheControl.push(`s-maxage=${options.sMaxAge}`);

    if (cacheControl.length > 0) {
      res.set('Cache-Control', cacheControl.join(', '));
    }

    if (options.etag) {
      const originalSend = res.json;
      res.json = function(data: any) {
        const etag = `"${Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16)}"`;
        res.set('ETag', etag);
        
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        
        return originalSend.call(this, data);
      };
    }

    next();
  };
};

export const staticAssetCache = setCacheHeaders({
  public: true,
  maxAge: 31536000, // 1 year
  mustRevalidate: true
});

export const apiCache = setCacheHeaders({
  public: true,
  maxAge: 300, // 5 minutes
  etag: true
});

/** Для админки, чувствительных ответов и дефолта на всё под /api через routes.ts */
export const noCache = setCacheHeaders({
  noCache: true,
  noStore: true,
  mustRevalidate: true
});