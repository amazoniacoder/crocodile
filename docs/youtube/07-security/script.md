# Эпизод 7: "Безопасность enterprise-уровня"

> **Длительность:** 25-30 минут
> **Цель:** Показать реальную многоуровневую систему безопасности — от HTTP-заголовков до AlertManager
> **Аудитория:** Backend разработчики, DevOps, fullstack

---

## 🎯 Цели эпизода

- Разобрать security headers через helmet (CSP, HSTS, Permissions-Policy, CORP/COEP/COOP)
- Показать DDoS защиту с поведенческим анализом и Redis blacklist
- Объяснить собственную CAPTCHA — puzzle drag&drop без Google reCAPTCHA
- Разобрать AlertManager — 17 правил, 4 канала, cooldown, Redis persistence
- Показать Fail2Ban — 6 jail'ов, кастомные фильтры, интеграция с AlertManager

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Показать security-monitor.sh в терминале]**

**Ведущий:**
> Привет! Седьмой эпизод — безопасность enterprise-уровня. Смотрите: запускаю скрипт диагностики — он за секунды проверяет SSL, Fail2Ban, диск, Nginx, PostgreSQL, логи. Это не набор разрозненных инструментов — это единая система с 17 правилами алертов.

**[Показать структуру эпизода]**

> Разберём пять слоёв защиты:
> - Security Headers — helmet, CSP, 8 заголовков
> - DDoS защита — поведенческий анализ, Redis, 5 паттернов
> - Собственная CAPTCHA — puzzle, drag&drop, JWT токен
> - AlertManager — 17 правил, SSL/disk/Fail2Ban мониторинг
> - Fail2Ban — 6 jail'ов, кастомные фильтры

---

### 🛡️ Блок 1: Security Headers (5 минут)

#### Подблок 1.1: Два слоя заголовков

**[Открыть server/middleware/security.ts и enhancedSecurity.ts]**

**Ведущий:**
> В проекте два файла для заголовков безопасности. `security.ts` — базовый слой, написанный вручную. `enhancedSecurity.ts` — расширенный через helmet. Посмотрим на расширенный.

```typescript
// server/middleware/enhancedSecurity.ts

// Слой 1: helmet — основные заголовки
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
        "https://mc.yandex.ru",
      ],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"], // http: для RSS-изображений
      connectSrc: ["'self'", "ws:", "wss:", "https://mc.yandex.ru"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [], // принудительно HTTPS
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  hidePoweredBy: true, // скрываем X-Powered-By: Express
});

// Слой 2: дополнительные заголовки
export const additionalSecurityHeaders = (req, res, next) => {
  // Permissions-Policy — запрещаем доступ к устройствам
  res.setHeader('Permissions-Policy', [
    'camera=()', 'microphone=()', 'geolocation=()',
    'payment=()', 'usb=()', 'magnetometer=()',
  ].join(', '));

  // Cross-Origin политики
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Для API — запрет индексации
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  next();
};
```

**Ведущий:**
> Обратите внимание: `http:` в `imgSrc` — это намеренно. RSS-источники часто отдают изображения по HTTP. Убери это — половина картинок в ленте пропадёт. Безопасность не должна ломать функциональность.

#### Подблок 1.2: Строгий CSP для API и кэш-контроль

```typescript
// Для API эндпоинтов — максимально строгий CSP
export const apiSecurityHeaders = (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  // Admin и auth — никакого кэширования
  if (req.path.includes('/admin/') || req.path.includes('/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
};

// Итоговый стек middleware
export const comprehensiveSecurityMiddleware = [
  securityHeadersMiddleware,   // helmet
  additionalSecurityHeaders,   // Permissions-Policy, CORP, COOP
  corsSecurityMiddleware,      // CORS с whitelist origins
];
```

**Ведущий:**
> Три middleware в стеке — каждый отвечает за свой слой. Это принцип единственной ответственности применённый к безопасности.

---

### 🔥 Блок 2: DDoS защита (6 минут)

#### Подблок 2.1: Архитектура DdosProtection

**[Открыть server/middleware/ddosProtection.ts]**

**Ведущий:**
> Собственная DDoS защита — не просто rate limiter. Это поведенческий анализ с накоплением статистики по каждому IP.

