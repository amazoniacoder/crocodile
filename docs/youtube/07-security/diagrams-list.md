# Диаграммы для Эпизода 7: "Безопасность enterprise-уровня"

---

## 📊 Диаграмма 1: Пять слоёв защиты

```
Интернет
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  [1] Cloudflare                                     │
│      WAF + Bot Fight Mode + DDoS mitigation         │
│      SSL/TLS termination + CDN                      │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  [2] Fail2Ban (iptables)                            │
│      Срабатывает ДО Nginx                           │
│      6 jail'ов: SSH, HTTP Auth, Admin, Bots...      │
│      Блокирует TCP-соединение                       │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  [3] Nginx                                          │
│      Rate limiting (limit_req_zone)                 │
│      Security headers                               │
│      Cloudflare IP whitelist                        │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  [4] Node.js Application                           │
│      DDoS Protection (поведенческий анализ)         │
│      helmet + CSP + Permissions-Policy              │
│      Rate limiting (3 тира)                         │
│      authenticateAdmin + API keys                   │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  [5] Business Logic                                 │
│      CAPTCHA (puzzle drag&drop)                     │
│      Input sanitization                             │
│      Audit logging                                  │
└─────────────────────────────────────────────────────┘

AlertManager наблюдает за слоями 2, 4, 5 → 17 правил
```

---

## 📊 Диаграмма 2: DDoS Protection — поток обработки запроса

```
Входящий HTTP запрос
        │
        ▼
getClientIP(req)
  cf-connecting-ip → x-forwarded-for → x-real-ip → remoteAddress
        │
        ▼
whitelist.has(ip)?
  ДА → next() (localhost, private networks, IP_WHITELIST из .env)
        │
        ▼
isBlacklisted(ip)?
  In-memory Set → Redis sIsMember('ddos:blacklist')
  ДА → 429 "Access denied"
        │
        ▼
getIPStats(ip)
  In-memory Map → создать новую запись если нет
        │
        ▼
ipStats.blockedUntil > now?
  ДА → 429 "Temporarily blocked (Nm remaining)"
        │
        ▼
analyzeSuspiciousActivity(req, ipStats)
  → suspiciousScore (0-100+)
        │
        ▼
updateIPStats(ip, req, score)
  requestCount++, lastRequest = now
  Redis hSet ddos:ip:<ip>, expire 24ч
        │
        ▼
score > SUSPICIOUS_THRESHOLD(100)?
  ДА → blockIP(ip, score)
       blockDuration = min(60 × floor(score/50), 1440 мин)
       Redis hSet ddos:ip:<ip> { blockedUntil }
       → 429 "Suspicious activity detected"
  НЕТ → next()
```

---

## 📊 Диаграмма 3: Пять паттернов подозрительности

```
analyzeSuspiciousActivity():

Паттерн 1: high_frequency (+30)
  ipStats.requestCount > 100 за последнюю минуту

Паттерн 2: high_errors (+25)
  ipStats.errorCount > 20 за последнюю минуту

Паттерн 3: suspicious_ua (+20)
  User-Agent содержит:
  masscan | zgrab | nikto | sqlmap | nmap |
  dirbuster | nuclei | gobuster | hack | exploit
  ИЛИ User-Agent.length > 500
  ИЛИ User-Agent пустой

Паттерн 4: scanning (+15)
  Path содержит:
  .php | .asp | .jsp | wp-admin | phpmyadmin |
  .env | .git | .svn | backup

Паттерн 5: rapid_sequential (+20)
  Redis: INCR ddos:rapid:<ip>
         EXPIRE ddos:rapid:<ip> 10 сек
  count > 20 → более 20 запросов за 10 секунд

Итого:
  0-49   → нормально
  50-99  → подозрительно, накапливаем
  100+   → блокировка
```

---

## 📊 Диаграмма 4: CAPTCHA — полный поток

```
Пользователь нажимает кнопку формы
        │
        ▼
CaptchaButton.onClick()
  isSolved? → нет → setIsModalOpen(true)
        │
        ▼
CaptchaModal открывается (createPortal → document.body)
  useEffect(isOpen) → generatePuzzle()
        │
        ▼
generatePuzzle():
  puzzleVariant = Math.random() × 3  → 0|1|2
  pieces = generateMockPieces(variant)
    piece_1: isCorrect=true  (правильная фигура)
    piece_2: isCorrect=false (другая фигура)
    piece_3: isCorrect=false (третья фигура)
  pieces.sort(() => Math.random() - 0.5)  ← перемешать
  → PuzzleData { id, puzzleImage, pieces, missingArea, sessionToken }
        │
        ▼
PuzzleCanvas рендерит:
  [изображение с пропуском] + [3 фигуры для перетаскивания]
        │
        ▼
Пользователь перетаскивает фигуру:
  handleDrop(e)
    coordinates = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setValidationState('validating')
    result = await onPieceDrop(pieceId, coordinates)
        │
        ▼
validateSolution():
  isCorrectPiece = pieceId === correctPiece.id
  isInCorrectArea = coords внутри missingArea
  success = isCorrectPiece && isInCorrectArea
        │
        ├─ success=true
        │    setValidationState('success')
        │    1.5 сек → onSolved(token)
        │    → CaptchaButton: isSolved=true, иконка ✓
        │    → форма: setCaptchaToken(token)
        │
        └─ success=false
             setValidationState('error')
             2 сек → loadPuzzle() → новый случайный пазл
```

