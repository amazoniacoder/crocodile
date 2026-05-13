# Cloudflare Setup Guide

## 🚀 Шаг 1: Добавление сайта в Cloudflare

1. **Войти в Cloudflare Dashboard:** https://dash.cloudflare.com/
2. **Add a Site** → ввести ваш домен (example.com)
3. **Select Plan** → Free (достаточно для начала)
4. **Review DNS records** → убедиться что записи корректны

## 🔧 Шаг 2: DNS Records

Настроить следующие записи:

```
Type    Name    Content         Proxy Status
A       @       <server-ip>     Proxied ✅
A       www     <server-ip>     Proxied ✅
AAAA    @       <ipv6>         Proxied ✅ (если есть IPv6)
```

**Важно:** Proxy Status должен быть **Proxied** (оранжевое облако)

## 🔒 Шаг 3: SSL/TLS Configuration

**SSL/TLS → Overview:**
- Encryption mode: **Full (strict)**
- Требует валидный SSL на origin-сервере

**SSL/TLS → Edge Certificates:**
- Always Use HTTPS: **On**
- HTTP Strict Transport Security (HSTS): **Enable**
  - Max Age Header: 6 months
  - Include Subdomains: On
  - Preload: On

## 🛡️ Шаг 4: Security Settings

**Security → Settings:**
- Security Level: **Medium**
- Bot Fight Mode: **On**
- Challenge Passage: 30 minutes

**Security → WAF:**
- Web Application Firewall: **On**
- OWASP Core Ruleset: **On**

## ⚡ Шаг 5: Speed Optimization

**Speed → Optimization:**
- Auto Minify:
  - JavaScript: ✅
  - CSS: ✅
  - HTML: ✅
- Brotli: **On**

**Caching → Configuration:**
- Browser Cache TTL: **4 hours**
- Always Online: **On**

## 📋 Шаг 6: Cache Rules

**Rules → Cache Rules → Create Rule:**

### Rule 1: Service Worker Bypass
```
Rule Name: Service Worker Bypass
When incoming requests match:
  URI Path equals "/sw.js"
Then:
  Cache status: Bypass cache
```

### Rule 2: API Bypass
```
Rule Name: API Bypass
When incoming requests match:
  URI Path starts with "/api"
Then:
  Cache status: Bypass cache
```

### Rule 3: PWA Manifest
```
Rule Name: PWA Manifest
When incoming requests match:
  URI Path equals "/manifest.webmanifest"
Then:
  Cache status: Cache everything
  Edge TTL: 1 hour
```

### Rule 4: Static Assets
```
Rule Name: Static Assets
When incoming requests match:
  File extension is in (js css png jpg jpeg gif svg ico woff woff2 ttf eot)
Then:
  Cache status: Cache everything
  Edge TTL: 1 day
  Browser TTL: 1 day
```

## 🚫 Шаг 7: Page Rules (опционально)

**Rules → Page Rules → Create Page Rule:**

### Rule 1: Admin Protection
```
URL: yourdomain.com/admin*
Settings:
  - Security Level: High
  - Cache Level: Bypass
```

### Rule 2: API Rate Limiting
```
URL: yourdomain.com/api/*
Settings:
  - Security Level: Medium
  - Cache Level: Bypass
```

## 🔄 Шаг 8: Смена Nameservers

**После настройки всех правил:**

1. **Cloudflare Dashboard → Overview**
2. Скопировать предоставленные nameservers:
   ```
   alice.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```

3. **В панели управления доменом** (где покупали домен):
   - Найти DNS/Nameserver settings
   - Заменить текущие nameservers на Cloudflare
   - Сохранить изменения

4. **Ожидание активации:** 24-48 часов (обычно быстрее)

## ✅ Шаг 9: Проверка активации

**Проверить статус:**
```bash
# Проверить nameservers
nslookup -type=ns yourdomain.com

# Проверить Cloudflare headers
curl -I https://yourdomain.com
# Должен содержать: cf-ray, cf-cache-status
```

**В Cloudflare Dashboard:**
- Status должен быть **Active**
- SSL certificate должен быть **Active**

## 🎯 Результат

После активации:
- ✅ DDoS защита активна
- ✅ SSL сертификат от Cloudflare
- ✅ Кэширование статических файлов
- ✅ Минификация CSS/JS/HTML
- ✅ Bot protection
- ✅ WAF защита

## 🔧 Дополнительные настройки

### Analytics
**Analytics → Web Analytics:**
- Enable Web Analytics: **On**
- Получить tracking code для встраивания

### Speed Insights
**Speed → Optimization:**
- Mirage: **On** (для мобильных)
- Polish: **Lossless** (оптимизация изображений)

---

**Время выполнения:** 30-60 минут + время активации DNS