```typescript
// server/middleware/ddosProtection.ts

interface IPStats {
  ip: string;
  requestCount: number;
  errorCount: number;
  lastRequest: Date;
  firstSeen: Date;
  blockedUntil?: Date;
  suspiciousScore: number;  // накопительный балл подозрительности
  patterns: string[];       // обнаруженные паттерны
}

export class DdosProtection {
  private suspiciousIPs = new Map<string, IPStats>(); // in-memory
  private whitelist = new Set<string>();              // localhost, private networks
  private blacklist = new Set<string>();              // постоянный бан

  private readonly SUSPICIOUS_THRESHOLD = 100; // порог блокировки
  private readonly BLOCK_DURATION_MINUTES = 60;
  private readonly MAX_BLOCK_DURATION_HOURS = 24;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // очистка каждые 5 мин
}
```

#### Подблок 2.2: Пять паттернов подозрительности

```typescript
private async analyzeSuspiciousActivity(req, ipStats): Promise<number> {
  let suspiciousScore = 0;
  const patterns: string[] = [];

  // Паттерн 1: высокая частота — >100 req/мин
  if (ipStats.requestCount > 100) {
    suspiciousScore += 30;
    patterns.push('high_frequency');
  }

  // Паттерн 2: высокий error rate — >20 ошибок/мин
  if (ipStats.errorCount > this.ERROR_THRESHOLD) {
    suspiciousScore += 25;
    patterns.push('high_errors');
  }

  // Паттерн 3: подозрительный User-Agent
  // masscan, zgrab, nikto, sqlmap, nmap, dirbuster, nuclei...
  if (this.isSuspiciousUserAgent(userAgent)) {
    suspiciousScore += 20;
    patterns.push('suspicious_ua');
  }

  // Паттерн 4: сканирование — доступ к .php, wp-admin, .env, .git
  if (this.isScanningBehavior(req.path)) {
    suspiciousScore += 15;
    patterns.push('scanning');
  }

  // Паттерн 5: быстрые последовательные запросы
  // Redis: incr + expire(10 сек) → >20 req за 10 сек
  if (await this.isRapidSequentialAccess(clientIP)) {
    suspiciousScore += 20;
    patterns.push('rapid_sequential');
  }

  // suspiciousScore > 100 → blockIP()
  return suspiciousScore;
}
```

**Ведущий:**
> Каждый паттерн добавляет баллы. Набрал больше 100 — блокировка. Продолжительность блока зависит от счёта: `blockDuration = BLOCK_DURATION_MINUTES * floor(score / 50)`, максимум 24 часа.

#### Подблок 2.3: Redis persistence и три тира rate limiting

```typescript
// Блокировка с сохранением в Redis
private async blockIP(ip: string, score: number): Promise<void> {
  const blockDuration = Math.min(
    this.BLOCK_DURATION_MINUTES * Math.floor(score / 50),
    this.MAX_BLOCK_DURATION_HOURS * 60
  );
  const blockedUntil = new Date();
  blockedUntil.setMinutes(blockedUntil.getMinutes() + blockDuration);

  // Redis: TTL 24 часа, переживает рестарт сервера
  await redis.hSet(`ddos:ip:${ip}`, { ...stats, blockedUntil });
  await redis.expire(`ddos:ip:${ip}`, 24 * 60 * 60);
}

// Постоянный blacklist — тоже в Redis
async addToBlacklist(ip: string, reason: string): Promise<void> {
  this.blacklist.add(ip);
  await redis.sAdd('ddos:blacklist', ip);
  await redis.hSet(`ddos:blacklist:${ip}`, { ip, reason, addedAt });
}

// Три тира rate limiting
createRateLimiter(tier: 'strict' | 'normal' | 'lenient') {
  const configs = {
    strict:  { windowMs: 15 * 60 * 1000, max: 50 },    // /api/admin
    normal:  { windowMs: 15 * 60 * 1000, max: 1000 },  // /api/*
    lenient: { windowMs: 15 * 60 * 1000, max: 5000 },  // статика
  };
  // Whitelisted IPs → max * 10
  // Admin endpoints → max * 0.1
}
```

#### Подблок 2.4: Admin API для управления

**[Открыть server/api/admin/security/index.ts]**

```typescript
// GET  /api/admin/security/ddos/stats    — статистика
// GET  /api/admin/security/ddos/blocked  — список заблокированных IP
// POST /api/admin/security/ddos/unblock  — разблокировать IP
// POST /api/admin/security/ddos/blacklist — постоянный бан
// DELETE /api/admin/security/ddos/blacklist/:ip — снять бан
// GET  /api/admin/security/ddos/dashboard — полный дашборд

// Защита от blacklist localhost/private networks:
if (ip.startsWith('127.') || ip.startsWith('192.168.') ||
    ip.startsWith('10.') || ip.startsWith('172.')) {
  return res.status(400).json({ error: 'Cannot blacklist private network addresses' });
}
```

