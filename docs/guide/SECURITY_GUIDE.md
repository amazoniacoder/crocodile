# Security Guide — Руководство по безопасности

> **Версия:** 2.0  
> **Создан:** Декабрь 2024  
> **Статус:** Production

---

## 🛡️ Обзор системы безопасности

NewsAggregator реализует **enterprise-уровень безопасности** с многоуровневой защитой и проактивным мониторингом.

### Ключевые компоненты
- **17 правил алертов** через единую систему AlertManager
- **Собственная CAPTCHA** с 95-98% защитой от ботов
- **DDoS защита** с поведенческим анализом
- **Fail2Ban** для защиты SSH и HTTP
- **SSL мониторинг** с автоматическими алертами
- **Автоматические бэкапы** с верификацией целостности

---

## 🔒 Аутентификация и авторизация

### Admin API
**Единый middleware:** `authenticateAdmin` (`server/middleware/security.ts`)

1. **TokenManager** — основная система (таблица `admin_tokens`)
   - bcrypt хэширование
   - Автоматическая ротация
   - Redis кэширование (TTL 5 мин)
   
2. **Legacy fallback** — `ADMIN_TOKEN` из `.env`

**Использование:**
```bash
# Все admin роуты требуют заголовок
Authorization: Bearer <token>
```

### API-ключи публичного API
**Управление:** `ApiKeyService` (`server/infrastructure/auth/ApiKeyService.ts`)

- **Формат ключа:** `na_` + 24 random bytes
- **Хранение:** только SHA-256 хэш в БД
- **Валидация:** Redis кэш 5 мин
- **Rate limiting:** 120 req/мин без ключа, лимит из БД с ключом

**Создание ключа:**
```bash
curl -X POST http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "requestsPerMinute": 240}'
```

---

## 🚨 Система алертов

### AlertManager — 17 правил мониторинга

| Категория | Правила | Описание |
|-----------|---------|----------|
| **RSS сбор** | 3 правила | Остановка сбора, высокий error rate, мало статей |
| **Система** | 4 правила | Память, БД, Redis, кластер |
| **Безопасность** | 6 правил | SSL, disk, Fail2Ban |
| **Производительность** | 4 правила | Rate limiters, failover, NER |

### Каналы уведомлений
- **WebSocket** — мгновенные уведомления в кабинет мониторинга
- **Webhook** — интеграция со Slack/Discord для критических алертов
- **Log** — структурированное логирование всех событий

### Настройка Webhook
```env
# .env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**Формат Slack webhook:**
```json
{
  "text": "🚨 SSL Certificate Critical",
  "attachments": [{
    "color": "danger",
    "fields": [
      {"title": "Severity", "value": "critical", "short": true},
      {"title": "Component", "value": "ssl-monitoring", "short": true},
      {"title": "Description", "value": "SSL certificate expires in 3 days!"}
    ]
  }]
}
```

---

## 🔐 CAPTCHA система

### Собственная реализация
**Файлы:** `client/src/captcha/`

**Преимущества над внешними решениями:**
- ✅ **95-98% защита** от ботов (геометрические пазлы)
- ✅ **Уникальный алгоритм** — боты не знают паттернов
- ✅ **Превосходный UX** — drag & drop интерфейс
- ✅ **Полный контроль** — нет зависимости от внешних сервисов
- ✅ **Accessibility** — поддержка клавиатуры и screen readers

### Интеграция в формы
```typescript
import { CaptchaButton } from '@/captcha';

<CaptchaButton
  onSolved={(token) => setCaptchaToken(token)}
  onError={(error) => console.error(error)}
  size="md"
/>
```

### Алгоритм защиты
1. **Генерация пазла** — 3 варианта геометрических фигур
2. **Валидация координат** — точное позиционирование
3. **Серверная проверка** — защита от client-side обхода
4. **Rate limiting** — защита от массовых попыток

---

## 🛡️ DDoS защита

### Многоуровневая защита
**Файл:** `server/middleware/ddosProtection.ts`

1. **IP Whitelist** — локальные и доверенные IP
2. **Rate Limiting** — express-rate-limit с LRU кэшем
3. **Поведенческий анализ** — подозрительные паттерны
4. **Автоматическая блокировка** — временные баны

### Анализируемые паттерны
- **Высокая частота запросов** — >100 req/мин
- **Подозрительные User-Agent** — сканеры, боты
- **Сканирование** — доступ к несуществующим endpoint'ам
- **Последовательные запросы** — >20 req за 10 сек

### Конфигурация лимитов
```typescript
// Разные уровни для разных endpoint'ов
const configs = {
  strict: { windowMs: 15 * 60 * 1000, max: 50 },    // Admin API
  normal: { windowMs: 15 * 60 * 1000, max: 1000 },  // Public API
  lenient: { windowMs: 15 * 60 * 1000, max: 5000 }  // Static assets
};
```

---

## 🚫 Fail2Ban защита

### Защищаемые сервисы
- **SSH** — 3 попытки, бан на 2 часа
- **Nginx HTTP Auth** — 6 попыток, бан на 30 минут
- **Admin Panel** — 3 попытки, бан на 1 час
- **Bad Bots** — 2 попытки, бан на 24 часа

### Мониторинг через AlertManager
- **fail2ban-service-down** — сервис не запущен (critical)
- **fail2ban-high-bans** — >50 банов за 24ч (warning)

### Управление
```bash
# Статус
sudo fail2ban-client status

