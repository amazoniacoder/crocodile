# Сценарии демонстрации для Эпизода 7: "Безопасность enterprise-уровня"

> Все сценарии проверены на реальном коде проекта

---

## 🎬 Демо 1: Security Headers в DevTools

### Подготовка
- [ ] Приложение запущено: `npm run dev`
- [ ] Открыть браузер, перейти на `http://localhost:5000`

### Сценарий
1. DevTools → Network → выбрать любой запрос к `/api/`
2. Response Headers → показать:
   - `Content-Security-Policy` — длинная строка с директивами
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Permissions-Policy: camera=(), microphone=(), ...`
   - Отсутствие `X-Powered-By`
3. Выбрать запрос к `/api/admin/` → показать строгий CSP: `default-src 'none'`
4. Показать `Cache-Control: no-store` для admin эндпоинтов

### Что объяснить
```
X-Powered-By убран → атакующий не знает что это Express
X-Frame-Options: DENY → clickjacking невозможен
CSP для API: default-src 'none' → максимальная изоляция
Cache-Control: no-store для admin → браузер не кэширует токены
```

---

## 🎬 Демо 2: DDoS Protection — статистика через API

### Подготовка
- [ ] `export ADMIN_TOKEN=<ваш токен>`
- [ ] Приложение запущено

### Сценарий
```bash
# 1. Общая статистика
curl -s http://localhost:5000/api/admin/security/ddos/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ожидаемый ответ:
# {
#   "stats": {
#     "blockedIPs": 0,
#     "blacklistedIPs": 0,
#     "whitelistedIPs": 3,
#     "suspiciousIPs": 0
#   }
# }

# 2. Список заблокированных IP
curl -s http://localhost:5000/api/admin/security/ddos/blocked \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# 3. Полный дашборд
curl -s http://localhost:5000/api/admin/security/ddos/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .dashboard.patterns
```

### Симуляция подозрительного User-Agent
```bash
# Запрос с User-Agent сканера — получит +20 баллов
curl -s http://localhost:5000/api/news \
  -H "User-Agent: nikto/2.1.6" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Проверить что IP получил паттерн suspicious_ua
curl -s http://localhost:5000/api/admin/security/ddos/blocked \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.blockedIPs'
```

---

## 🎬 Демо 3: CAPTCHA в действии

### Подготовка
- [ ] Найти форму с CAPTCHA в приложении (или открыть компонент напрямую)
- [ ] DevTools → Console открыт

### Сценарий
1. Открыть страницу с формой где есть `CaptchaButton`
2. Показать кнопку в состоянии `unsolved` — иконка puzzle
3. Нажать кнопку → открывается `CaptchaModal`
4. Показать три фигуры внизу (circle/triangle/rectangle)
5. Показать изображение с пропуском (пунктирный контур)
6. DevTools → Console → показать debug лог:
   ```
   🔍 Validation Debug: {
     pieceId: "piece_1",
     correctPieceId: "piece_1",
     isCorrectPiece: true,
     dropCoords: { x: 95, y: 68 },
     missingArea: { x: 80, y: 55, width: 40, height: 40 },
     isInCorrectArea: true
   }
   ```
7. Перетащить правильную фигуру → `✓ Correct!` → кнопка меняется на ✓
8. Перетащить неправильную → `✕ Try again` → новый пазл

### Показать интеграцию
```typescript
// В консоли браузера — симулировать решение
// Показать что token передаётся в форму
```

---

## 🎬 Демо 4: AlertManager — активные алерты

### Подготовка
- [ ] Открыть `/admin/monitor` в браузере
- [ ] Убедиться что AlertDashboard компонент виден

### Сценарий
1. Открыть `/admin/monitor` → найти секцию алертов
2. Показать активные алерты (если есть)
3. Показать историю алертов

### Симуляция алерта через API
```bash
# Проверить текущие активные алерты
curl -s http://localhost:5000/api/admin/alerts \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Проверить статистику алертов
curl -s http://localhost:5000/api/admin/alerts/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### Показать SSL мониторинг
```bash
# Проверить SSL статус (если DOMAIN настроен)
curl -s http://localhost:5000/api/admin/monitoring/ssl-status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ручная проверка SSL через openssl
openssl s_client -servername example.com -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## 🎬 Демо 5: security-monitor.sh

### Подготовка
- [ ] Скрипт доступен: `scripts/security-monitor.sh`
- [ ] На Linux/production сервере (на Windows — показать код)

### Сценарий (на production)
```bash
# Запустить полную диагностику
./scripts/security-monitor.sh

# Ожидаемый вывод:
# 🔧 System Services:
#   ✅ nginx is running
#   ✅ fail2ban is running
#   ✅ postgresql is running
#   ✅ redis-server is running
#
# 🔒 SSL Certificate:
#   ✅ SSL certificate expires in 87 days
#
# 💾 Disk Usage:
#   ✅ Disk usage: 45% (12G available)
#
# 🛡️ Fail2Ban Protection:
#   ✅ Fail2Ban active with 6 jails, 2 IPs currently banned
#   ✅ 3 bans in last 24h
```

### На Windows — показать код скрипта
```bash
# Открыть scripts/security-monitor.sh в VS Code
# Объяснить каждую из 10 секций
# Показать цветовое кодирование: ✅ OK / ⚠️ WARNING / ❌ ERROR
```

---

## 🎬 Демо 6: Fail2Ban управление (на production)

### Сценарий
```bash
# Статус всех jail'ов
sudo fail2ban-client status

# Детали конкретного jail
sudo fail2ban-client status nginx-admin-auth

# Ожидаемый вывод:
# Status for the jail: nginx-admin-auth
# |- Filter
# |  |- Currently failed: 0
# |  `- Total failed: 12
# `- Actions
#    |- Currently banned: 1
#    `- Total banned: 3

# Разблокировать IP
sudo /usr/local/bin/fail2ban-unban.sh 1.2.3.4

# Полный отчёт
sudo /usr/local/bin/fail2ban-status.sh

# Последние баны
sudo journalctl -u fail2ban --since "1 hour ago" | grep "Ban "
```

---

## ⚙️ Команды для подготовки

```bash
# Проверить что security middleware подключён
grep -n "comprehensiveSecurityMiddleware\|ddosProtection\|helmet" server/index.ts

# Проверить конфигурацию rate limiter
curl -s http://localhost:5000/api/news \
  -I | grep -i "ratelimit\|x-ratelimit"

# Тест блокировки приватных IP в blacklist API
curl -X POST http://localhost:5000/api/admin/security/ddos/blacklist \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "127.0.0.1"}' | jq .
# Ожидаем: { "error": "Cannot blacklist private network addresses" }
```