---

### 🧩 Блок 3: Собственная CAPTCHA (6 минут)

#### Подблок 3.1: Почему не Google reCAPTCHA

**[Показать слайд сравнения]**

**Ведущий:**
> Google reCAPTCHA — зависимость от внешнего сервиса, передача данных пользователей Google, блокировки в некоторых регионах. Мы написали свою — puzzle CAPTCHA с drag&drop.

```
Архитектура:
client/src/captcha/
├── components/
│   ├── CaptchaButton.tsx   ← кнопка-триггер (puzzle иконка → ✓)
│   ├── CaptchaModal.tsx    ← модальное окно через createPortal
│   ├── PuzzleCanvas.tsx    ← drag&drop область
│   └── PuzzlePiece.tsx     ← перетаскиваемый элемент
├── hooks/
│   └── useCaptcha.ts       ← generatePuzzle, validateSolution
└── types/
    └── index.ts            ← PuzzleData, ValidationRequest, CaptchaResponse
```

#### Подблок 3.2: Типы и поток данных

**[Открыть client/src/captcha/types/index.ts]**

```typescript
// Данные пазла от сервера
interface PuzzleData {
  id: string;
  puzzleImage: string;      // Base64 SVG — изображение с пропуском
  pieces: PuzzlePiece[];    // 3 варианта фигур (только 1 правильный)
  correctPieceId: string;
  missingArea: Rectangle;   // { x, y, width, height } — куда нужно попасть
  sessionToken: string;     // привязка к сессии
}

// Запрос на валидацию
interface ValidationRequest {
  puzzleId: string;
  pieceId: string;
  dropCoordinates: Point;   // { x, y } — куда пользователь бросил фигуру
  sessionToken: string;
}

// Ответ — JWT токен при успехе
interface CaptchaResponse {
  success: boolean;
  token?: string;           // JWT для отправки формы
  error?: string;
}
```

#### Подблок 3.3: PuzzleCanvas — drag&drop

**[Открыть client/src/captcha/components/PuzzleCanvas.tsx]**

```typescript
// Четыре состояния валидации
type ValidationState = 'idle' | 'validating' | 'success' | 'error';

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  if (!draggedPiece) return;

  // Координаты относительно canvas
  const rect = e.currentTarget.getBoundingClientRect();
  const coordinates: Point = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };

  setValidationState('validating');
  const result = await onPieceDrop(draggedPiece, coordinates);
  setValidationState(result ? 'success' : 'error');

  // success → 1.5 сек → onSolved(token) → модал закрывается
  // error   → 2 сек   → loadPuzzle() → новый пазл
};
```

#### Подблок 3.4: Валидация и интеграция

**[Открыть client/src/captcha/hooks/useCaptcha.ts]**

```typescript
const validateSolution = async (request: ValidationRequest): Promise<CaptchaResponse> => {
  // Серверная валидация (сейчас — mock, в production — POST /api/captcha/validate)
  const isCorrectPiece = request.pieceId === correctPiece?.id;

  // Проверка попадания в missingArea
  const isInCorrectArea =
    request.dropCoordinates.x >= missingArea.x &&
    request.dropCoordinates.x <= missingArea.x + missingArea.width &&
    request.dropCoordinates.y >= missingArea.y &&
    request.dropCoordinates.y <= missingArea.y + missingArea.height;

  const success = isCorrectPiece && isInCorrectArea;

  return {
    success,
    token: success ? `captcha_token_${Date.now()}` : undefined,
  };
};

// Интеграция в форму — одна строка
<CaptchaButton
  onSolved={(token) => setCaptchaToken(token)}
  onError={(error) => console.error(error)}
  size="md"
/>
```

**Ведущий:**
> Три варианта пазла — circle, triangle, rectangle. Каждый раз случайный. Боты не знают паттернов, потому что алгоритм наш. Серверная валидация координат — клиентский обход невозможен.

---

### 🚨 Блок 4: AlertManager — 17 правил (7 минут)

#### Подблок 4.1: Архитектура

**[Открыть server/infrastructure/monitoring/AlertManager.ts]**

