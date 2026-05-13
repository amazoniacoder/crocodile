# Подготовка к записи Эпизода 7: "Безопасность enterprise-уровня"

---

## 📋 Файлы для демонстрации

```
server/
├── middleware/
│   ├── security.ts                     ← Блок 1: базовые заголовки, authenticateAdmin
│   ├── enhancedSecurity.ts             ← Блок 1: helmet, CSP, Permissions-Policy
│   ├── ddosProtection.ts               ← Блок 2: DdosProtection class
│   └── rateLimiter.ts                  ← Блок 2: три тира
├── api/admin/security/
│   └── index.ts                        ← Блок 2: Admin API управления
└── infrastructure/monitoring/
    └── AlertManager.ts                 ← Блок 4: 17 правил, каналы, Redis

client/src/captcha/
├── types/index.ts                      ← Блок 3: PuzzleData, ValidationRequest
├── components/
│   ├── CaptchaButton.tsx               ← Блок 3: кнопка-триггер
│   ├── CaptchaModal.tsx                ← Блок 3: createPortal модал
│   └── PuzzleCanvas.tsx                ← Блок 3: drag&drop
└── hooks/useCaptcha.ts                 ← Блок 3: generatePuzzle, validateSolution

scripts/
├── setup-fail2ban.sh                   ← Блок 5: конфигурация jail'ов
└── security-monitor.sh                 ← Блок 5: комплексная диагностика
```

### Порядок открытия в VS Code
1. `enhancedSecurity.ts` — показать helmet + CSP + additionalSecurityHeaders
2. `security.ts` — показать базовый слой + authenticateAdmin
3. `ddosProtection.ts` — показать middleware() + analyzeSuspiciousActivity()
4. `server/api/admin/security/index.ts` — показать Admin API
5. `captcha/types/index.ts` — показать PuzzleData, ValidationRequest
6. `captcha/components/PuzzleCanvas.tsx` — показать drag&drop + validationState
7. `captcha/hooks/useCaptcha.ts` — показать validateSolution + два условия
8. `AlertManager.ts` — показать 17 правил + checkSSLCertificate + Fail2Ban метрики
9. `scripts/setup-fail2ban.sh` — показать jail'ы + кастомные фильтры

---

## 🎬 Подготовить перед записью

### Браузер
- [ ] Открыть приложение `http://localhost:5000`
- [ ] DevTools → Network → включить запись
- [ ] Открыть `/admin/monitor` — убедиться что AlertDashboard загружается
- [ ] Найти форму с CaptchaButton (или подготовить тестовую страницу)

### Терминал
- [ ] Приложение запущено: `npm run dev`
- [ ] `export ADMIN_TOKEN=<токен>`
- [ ] Проверить что API отвечает: `curl http://localhost:5000/api/health`

### VS Code
- [ ] Открыть все 9 файлов в отдельных вкладках
- [ ] Шрифт 16px, minimap отключён, word wrap включён
- [ ] Тема: Dark+ (default dark)

---

## 🎯 Ключевые акценты

1. **`http:` в imgSrc CSP** — намеренно, RSS-изображения по HTTP
2. **Два файла security middleware** — `security.ts` (базовый) + `enhancedSecurity.ts` (helmet) — разделение ответственности
3. **suspiciousScore накопительный** — не один паттерн, а сумма; порог 100
4. **Redis для DDoS** — два уровня: in-memory Map (быстро) + Redis (персистентность при рестарте)
5. **CAPTCHA — два условия** — правильная фигура И попадание в missingArea
6. **cooldown в AlertManager** — защита от спама; SSL: 24ч cooldown = 1 алерт в день
7. **Fail2Ban + DDoS Protection** — два независимых рубежа, разные уровни (OS vs Application)
8. **execSync для Fail2Ban метрик** — только на Linux/production, на dev — graceful skip

---

## 🎬 Сценарии демонстрации

### Security Headers
```
DevTools → Network → любой /api/ запрос
Response Headers:
  Content-Security-Policy: default-src 'self'; ...
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=()...
  (нет X-Powered-By)
```

### DDoS статистика
```bash
curl -s http://localhost:5000/api/admin/security/ddos/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Тест защиты от blacklist localhost:
curl -X POST http://localhost:5000/api/admin/security/ddos/blacklist \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "127.0.0.1"}'
# → { "error": "Cannot blacklist private network addresses" }
```

### CAPTCHA демо
```
1. Открыть форму с CaptchaButton
2. Нажать → CaptchaModal открывается
3. DevTools Console → показать debug лог validateSolution
4. Перетащить правильную фигуру → ✓ Correct!
5. Перетащить неправильную → ✕ Try again → новый пазл
```

### AlertManager
```bash
curl -s http://localhost:5000/api/admin/alerts \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

curl -s http://localhost:5000/api/admin/alerts/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## ⚙️ Настройки VS Code для записи

```json
{
  "editor.fontSize": 16,
  "editor.fontFamily": "JetBrains Mono",
  "editor.minimap.enabled": false,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Dark+ (default dark)"
}
```

---

## ✅ Чек-лист перед записью

- [ ] Приложение запущено и отвечает на `/api/health`
- [ ] ADMIN_TOKEN экспортирован в терминале
- [ ] Все 9 файлов открыты в VS Code
- [ ] DevTools открыт на вкладке Network
- [ ] Форма с CaptchaButton найдена и доступна
- [ ] Микрофон проверен
- [ ] Уведомления системы отключены
- [ ] Мессенджеры закрыты

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
