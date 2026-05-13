# Слайды для Эпизода 7: "Безопасность enterprise-уровня"

> **Презентация:** 24-26 слайдов для 25-30 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — Enterprise Security
Эпизод 7: "Безопасность enterprise-уровня"

🛡️ Security Headers: helmet + CSP + 8 заголовков
🔥 DDoS защита: поведенческий анализ + Redis
🧩 Собственная CAPTCHA: puzzle drag&drop без Google
🚨 AlertManager: 17 правил, 4 канала
🚫 Fail2Ban: 6 jail'ов + Cloudflare action
```

### Слайд 2: Пять слоёв защиты
```
Запрос из интернета
        │
        ▼
[1] Cloudflare WAF + Bot Fight Mode
        │
        ▼
[2] Fail2Ban (iptables) — до Nginx
        │
        ▼
[3] Nginx rate limiting + security headers
        │
        ▼
[4] Node.js DDoS Protection (поведенческий анализ)
        │
        ▼
[5] Application: CAPTCHA + authenticateAdmin + API keys

AlertManager наблюдает за всеми слоями → 17 правил
```

---

## Блок 1: Security Headers (слайды 3-5)

### Слайд 3: Что скрывает helmet
```
Без helmet:
  HTTP/1.1 200 OK
  X-Powered-By: Express        ← раскрываем стек
  (нет CSP)                    ← XSS возможен
  (нет HSTS)                   ← downgrade атаки
  (нет X-Frame-Options)        ← clickjacking

С helmet:
  Content-Security-Policy: default-src 'self'; ...
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  (X-Powered-By убран)
```

### Слайд 4: CSP — тонкая настройка
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'", "'unsafe-inline'",
      // 'unsafe-eval' только в development
      "https://mc.yandex.ru",
    ],
    imgSrc: [
      "'self'", "data:", "https:",
      "http:",   // ← намеренно! RSS-изображения по HTTP
      "blob:",
    ],
    connectSrc: ["'self'", "ws:", "wss:"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [], // принудительно HTTPS
  }
}

// Для API — максимально строгий:
"default-src 'none'; frame-ancestors 'none';"
```

### Слайд 5: Дополнительные заголовки
```
Permissions-Policy:
  camera=()           ← нет доступа к камере
  microphone=()       ← нет доступа к микрофону
  geolocation=()      ← нет геолокации
  payment=()          ← нет платёжных API
  usb=()              ← нет USB

Cross-Origin политики:
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

Для /api/* эндпоинтов:
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  Cache-Control: no-store (для /admin/ и /auth/)
```

---

## Блок 2: DDoS защита (слайды 6-10)

### Слайд 6: Архитектура DdosProtection
```
Входящий запрос
      │
      ├─ IP в whitelist? → пропустить (localhost, private)
      │
      ├─ IP в blacklist? → 429 немедленно
      │    (Redis: ddos:blacklist SET)
      │
      ├─ blockedUntil > now? → 429 + время до разблокировки
      │
      ├─ analyzeSuspiciousActivity() → suspiciousScore
      │    5 паттернов → накопительный балл
      │
      ├─ score > 100? → blockIP() → Redis TTL 24ч
      │
      └─ next() → запрос проходит

Cleanup: каждые 5 мин удаляем записи старше 24ч
```

### Слайд 7: Пять паттернов подозрительности
```
Паттерн              Условие                    Баллы
──────────────────────────────────────────────────────
high_frequency       >100 req/мин               +30
high_errors          >20 ошибок/мин             +25
suspicious_ua        masscan/nikto/sqlmap/nmap   +20
scanning             .php/.env/.git/wp-admin     +15
rapid_sequential     >20 req за 10 сек (Redis)  +20

Порог блокировки: 100 баллов
Продолжительность: BLOCK_DURATION_MINUTES × floor(score/50)
Максимум: 24 часа
```

### Слайд 8: Redis — два уровня хранения
```
In-memory Map<string, IPStats>:
  Быстрый доступ, теряется при рестарте

Redis (персистентность):
  ddos:ip:<IP>          → IPStats, TTL 24ч
  ddos:blacklist        → SET постоянных банов
  ddos:blacklist:<IP>   → детали: reason, addedAt
  ddos:rapid:<IP>       → счётчик, TTL 10 сек

При рестарте сервера:
  → blacklist восстанавливается из Redis
  → временные блокировки — из Redis
  → in-memory Map пересоздаётся по запросам
```