---

## 📊 Диаграмма 5: AlertManager — архитектура

```
AlertManager (singleton)
        │
        ├─ rules: Map<string, AlertRule>  ← 17 правил
        ├─ activeAlerts: Map<string, Alert>
        ├─ alertHistory: Map<string, AlertHistory>
        └─ checkInterval: setInterval(30 сек)

checkAlertConditions() каждые 30 сек:
        │
        ▼
collectSystemMetrics()
  ├─ RSS: lastCollectedAt, articlesLast24h, sourcesWithErrors
  ├─ System: memoryUsage (process.memoryUsage()), dbConnected, redisConnected
  ├─ Cluster: healthyNodes, totalNodes, failoverCount
  ├─ RateLimiter: backedOffDomains, rateLimiterUtilization
  ├─ SSL: checkSSLCertificate(DOMAIN) → daysUntilExpiry
  ├─ Disk: execSync('df / --output=pcent,used,size') → diskUsagePercent
  └─ Fail2Ban: execSync('systemctl is-active fail2ban')
               execSync('fail2ban-client status')
               execSync('journalctl ... | grep "Ban " | wc -l')
        │
        ▼
for each rule:
  rule.condition(metrics) → boolean
  cooldown прошёл? → triggerAlert() или resolveAlert()
        │
        ▼
triggerAlert():
  ├─ storeAlert(Redis): alert:<id> TTL 7 дней
  ├─ alerts:active SET, alerts:history LIST (max 1000)
  ├─ alertsTriggered.inc() → Prometheus
  └─ sendNotifications(channels):
       websocket → broadcastToCluster()
       log       → logger.warn/error
       webhook   → POST ALERT_WEBHOOK_URL
       email     → TODO
```

---

## 📊 Диаграмма 6: Fail2Ban — шесть jail'ов

```
Входящий запрос
        │
        ▼
iptables (Fail2Ban управляет правилами)
        │
        ├─ IP в бан-листе? → DROP (TCP reset)
        │
        └─ Пропустить → Nginx

Jail'ы и их фильтры:

sshd (порт 22):
  /var/log/auth.log → "authentication failure"
  3 попытки / 10 мин → бан 2 часа

nginx-admin-auth (порты 80,443):
  /var/log/nginx/access.log
  regex: /api/admin.* → 401|403
  3 попытки / 5 мин → бан 1 час

nginx-badbots (порты 80,443):
  /var/log/nginx/access.log
  regex: nikto|sqlmap|nmap|masscan в UA
         .php|.env|.git в path → 404|403
  2 попытки → бан 24 часа

nginx-http-auth (порты 80,443):
  /var/log/nginx/error.log
  6 попыток / 10 мин → бан 30 мин

nginx-limit-req (порты 80,443):
  /var/log/nginx/error.log → "limiting requests"
  10 срабатываний → бан 10 мин

nginx-req-limit (порты 80,443):
  /var/log/nginx/access.log → любые запросы
  100 запросов / 1 мин → бан 5 мин

При бане → опционально: Cloudflare API → блок на CDN уровне
```

---

## 📊 Диаграмма 7: security-monitor.sh — 10 проверок

```
./scripts/security-monitor.sh

1. System Services
   nginx | fail2ban | postgresql | redis-server
   → systemctl is-active

2. SSL Certificate
   openssl s_client -connect $DOMAIN:443
   → дней до истечения: >30 OK | >7 WARNING | ≤7 ERROR

3. Disk Usage
   df / → процент использования
   <80% OK | <90% WARNING | ≥90% ERROR

4. Memory Usage
   free -m → MEM_USED / MEM_TOTAL
   <80% OK | <90% WARNING | ≥90% ERROR

5. Fail2Ban Status
   fail2ban-client status → jail'ы, забаненные IP
   journalctl → баны за 24ч: >50 WARNING

6. Nginx Security
   Cloudflare IP whitelist настроен?
   limit_req_zone настроен?
   X-Frame-Options настроен?

7. Database Security
   PostgreSQL listen_addresses = localhost?
   Последний бэкап < 25 часов назад?

8. Network Security
   ss -tuln → открытые порты
   активные соединения на 22|80|443|5000

9. Log Analysis
   /var/log/auth.log → authentication failures сегодня
   /var/log/nginx/error.log → ошибки сегодня

10. Application Security
    pgrep node → приложение запущено?
    curl /api/health → health endpoint доступен?
```

---

*Диаграммы основаны на реальной реализации проекта.*
