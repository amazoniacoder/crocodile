# Примеры кода для Эпизода 7: "Безопасность enterprise-уровня"

> Все примеры взяты из реального кода проекта

---

## 🛡️ enhancedSecurity.ts — helmet + дополнительные заголовки

```typescript
// server/middleware/enhancedSecurity.ts
import helmet from 'helmet';

// Слой 1: helmet — основные заголовки безопасности
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
        "https://mc.yandex.ru",
        "https://www.googletagmanager.com",
      ],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"], // http: для RSS
      connectSrc: ["'self'", "ws:", "wss:", "https://mc.yandex.ru"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  hidePoweredBy: true,
});

// Слой 2: Permissions-Policy + Cross-Origin политики
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', [
    'camera=()', 'microphone=()', 'geolocation=()',
    'payment=()', 'usb=()', 'magnetometer=()',
    'gyroscope=()', 'accelerometer=()',
    'autoplay=(self)', 'fullscreen=(self)',
  ].join(', '));

  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  next();
};

// Слой 3: строгий CSP для API + no-cache для admin
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  if (req.path.includes('/admin/') || req.path.includes('/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
};

// Итоговый стек
export const comprehensiveSecurityMiddleware = [
  securityHeadersMiddleware,
  additionalSecurityHeaders,
  corsSecurityMiddleware,
];
```

---

## 🔥 ddosProtection.ts — поведенческий анализ

```typescript
// server/middleware/ddosProtection.ts

export class DdosProtection {
  private suspiciousIPs = new Map<string, IPStats>();
  private whitelist = new Set<string>();
  private blacklist = new Set<string>();

  private readonly SUSPICIOUS_THRESHOLD = 100;
  private readonly BLOCK_DURATION_MINUTES = 60;
  private readonly MAX_BLOCK_DURATION_HOURS = 24;

  // Основной middleware
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);

      if (this.whitelist.has(clientIP)) return next();

      if (await this.isBlacklisted(clientIP)) {
        return this.blockRequest(res, 'IP blacklisted', clientIP);
      }

      const ipStats = await this.getIPStats(clientIP);
      if (ipStats.blockedUntil && new Date() < ipStats.blockedUntil) {
        const remaining = Math.ceil((ipStats.blockedUntil.getTime() - Date.now()) / 60000);
        return this.blockRequest(res, `Temporarily blocked (${remaining}m remaining)`, clientIP);
      }

      const suspiciousScore = await this.analyzeSuspiciousActivity(req, ipStats);
      await this.updateIPStats(clientIP, req, suspiciousScore);

      if (suspiciousScore > this.SUSPICIOUS_THRESHOLD) {
        await this.blockIP(clientIP, suspiciousScore);
        return this.blockRequest(res, 'Suspicious activity detected', clientIP);
      }

      next();
    };
  }

  // Пять паттернов подозрительности
  private async analyzeSuspiciousActivity(req: Request, ipStats: IPStats): Promise<number> {
    let suspiciousScore = 0;

    if (ipStats.requestCount > 100) {
      suspiciousScore += 30; // high_frequency
    }
    if (ipStats.errorCount > 20) {
      suspiciousScore += 25; // high_errors
    }
    if (this.isSuspiciousUserAgent(req.get('User-Agent') || '')) {
      suspiciousScore += 20; // suspicious_ua
    }
    if (this.isScanningBehavior(req.path)) {
      suspiciousScore += 15; // scanning
    }
    if (await this.isRapidSequentialAccess(this.getClientIP(req))) {
      suspiciousScore += 20; // rapid_sequential
    }

    return suspiciousScore;
  }

  // Redis: счётчик быстрых запросов (10 сек окно)
  private async isRapidSequentialAccess(ip: string): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;
    const key = `ddos:rapid:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 10);
    return count > 20;
  }

  // Блокировка с Redis persistence
  private async blockIP(ip: string, score: number): Promise<void> {
    const blockDuration = Math.min(
      this.BLOCK_DURATION_MINUTES * Math.floor(score / 50),
      this.MAX_BLOCK_DURATION_HOURS * 60
    );
    const blockedUntil = new Date();
    blockedUntil.setMinutes(blockedUntil.getMinutes() + blockDuration);

    const ipStats = await this.getIPStats(ip);
    ipStats.blockedUntil = blockedUntil;

    await redis.hSet(`ddos:ip:${ip}`, { ...ipStats, blockedUntil: blockedUntil.toISOString() });
    await redis.expire(`ddos:ip:${ip}`, 24 * 60 * 60);
  }

  // Три тира rate limiting
  createRateLimiter(tier: 'strict' | 'normal' | 'lenient' = 'normal') {
    const configs = {
      strict:  { windowMs: 15 * 60 * 1000, max: 50 },
      normal:  { windowMs: 15 * 60 * 1000, max: 1000 },
      lenient: { windowMs: 15 * 60 * 1000, max: 5000 },
    };
    return rateLimit({
      ...configs[tier],
      max: (req) => {
        if (this.whitelist.has(this.getClientIP(req))) return configs[tier].max * 10;
        if (req.path.startsWith('/api/admin')) return Math.floor(configs[tier].max * 0.1);
        return configs[tier].max;
      },
    });
  }
}