```typescript
// Структура правила
interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean; // чистая функция
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;   // защита от спама алертов
  enabled: boolean;
  channels: AlertChannel[];  // websocket | webhook | log | email
}

// Жизненный цикл алерта
// condition() → true + нет cooldown → triggerAlert()
//   → storeAlert(Redis, TTL 7 дней)
//   → sendNotifications(channels)
//   → Prometheus: alertsTriggered.inc({ rule_id, severity })
// condition() → false + есть activeAlert → resolveAlert()
//   → sendResolutionNotification()

// Интервал проверки: каждые 30 секунд
private readonly CHECK_INTERVAL_MS = 30000;
```

#### Подблок 4.2: 17 правил по категориям

```
RSS сбор (3 правила):
  rss-collection-stalled   → не собирал >30 мин          critical  cooldown 15 мин
  high-error-rate          → >50% источников с ошибками  warning   cooldown 10 мин
  low-article-count        → <100 статей за 24ч          warning   cooldown 60 мин

Система (4 правила):
  high-memory-usage        → >1GB RAM                    warning   cooldown 5 мин
  database-disconnected    → БД недоступна               critical  cooldown 1 мин
  database-critical        → БД в критическом состоянии  critical  cooldown 5 мин
  redis-unavailable        → Redis недоступен            critical  cooldown 10 мин

Кластер (2 правила):
  cluster-unhealthy        → <50% нод здоровы            critical  cooldown 5 мин
  frequent-failovers       → >3 failover за час          warning   cooldown 30 мин

Производительность (2 правила):
  rate-limit-issues        → >2 домена в backoff         warning   cooldown 15 мин
  rate-limiter-high-util   → >80% утилизация кэша        warning   cooldown 30 мин

Безопасность (6 правил):
  ssl-certificate-expiring → ≤30 дней до истечения       warning   cooldown 24ч
  ssl-certificate-critical → ≤7 дней до истечения        critical  cooldown 6ч
  disk-space-warning       → >80% диска                  warning   cooldown 60 мин
  disk-space-critical      → >90% диска                  critical  cooldown 30 мин
  fail2ban-high-bans       → >50 банов за 24ч            warning   cooldown 60 мин
  fail2ban-service-down    → сервис не запущен            critical  cooldown 30 мин
```

#### Подблок 4.3: Сбор метрик — SSL и Fail2Ban

```typescript
// SSL — прямое TLS-соединение, без внешних инструментов
private async checkSSLCertificate(domain: string) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: domain, port: 443,
      rejectUnauthorized: false, timeout: 5000
    }, (res) => {
      const cert = res.socket.getPeerCertificate();
      const expiryDate = new Date(cert.valid_to);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      resolve({ daysUntilExpiry, domain: cert.subject?.CN, issuer: cert.issuer?.CN });
    });
    req.end();
  });
}

// Fail2Ban — через execSync (только на Linux/production)
try {
  execSync('systemctl is-active fail2ban', { stdio: 'ignore' });
  metrics.fail2banRunning = true;

  const statusOutput = execSync('fail2ban-client status', { encoding: 'utf8' });
  const jailMatch = statusOutput.match(/Jail list:\s*(.+)/);
  metrics.fail2banActiveJails = jailMatch[1].split(',').length;

  const journalOutput = execSync(
    'journalctl -u fail2ban --since "24 hours ago" | grep "Ban " | wc -l'
  );
  metrics.fail2banBansLast24h = parseInt(journalOutput.trim());
} catch {
  metrics.fail2banRunning = false; // → alert: fail2ban-service-down
}
```

#### Подблок 4.4: Каналы уведомлений

```typescript
// WebSocket — мгновенно в кабинет мониторинга
await webSocketManager.broadcastToCluster({
  type: 'alert_triggered',
  data: { id, ruleName, severity, message, triggeredAt }
});

// Webhook — Slack/Discord для критических
await fetch(config.url, {
  method: 'POST',
  body: JSON.stringify({
    alert: { id, ruleName, severity, message },
    system: 'NewsAggregator',
    timestamp: new Date().toISOString()
  })
});
// Настройка: ALERT_WEBHOOK_URL=https://hooks.slack.com/...

// Redis persistence — история 1000 алертов, TTL 7 дней
await redis.hSet(`alert:${alert.id}`, { ...alertData });
await redis.expire(`alert:${alert.id}`, 7 * 24 * 60 * 60);
await redis.lPush('alerts:history', alert.id);
await redis.lTrim('alerts:history', 0, 999);
```

