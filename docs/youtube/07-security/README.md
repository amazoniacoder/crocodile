# Эпизод 7: Готовность к производству

> **Статус:** ✅ Готов к записи
> **Документация:** 100% завершена
> **Код проверен:** Соответствует реальной реализации

---

## 📋 Что создано

1. **[script.md](./script.md)** — Детальный сценарий (25-30 минут)
2. **[slides-outline.md](./slides-outline.md)** — 25 слайдов, 5 блоков + заключение
3. **[diagrams-list.md](./diagrams-list.md)** — 7 диаграмм архитектуры безопасности
4. **[demo-scenarios.md](./demo-scenarios.md)** — 6 сценариев демонстрации
5. **[code-examples.md](./code-examples.md)** — Примеры из реального кода (9 файлов)
6. **[interactive-elements.md](./interactive-elements.md)** — 3 вызова, 3 опроса, челлендж
7. **[recording-preparation.md](./recording-preparation.md)** — Чек-лист и порядок файлов

---

## 🎯 Ключевые сообщения

- **Пять слоёв защиты** — Cloudflare → Fail2Ban → Nginx → Node.js → Business Logic
- **Два файла security middleware** — `security.ts` (базовый) + `enhancedSecurity.ts` (helmet)
- **`http:` в imgSrc CSP** — намеренно, RSS-изображения по HTTP
- **DDoS: 5 паттернов** — suspiciousScore накопительный, порог 100, Redis persistence
- **Три тира rate limiting** — strict(50) / normal(1000) / lenient(5000) за 15 мин
- **CAPTCHA без Google** — puzzle drag&drop, два условия валидации, JWT токен
- **AlertManager: 17 правил** — 30 сек интервал, cooldown защита, Redis history 1000
- **SSL мониторинг** — прямое TLS-соединение из Node.js, без openssl CLI
- **Fail2Ban метрики** — execSync, graceful skip на dev/Windows
- **Два рубежа DDoS** — Fail2Ban (iptables/OS) + Node.js (application), независимые

---

## ⚠️ Важные нюансы для записи

| Момент | Что объяснить |
|--------|---------------|
| `http:` в CSP imgSrc | Намеренно — RSS-изображения по HTTP |
| `useCaptcha.ts` — mock данные | Backend CAPTCHA API ещё не реализован, фронтенд готов |
| `execSync` в AlertManager | Только на Linux/production; на dev — `catch` → graceful skip |
| Два файла security | `security.ts` написан вручную раньше, `enhancedSecurity.ts` — рефакторинг через helmet |
| `cooldownMinutes: 1440` для SSL | 24ч = 1 алерт в день, без cooldown — 2880 алертов/сутки |

---

## 📁 Файлы проекта для демонстрации

```
server/middleware/security.ts
server/middleware/enhancedSecurity.ts
server/middleware/ddosProtection.ts
server/middleware/rateLimiter.ts
server/api/admin/security/index.ts
server/infrastructure/monitoring/AlertManager.ts
client/src/captcha/types/index.ts
client/src/captcha/components/PuzzleCanvas.tsx
client/src/captcha/hooks/useCaptcha.ts
scripts/setup-fail2ban.sh
scripts/security-monitor.sh
```

---

**Эпизод 7 готов к производству! 🚀**