export const ddosProtection = new DdosProtection();
```

---

## 🧩 captcha/types/index.ts — типы

```typescript
// client/src/captcha/types/index.ts

export interface PuzzleData {
  id: string;
  puzzleImage: string;      // Base64 SVG
  pieces: PuzzlePiece[];    // 3 фигуры (1 правильная, 2 ложных)
  correctPieceId: string;
  missingArea: Rectangle;   // { x, y, width, height }
  sessionToken: string;
}

export interface ValidationRequest {
  puzzleId: string;
  pieceId: string;
  dropCoordinates: Point;   // координаты относительно canvas
  sessionToken: string;
}

export interface CaptchaResponse {
  success: boolean;
  token?: string;           // JWT при успехе
  error?: string;
}

export interface PuzzlePiece {
  id: string;
  image: string;            // Base64 SVG фигуры
  isCorrect: boolean;
  shape: ShapeData;         // { type: 'circle'|'triangle'|'rectangle' }
  originalPosition: Point;
}
```

---

## 🧩 PuzzleCanvas.tsx — drag&drop

```typescript
// client/src/captcha/components/PuzzleCanvas.tsx

export const PuzzleCanvas: React.FC<PuzzleCanvasProps> = ({ puzzleData, onPieceDrop }) => {
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<
    'idle' | 'validating' | 'success' | 'error'
  >('idle');

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPiece) return;

    // Координаты относительно canvas, не окна
    const rect = e.currentTarget.getBoundingClientRect();
    const coordinates: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setValidationState('validating');
    const result = await onPieceDrop(draggedPiece, coordinates);
    setValidationState(result ? 'success' : 'error');

    setTimeout(() => setValidationState('idle'), result ? 1500 : 2000);
  };

  return (
    <div className="puzzle-canvas">
      {/* Статус: validating / success / error */}
      {validationState !== 'idle' && (
        <div className={`puzzle-canvas__status puzzle-canvas__status--${validationState}`}>
          {validationState === 'success' && <><span>✓</span><span>Correct!</span></>}
          {validationState === 'error'   && <><span>✕</span><span>Try again</span></>}
        </div>
      )}

      {/* Изображение с пропуском + зона для drop */}
      <div className="puzzle-canvas__main"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <img src={puzzleData.puzzleImage} alt="Puzzle" draggable={false} />
      </div>

      {/* Три фигуры для перетаскивания */}
      <div className="puzzle-canvas__pieces">
        {puzzleData.pieces.map((piece) => (
          <PuzzlePiece key={piece.id} piece={piece}
            onDragStart={setDraggedPiece}
            onDragEnd={() => setDraggedPiece(null)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 🧩 useCaptcha.ts — generatePuzzle + validateSolution

```typescript
// client/src/captcha/hooks/useCaptcha.ts

export const useCaptcha = () => {
  const [currentPuzzle, setCurrentPuzzle] = useState<PuzzleData | null>(null);

  const generatePuzzle = useCallback(async (): Promise<PuzzleData> => {
    const puzzleVariant = Math.floor(Math.random() * 3); // 0|1|2
    const pieces = generateMockPieces(puzzleVariant);    // 3 фигуры
    const correctPiece = pieces.find(p => p.isCorrect);

    const puzzleData: PuzzleData = {
      id: `puzzle_${Date.now()}`,
      puzzleImage: generateMockPuzzleImage(puzzleVariant), // SVG с пропуском
      pieces,                                               // перемешаны
      correctPieceId: correctPiece?.id || 'piece_1',
      missingArea: generateMissingArea(puzzleVariant),
      sessionToken: `session_${Date.now()}`,
    };

    setCurrentPuzzle(puzzleData);
    return puzzleData;
  }, []);

  const validateSolution = useCallback(async (request: ValidationRequest): Promise<CaptchaResponse> => {
    const correctPiece = currentPuzzle?.pieces.find(p => p.isCorrect);
    const missingArea = currentPuzzle?.missingArea || { x: 75, y: 50, width: 50, height: 40 };

    // Два условия: правильная фигура + попадание в зону
    const isCorrectPiece = request.pieceId === correctPiece?.id;
    const isInCorrectArea =
      request.dropCoordinates.x >= missingArea.x &&
      request.dropCoordinates.x <= missingArea.x + missingArea.width &&
      request.dropCoordinates.y >= missingArea.y &&
      request.dropCoordinates.y <= missingArea.y + missingArea.height;

    const success = isCorrectPiece && isInCorrectArea;

    return {
      success,
      token: success ? `captcha_token_${Date.now()}` : undefined,
      error: success ? undefined : 'Incorrect piece placement',
    };
  }, [currentPuzzle]);

  return { generatePuzzle, validateSolution };
};
```

---

## 🚨 AlertManager.ts — 17 правил (ключевые)

```typescript
// server/infrastructure/monitoring/AlertManager.ts

// SSL мониторинг — прямое TLS-соединение
private async checkSSLCertificate(domain: string) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: domain, port: 443,
      rejectUnauthorized: false, timeout: 5000
    }, (res) => {
      const cert = res.socket.getPeerCertificate();
      const daysUntilExpiry = Math.ceil(
        (new Date(cert.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      resolve({ daysUntilExpiry, domain: cert.subject?.CN, issuer: cert.issuer?.CN });
    });
    req.end();
  });
}

// Fail2Ban метрики через execSync
// fail2banRunning: systemctl is-active fail2ban
// fail2banActiveJails: fail2ban-client status → Jail list
// fail2banBansLast24h: journalctl | grep "Ban " | wc -l

// Правила безопасности (из 17):
{
  id: 'ssl-certificate-expiring',
  condition: (m) => m.sslExpiryDays !== undefined && m.sslExpiryDays <= 30,
  severity: 'warning',
  cooldownMinutes: 1440, // 24 часа — не спамим
},
{
  id: 'ssl-certificate-critical',
  condition: (m) => m.sslExpiryDays !== undefined && m.sslExpiryDays <= 7,
  severity: 'critical',
  cooldownMinutes: 360,  // 6 часов
},
{
  id: 'fail2ban-service-down',
  condition: (m) => m.fail2banRunning === false,
  severity: 'critical',
  cooldownMinutes: 30,
  channels: [
    { type: 'websocket', enabled: true },
    { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL },
    { type: 'log', enabled: true },
  ],
},
{
  id: 'disk-space-critical',
  condition: (m) => m.diskUsagePercent !== undefined && m.diskUsagePercent > 90,
  severity: 'critical',
  cooldownMinutes: 30,
},

// Redis persistence
await redis.hSet(`alert:${alert.id}`, { ...alertData });
await redis.expire(`alert:${alert.id}`, 7 * 24 * 60 * 60); // 7 дней
await redis.lPush('alerts:history', alert.id);
await redis.lTrim('alerts:history', 0, 999); // последние 1000
```

---

## 🚫 setup-fail2ban.sh — ключевые конфигурации

```bash
# /etc/fail2ban/jail.local — основные настройки

[DEFAULT]
bantime  = 3600    # 1 час
findtime = 600     # 10 мин окно
maxretry = 5
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

[sshd]
enabled  = true
maxretry = 3
bantime  = 7200    # 2 часа для SSH

[nginx-admin-auth]
enabled  = true
filter   = nginx-admin-auth
logpath  = /var/log/nginx/access.log
maxretry = 3
bantime  = 3600
findtime = 300     # 5 мин окно

[nginx-badbots]
enabled  = true
maxretry = 2
bantime  = 86400   # 24 часа для ботов

# /etc/fail2ban/filter.d/nginx-admin-auth.conf
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 401
            ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 403

# Cloudflare action — бан на уровне CDN
actionban = curl -X POST "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules" \
            -H "X-Auth-Email: <cfuser>" \
            -H "X-Auth-Key: <cftoken>" \
            --data '{"mode":"block","configuration":{"target":"ip","value":"<ip>"},"notes":"Blocked by Fail2Ban"}'
```

---

*Все примеры соответствуют реальному production-коду проекта.*