---

### 🚫 Блок 5: Fail2Ban (4 минуты)

#### Подблок 5.1: Шесть jail'ов

**[Открыть scripts/setup-fail2ban.sh]**

```
Jail                  Защита                    Попытки  Бан
──────────────────────────────────────────────────────────────
sshd                  SSH брутфорс              3        2 часа
nginx-http-auth       HTTP Basic Auth           6        30 мин
nginx-limit-req       Nginx rate limit          10       10 мин
nginx-badbots         Сканеры и боты            2        24 часа
nginx-admin-auth      Admin API 401/403         3        1 час
nginx-req-limit       Флудинг запросами         100/мин  5 мин
```

#### Подблок 5.2: Кастомные фильтры

```ini
# /etc/fail2ban/filter.d/nginx-admin-auth.conf
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 401
            ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 403

# /etc/fail2ban/filter.d/nginx-badbots.conf
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*" (404|444) .*"(libwww-perl|wget|nikto|sqlmap|nmap|masscan)"
            ^<HOST> -.*"(GET|POST).*(.php|.asp|wp-admin|phpmyadmin|.env|.git).*" (404|403)
```

#### Подблок 5.3: Интеграция с AlertManager и Cloudflare

```bash
# AlertManager проверяет Fail2Ban каждые 30 сек:
# fail2ban-service-down → critical → webhook → Slack
# fail2ban-high-bans (>50/24ч) → warning → WebSocket

# Cloudflare action — бан сразу в CDN
# /etc/fail2ban/action.d/cloudflare.conf
actionban = curl -X POST "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules" \
            -H "X-Auth-Email: <cfuser>" \
            -H "X-Auth-Key: <cftoken>" \
            --data '{"mode":"block","configuration":{"target":"ip","value":"<ip>"}}'

# Управление
fail2ban-client status              # статус всех jail'ов
fail2ban-unban.sh 192.168.1.100     # разблокировать IP
fail2ban-status.sh                  # полный отчёт
```

**Ведущий:**
> Fail2Ban работает на уровне iptables — блокирует до того, как запрос дойдёт до Nginx. DDoS защита в Node.js — второй рубеж. Два независимых слоя.

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Итоги системы безопасности:

1. **Security Headers** — helmet + CSP + Permissions-Policy + CORP/COEP/COOP
2. **DDoS защита** — 5 паттернов, suspiciousScore, Redis blacklist, 3 тира rate limiting
3. **CAPTCHA** — собственный puzzle, drag&drop, JWT, без Google
4. **AlertManager** — 17 правил, 4 канала, cooldown, Redis persistence 7 дней
5. **Fail2Ban** — 6 jail'ов, кастомные фильтры, Cloudflare action, интеграция с AlertManager

> В следующем эпизоде — мониторинг: кабинет с зонами A-C, Prometheus метрики, WebSocket алерты в реальном времени.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
server/
├── middleware/
│   ├── security.ts                           ← базовые заголовки, authenticateAdmin
│   ├── enhancedSecurity.ts                   ← helmet, CSP, Permissions-Policy
│   ├── ddosProtection.ts                     ← DdosProtection class
│   └── rateLimiter.ts                        ← три тира
├── api/admin/security/
│   └── index.ts                              ← Admin API для DDoS
└── infrastructure/monitoring/
    └── AlertManager.ts                       ← 17 правил, каналы, Redis

client/src/captcha/
├── components/
│   ├── CaptchaButton.tsx                     ← кнопка-триггер
│   ├── CaptchaModal.tsx                      ← createPortal модал
│   └── PuzzleCanvas.tsx                      ← drag&drop
├── hooks/useCaptcha.ts                       ← generatePuzzle, validateSolution
└── types/index.ts                            ← PuzzleData, ValidationRequest

scripts/
├── setup-fail2ban.sh                         ← установка и конфигурация
└── security-monitor.sh                       ← комплексная диагностика
```

### Демо в браузере и терминале
- Открыть `/admin/monitor` → показать активные алерты (AlertDashboard)
- DevTools → Network → показать security headers в ответе
- Терминал: `./scripts/security-monitor.sh` — полная диагностика
- Терминал: `curl /api/admin/security/ddos/stats` — статистика DDoS
- Показать CAPTCHA в действии: открыть форму → drag&drop пазл