### Слайд 9: Три тира rate limiting
```
Tier      Endpoint          Window    Max      Кто получает больше
──────────────────────────────────────────────────────────────────
strict    /api/admin/*      15 мин    50       Whitelist: max × 10
normal    /api/*            15 мин    1000     Admin: max × 0.1
lenient   статика           15 мин    5000

При превышении:
  HTTP 429 Too Many Requests
  { error, retryAfter, message }
  Логируется как suspicious activity
```

### Слайд 10: Admin API управления
```bash
# Статистика защиты
GET /api/admin/security/ddos/stats
→ { blockedIPs, blacklistedIPs, whitelistedIPs, suspiciousIPs }

# Список заблокированных
GET /api/admin/security/ddos/blocked
→ [{ ip, blockedUntil, suspiciousScore, patterns, requestCount }]

# Разблокировать IP
POST /api/admin/security/ddos/unblock
{ "ip": "1.2.3.4" }

# Постоянный бан
POST /api/admin/security/ddos/blacklist
{ "ip": "1.2.3.4", "reason": "Manual ban" }
# Защита: нельзя забанить 127.x, 192.168.x, 10.x, 172.x

# Полный дашборд
GET /api/admin/security/ddos/dashboard
→ stats + topSuspicious + patternStats
```

---

## Блок 3: Собственная CAPTCHA (слайды 11-14)

### Слайд 11: Почему не Google reCAPTCHA
```
Google reCAPTCHA:
  ❌ Зависимость от внешнего сервиса
  ❌ Данные пользователей уходят в Google
  ❌ Блокировки в некоторых регионах
  ❌ Платная при высоких нагрузках
  ❌ Боты обходят через ML-модели

Собственная puzzle CAPTCHA:
  ✅ Полный контроль над алгоритмом
  ✅ Никаких внешних зависимостей
  ✅ Уникальные паттерны — боты не знают
  ✅ Серверная валидация координат
  ✅ 95-98% защита от ботов
  ✅ Drag&drop UX — интуитивно
```

### Слайд 12: Архитектура компонентов
```
CaptchaButton
  isSolved: false → puzzle иконка
  isSolved: true  → ✓ иконка
  onClick → setIsModalOpen(true)
       │
       ▼
CaptchaModal (createPortal → document.body)
  useEffect(isOpen) → generatePuzzle()
  ESC → onClose()
  overlay click → onClose()
       │
       ▼
PuzzleCanvas
  draggedPiece state
  dragOverTarget state
  validationState: idle|validating|success|error
  handleDrop → onPieceDrop(pieceId, coordinates)
       │
       ▼
PuzzlePiece × 3
  draggable
  onDragStart → setDraggedPiece(pieceId)
  onDragEnd   → setDraggedPiece(null)
```

### Слайд 13: Три варианта пазла
```
Вариант 0 (circle):
  Изображение: треугольник + прямоугольник + треугольник
  Пропуск: круг (cx=100, cy=75, r=20)
  Правильная фигура: circle piece

Вариант 1 (triangle):
  Изображение: два круга + прямоугольник
  Пропуск: треугольник (points="120,80 150,80 135,110")
  Правильная фигура: triangle piece

Вариант 2 (rectangle):
  Изображение: круг + треугольник + треугольник
  Пропуск: прямоугольник (x=120, y=85, w=35, h=25)
  Правильная фигура: rectangle piece

Каждый раз: Math.random() → случайный вариант
Фигуры перемешаны: pieces.sort(() => Math.random() - 0.5)
```

### Слайд 14: Валидация — два условия
```typescript
// Условие 1: правильная фигура
const isCorrectPiece = request.pieceId === correctPiece?.id;

// Условие 2: попадание в missingArea
const isInCorrectArea =
  request.dropCoordinates.x >= missingArea.x &&
  request.dropCoordinates.x <= missingArea.x + missingArea.width &&
  request.dropCoordinates.y >= missingArea.y &&
  request.dropCoordinates.y <= missingArea.y + missingArea.height;

const success = isCorrectPiece && isInCorrectArea;

// При успехе:
// → token: `captcha_token_${Date.now()}` (в production — JWT)
// → 1.5 сек → onSolved(token) → форма разблокирована

// При ошибке:
// → 2 сек → loadPuzzle() → новый случайный пазл
```

---