# Разблокировать IP
sudo fail2ban-unban.sh 192.168.1.100

# Мониторинг
sudo fail2ban-status.sh
```

---

## 🔒 SSL мониторинг

### Автоматическая проверка
- **Интервал:** каждые 30 секунд через AlertManager
- **Алерты:** 30 дней (warning), 7 дней (critical)
- **Проверка:** домен из переменной `DOMAIN`

### Настройка
```env
# .env
DOMAIN=example.com
```

### Ручная проверка
```bash
# Проверить SSL сертификат
openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates

# Через API
curl "http://localhost:5000/api/admin/monitoring/ssl-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 💾 Система бэкапов

### GFS ротация (Grandfather-Father-Son)
- **Daily:** 7 дней (каждый день в 2:00)
- **Weekly:** 4 недели (воскресенье в 3:00)
- **Monthly:** 12 месяцев (1 число в 4:00)

### Верификация целостности
- **Автоматическая:** каждый понедельник в 5:00
- **Проверки:** целостность архива, размер файла, возраст
- **Алерты:** через AlertManager при ошибках

### Мониторинг
```bash
# Статус бэкапов
ls -la /backups/daily/ | head -10

# Проверка целостности
sudo /usr/local/bin/backup-verify.sh

# Логи
tail -f /var/log/backup-verify.log
```

---

## 🌐 Cloudflare интеграция

### Настройки безопасности
- **Security Level:** Medium
- **Bot Fight Mode:** On
- **WAF:** On с OWASP Core Ruleset
- **SSL/TLS:** Full (strict)

### Cache Rules для PWA
```
Service Worker: /sw.js → Bypass
API: /api/* → Bypass
Manifest: /manifest.webmanifest → 1 hour
Static: *.js,*.css,*.png → 1 day
```

### Nginx интеграция
- **Real IP:** Cloudflare IP ranges
- **Whitelist:** только Cloudflare IP
- **Автообновление:** еженедельно через cron

---

## 📊 Мониторинг безопасности

### Комплексная проверка
```bash
# Запуск полной диагностики
./scripts/security-monitor.sh
```

**Проверяется:**
- ✅ Статус сервисов (nginx, fail2ban, postgresql, redis)
- 🔒 SSL сертификат (дни до истечения, валидность)
- 💾 Использование диска и памяти
- 🛡️ Статус Fail2Ban (jail'ы, статистика банов)
- 🌐 Nginx конфигурация (Cloudflare, rate limiting)
- 🗄️ Безопасность БД (listen_addresses, бэкапы)
- 📊 Анализ логов (auth failures, nginx errors)

### Zone O — Security Monitoring
**Кабинет мониторинга:** `/admin/monitor`

**Компоненты:**
- SSL Certificate Status
- Disk Usage Monitor  
- Fail2Ban Statistics
- Security Alerts History
- Failed Login Attempts
- DDoS Protection Status

---

## 🚨 Incident Response

### Алгоритм реагирования

#### 1. Критический алерт SSL
```bash
# Проверить сертификат
openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

# Обновить через Certbot
sudo certbot renew --nginx

# Проверить Cloudflare SSL
```

#### 2. Высокая активность Fail2Ban
```bash
# Проверить заблокированные IP
sudo fail2ban-client status

# Анализ логов
sudo journalctl -u fail2ban --since "1 hour ago"

# При необходимости разблокировать
sudo fail2ban-unban.sh <IP>
```

#### 3. Переполнение диска
```bash
# Проверить использование
df -h

# Очистить старые логи
sudo journalctl --vacuum-time=7d

# Очистить старые бэкапы
sudo find /backups -name "*.sql.gz" -mtime +30 -delete
```

#### 4. DDoS атака
```bash
# Проверить подозрительные IP
curl "http://localhost:5000/api/admin/security/ddos-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Заблокировать через Cloudflare
# Или добавить в Fail2Ban blacklist
```

---

## 🔧 Настройка production

### Обязательные переменные
```env
# Безопасность
ADMIN_TOKEN=<32+ символов hex>
DOMAIN=yourdomain.com
ALERT_WEBHOOK_URL=https://hooks.slack.com/...

# SSL мониторинг
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### Чеклист безопасности
- [ ] SSL сертификат установлен и мониторится
- [ ] Fail2Ban настроен и активен
- [ ] Cloudflare подключен с правильными настройками
- [ ] Nginx ограничен Cloudflare IP
- [ ] Бэкапы настроены и верифицируются
- [ ] AlertManager настроен с webhook
- [ ] DDoS защита активна
- [ ] API-ключи созданы для внешних интеграций

### Регулярное обслуживание
- **Еженедельно:** проверка логов безопасности
- **Ежемесячно:** тест восстановления из бэкапа
- **Ежеквартально:** полный security audit

---

## 📚 Связанные документы

- [SECURITY_PLAN_V2.md](../SECURITY_PLAN_V2.md) — план внедрения
- [BACKUP_GUIDE.md](./BACKUP_GUIDE.md) — система бэкапов
- [MONITOR_GUIDE.md](./MONITOR_GUIDE.md) — кабинет мониторинга
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — команды разработчика

---

*Создан: Декабрь 2024. Enterprise-уровень безопасности с проактивным мониторингом.*