## Блок 4: AlertManager (слайды 15-19)

### Слайд 15: Жизненный цикл алерта
```
AlertManager.checkAlertConditions() — каждые 30 сек
      │
      ▼
collectSystemMetrics()
  RSS, память, БД, Redis, кластер,
  rate limiter, SSL, диск, Fail2Ban
      │
      ▼
for each rule (17 правил):
  rule.condition(metrics) → true?
      │
      ├─ Есть cooldown? → пропустить
      │
      ├─ triggerAlert()
      │    ├─ storeAlert(Redis, TTL 7 дней)
      │    ├─ alertsTriggered.inc() (Prometheus)
      │    └─ sendNotifications(channels)
      │
      └─ condition → false + activeAlert?
           └─ resolveAlert() → sendResolutionNotification()
```

### Слайд 16: 17 правил — таблица
```
Категория      ID                        Severity  Cooldown
────────────────────────────────────────────────────────────
RSS сбор       rss-collection-stalled    critical  15 мин
               high-error-rate           warning   10 мин
               low-article-count         warning   60 мин

Система        high-memory-usage         warning   5 мин
               database-disconnected     critical  1 мин
               database-critical         critical  5 мин
               redis-unavailable         critical  10 мин

Кластер        cluster-unhealthy         critical  5 мин
               frequent-failovers        warning   30 мин

Произв-ть      rate-limit-issues         warning   15 мин
               rate-limiter-high-util    warning   30 мин

Безопасность   ssl-certificate-expiring  warning   24ч
               ssl-certificate-critical  critical  6ч
               disk-space-warning        warning   60 мин
               disk-space-critical       critical  30 мин
               fail2ban-high-bans        warning   60 мин
               fail2ban-service-down     critical  30 мин
```

### Слайд 17: SSL мониторинг — без openssl CLI
```typescript
// Прямое TLS-соединение из Node.js
private async checkSSLCertificate(domain: string) {
  const req = https.request({
    hostname: domain, port: 443,
    rejectUnauthorized: false, // проверяем даже истёкшие
    timeout: 5000
  }, (res) => {
    const cert = res.socket.getPeerCertificate();
    const expiryDate = new Date(cert.valid_to);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    // → metrics.sslExpiryDays
    // → metrics.sslDomain (cert.subject.CN)
    // → metrics.sslIssuer (cert.issuer.CN)
  });
}

// Алерты:
// sslExpiryDays ≤ 30 → warning  (cooldown 24ч)
// sslExpiryDays ≤ 7  → critical (cooldown 6ч)
// Настройка: DOMAIN=example.com в .env
```

### Слайд 18: Fail2Ban метрики через execSync
```typescript
// Проверка статуса сервиса
execSync('systemctl is-active fail2ban', { stdio: 'ignore' });
metrics.fail2banRunning = true;

// Количество активных jail'ов
const statusOutput = execSync('fail2ban-client status');
const jailMatch = statusOutput.match(/Jail list:\s*(.+)/);
metrics.fail2banActiveJails = jailMatch[1].split(',').length;

// Баны за последние 24 часа
const journalOutput = execSync(
  'journalctl -u fail2ban --since "24 hours ago" | grep "Ban " | wc -l'
);
metrics.fail2banBansLast24h = parseInt(journalOutput.trim());

// Правила:
// fail2banRunning === false → critical → webhook → Slack
// fail2banBansLast24h > 50 → warning  → WebSocket
```

### Слайд 19: Четыре канала уведомлений
```
Канал      Когда                    Настройка
──────────────────────────────────────────────────────
websocket  Все алерты               Всегда включён
           → broadcastToCluster()   → кабинет мониторинга

log        Все алерты               Всегда включён
           critical → logger.error  → Winston → файл
           warning  → logger.warn

webhook    Critical + security      ALERT_WEBHOOK_URL в .env
           → POST JSON payload      → Slack/Discord/Teams
           → { alert, system, ts }

email      Placeholder              TODO: реализовать
           logger.info только

Redis persistence:
  alert:<id>       → hSet, TTL 7 дней
  alerts:active    → SET активных
  alerts:history   → LIST последних 1000
```

---

## Блок 5: Fail2Ban (слайды 20-22)

### Слайд 20: Шесть jail'ов
```
Jail               Лог-файл              Попытки  Бан
──────────────────────────────────────────────────────────
sshd               /var/log/auth.log     3        2 часа
nginx-http-auth    nginx/error.log       6        30 мин
nginx-limit-req    nginx/error.log       10       10 мин
nginx-badbots      nginx/access.log      2        24 часа
nginx-admin-auth   nginx/access.log      3        1 час
nginx-req-limit    nginx/access.log      100/мин  5 мин

DEFAULT:
  bantime = 3600    (1 час)
  findtime = 600    (10 мин окно)
  maxretry = 5
  ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
```

### Слайд 21: Кастомные фильтры
```ini
# nginx-admin-auth — ловим 401/403 на /api/admin
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 401
            ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 403

# nginx-badbots — сканеры и известные инструменты
failregex = ^<HOST> -.*".*" (404|444) .*"(nikto|sqlmap|nmap|masscan|zgrab)"
            ^<HOST> -.*".*(.php|.asp|wp-admin|phpmyadmin|.env|.git).*" (404|403)

# Cloudflare action — бан сразу в CDN
actionban = curl -X POST "https://api.cloudflare.com/..." \
            --data '{"mode":"block","configuration":{"target":"ip","value":"<ip>"}}'
```

### Слайд 22: Два независимых рубежа
```
Рубеж 1: Fail2Ban (iptables)
  Уровень: OS/Network
  Срабатывает: до Nginx
  Блокирует: TCP-соединение
  Персистентность: iptables rules

Рубеж 2: DDoS Protection (Node.js)
  Уровень: Application
  Срабатывает: после Nginx
  Блокирует: HTTP-ответ 429
  Персистентность: Redis

Почему оба?
  Fail2Ban: эффективен против брутфорса и сканеров
  DDoS Protection: поведенческий анализ, API-специфичные паттерны
  Вместе: 99%+ покрытие угроз
```

---

## Заключение (слайды 23-25)

### Слайд 23: Архитектура целиком
```
enhancedSecurity.ts
  helmet (CSP, HSTS, X-Frame, noSniff, hidePoweredBy)
  additionalSecurityHeaders (Permissions-Policy, CORP, COOP)
  corsSecurityMiddleware (whitelist origins)
  apiSecurityHeaders (strict CSP, no-cache для admin)

ddosProtection.ts
  DdosProtection.middleware()
    whitelist → blacklist → blockedUntil → analyzeSuspiciousActivity
  createRateLimiter('strict'|'normal'|'lenient')

client/src/captcha/
  CaptchaButton → CaptchaModal → PuzzleCanvas → PuzzlePiece
  useCaptcha: generatePuzzle + validateSolution

AlertManager.ts
  17 правил, 30 сек интервал
  4 канала: websocket + webhook + log + email
  Redis: history 1000, TTL 7 дней

setup-fail2ban.sh
  6 jail'ов, кастомные фильтры, Cloudflare action
  Интеграция с AlertManager (fail2ban-service-down, fail2ban-high-bans)
```

### Слайд 24: Ключевые решения
```
✅ Два файла security middleware
   → security.ts (базовый) + enhancedSecurity.ts (helmet)
   → разделение ответственности

✅ http: в imgSrc CSP
   → намеренно — RSS-изображения по HTTP
   → безопасность не ломает функциональность

✅ Собственная CAPTCHA вместо Google
   → нет внешних зависимостей
   → уникальный алгоритм — боты не знают паттернов

✅ AlertManager с cooldown
   → защита от спама алертов
   → SSL: cooldown 24ч, чтобы не получать 48 алертов в день

✅ Два рубежа DDoS защиты
   → Fail2Ban (iptables) + Node.js (application)
   → независимые, дополняют друг друга
```

### Слайд 25: Анонс Эпизода 8
```
🎬 Эпизод 8: "Мониторинг и алерты"

📊 Кабинет мониторинга — зоны A-C
📈 Prometheus метрики — счётчики и гистограммы
🔔 WebSocket алерты — real-time в браузере
🏥 Health checks — /api/health
📉 Recharts — графики производительности

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **Security / защита:** `#22c55e` (зелёный)
- **Warning алерты:** `#f59e0b` (янтарный)
- **Critical алерты:** `#ef4444` (красный)
- **DDoS / блокировка:** `#6b7280` (серый)
- **CAPTCHA:** `#6366f1` (индиго)
- **Fail2Ban:** `#0ea5e9` (голубой)

---

*Слайды основаны на реальном production-коде проекта.*
