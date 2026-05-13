# Backup System Guide

> **Версия:** 2.0  
> **Создан:** Декабрь 2024  
> **Статус:** Production

---

## 🎯 Обзор

Система автоматических бэкапов PostgreSQL с ротацией по схеме **Grandfather-Father-Son (GFS)** и верификацией целостности.

## 📋 Стратегия ротации (GFS)

### Структура хранения
```
/backups/
├── daily/          # 7 дней (каждый день в 2:00)
├── weekly/         # 4 недели (воскресенье в 3:00)
└── monthly/        # 12 месяцев (1 число в 4:00)
```

### Расписание
| Тип | Время | Частота | Хранение |
|-----|-------|---------|----------|
| **Daily** | 2:00 AM | Ежедневно | 7 дней |
| **Weekly** | 3:00 AM | Воскресенье | 4 недели |
| **Monthly** | 4:00 AM | 1 число | 12 месяцев |
| **Verification** | 5:00 AM | Понедельник | - |

### Примерный объем (БД 500MB)
- Daily: 7 × 50MB = 350MB
- Weekly: 4 × 50MB = 200MB  
- Monthly: 12 × 50MB = 600MB
- **Итого:** ~1.2GB (предсказуемо)

---

## 🚀 Установка

### Автоматическая установка
```bash
cd /path/to/BlogPro
sudo ./scripts/backup/setup-postgres-backup.sh
```

### Ручная установка

1. **Создание директорий:**
```bash
sudo mkdir -p /backups/{daily,weekly,monthly}
sudo chown postgres:postgres /backups -R
sudo chmod 750 /backups -R
```

2. **Настройка cron:**
```bash
sudo cp scripts/backup/pg-backup.cron /etc/cron.d/pg-backup
```

3. **Скрипт верификации:**
```bash
sudo cp scripts/backup/backup-verify.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/backup-verify.sh
```

---

## 🔍 Верификация целостности

### Автоматическая проверка
- **Когда:** Каждый понедельник в 5:00 AM
- **Что проверяется:**
  - Целостность архива (`gunzip -t`)
  - Размер файла (минимум 1MB)
  - Возраст последнего бэкапа

### Ручная проверка
```bash
# Проверить целостность конкретного бэкапа
gunzip -t /backups/daily/pg_20241215.sql.gz

# Проверить все daily бэкапы
for backup in /backups/daily/pg_*.sql.gz; do
    echo "Checking $backup..."
    gunzip -t "$backup" && echo "✅ OK" || echo "❌ CORRUPTED"
done

# Запустить полную верификацию
sudo /usr/local/bin/backup-verify.sh
```

### Логи верификации
```bash
# Просмотр логов
tail -f /var/log/backup-verify.log

# Последние проверки
grep "$(date +%Y-%m-%d)" /var/log/backup-verify.log
```

---

## 🔄 Восстановление

### Из daily backup
```bash
# Остановить приложение
sudo systemctl stop newsaggregator

# Восстановить БД
gunzip -c /backups/daily/pg_20241215.sql.gz | sudo -u postgres psql crocodile_db

# Запустить приложение
sudo systemctl start newsaggregator
```

### Из weekly backup
```bash
# Найти нужный бэкап
ls -la /backups/weekly/

# Восстановить
gunzip -c /backups/weekly/pg_week_2024_W50.sql.gz | sudo -u postgres psql crocodile_db
```

### Из monthly backup
```bash
# Найти архивный бэкап
ls -la /backups/monthly/

# Восстановить
gunzip -c /backups/monthly/pg_month_202411.sql.gz | sudo -u postgres psql crocodile_db
```

### Восстановление в новую БД
```bash
# Создать новую БД
sudo -u postgres createdb crocodile_db_restored

# Восстановить данные
gunzip -c /backups/daily/pg_20241215.sql.gz | sudo -u postgres psql crocodile_db_restored

# Проверить данные
sudo -u postgres psql crocodile_db_restored -c "SELECT COUNT(*) FROM news_articles;"
```

---

## 📊 Мониторинг

### Интеграция с AlertManager

Система бэкапов интегрирована с AlertManager для автоматических уведомлений:

- **Ошибки верификации** → критический алерт
- **Отсутствие бэкапов** → критический алерт  
- **Малый размер файла** → предупреждение

### Проверка статуса
```bash
# Последние бэкапы
ls -la /backups/daily/ | head -10

# Размеры бэкапов
du -h /backups/daily/pg_*.sql.gz | tail -7

# Статистика по директориям
echo "Daily backups: $(ls /backups/daily/ | wc -l)"
echo "Weekly backups: $(ls /backups/weekly/ | wc -l)"
echo "Monthly backups: $(ls /backups/monthly/ | wc -l)"
```

### Мониторинг через API
```bash
# Статус бэкапов (если реализован endpoint)
curl "http://localhost:5000/api/admin/monitoring/backup-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🛠️ Управление

### Ручное создание бэкапа
```bash
# Создать внеплановый бэкап
sudo -u postgres pg_dump crocodile_db | gzip > /backups/manual/pg_manual_$(date +%Y%m%d_%H%M).sql.gz
```

### Очистка старых бэкапов
```bash
# Очистить daily старше 7 дней
find /backups/daily -name "pg_*.sql.gz" -mtime +7 -delete

# Очистить weekly старше 28 дней
find /backups/weekly -name "pg_week_*.sql.gz" -mtime +28 -delete

# Очистить monthly старше 365 дней
find /backups/monthly -name "pg_month_*.sql.gz" -mtime +365 -delete
```

### Изменение расписания
```bash
# Редактировать cron
sudo nano /etc/cron.d/pg-backup

# Перезапустить cron
sudo systemctl restart cron
```

---

## 🚨 Troubleshooting

### Проблема: Бэкап не создается

**Проверить:**
```bash
# Статус cron
sudo systemctl status cron

# Логи cron
sudo journalctl -u cron -f

# Права доступа
ls -la /backups/
```

**Решение:**
```bash
# Исправить права
sudo chown postgres:postgres /backups -R
sudo chmod 750 /backups -R

# Перезапустить cron
sudo systemctl restart cron
```

### Проблема: Ошибка "disk full"

**Проверить место:**
```bash
df -h /backups
```

**Решение:**
```bash
# Очистить старые бэкапы
sudo find /backups -name "*.sql.gz" -mtime +30 -delete

# Или переместить на другой диск
sudo mv /backups /mnt/storage/backups
sudo ln -s /mnt/storage/backups /backups
```

### Проблема: Коррупция бэкапа

**Проверить:**
```bash
gunzip -t /backups/daily/pg_20241215.sql.gz
```

**Решение:**
```bash
# Использовать предыдущий бэкап
ls -la /backups/daily/ | tail -5

# Или weekly/monthly
gunzip -c /backups/weekly/pg_week_2024_W50.sql.gz | head -10
```

---

## 📈 Расширенные возможности

### Cloud Storage интеграция

**AWS S3:**
```bash
# Установить AWS CLI
sudo apt install awscli

# Синхронизация в S3
aws s3 sync /backups/ s3://my-backups/postgres/ --delete

# Добавить в cron
echo "0 6 * * * aws s3 sync /backups/ s3://my-backups/postgres/ --delete" | sudo tee -a /etc/cron.d/pg-backup
```

**Backblaze B2:**
```bash
# Установить B2 CLI
sudo pip install b2

# Синхронизация
b2 sync /backups/ b2://my-bucket/postgres/
```

### Шифрование бэкапов
```bash
# Создать зашифрованный бэкап
sudo -u postgres pg_dump crocodile_db | gzip | gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output /backups/encrypted/pg_$(date +%Y%m%d).sql.gz.gpg

# Расшифровать
gpg --decrypt /backups/encrypted/pg_20241215.sql.gz.gpg | gunzip | sudo -u postgres psql crocodile_db_restored
```

### Point-in-Time Recovery (PITR)
```bash
# Включить WAL архивирование в postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'

# Базовый бэкап для PITR
sudo -u postgres pg_basebackup -D /backups/base -Ft -z -P
```

---

## 📋 Чеклист обслуживания

### Еженедельно
- [ ] Проверить логи верификации
- [ ] Убедиться в наличии fresh бэкапов
- [ ] Проверить свободное место на диске

### Ежемесячно  
- [ ] Протестировать восстановление из monthly бэкапа
- [ ] Проверить целостность случайного бэкапа
- [ ] Обновить документацию при изменениях

### Ежеквартально
- [ ] Полный тест disaster recovery
- [ ] Проверка cloud sync (если настроен)
- [ ] Ревизия retention policy

---

## 🔗 Связанные документы

- [ARCHITECTURE.md](../ARCHITECTURE.md) — общая архитектура
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — команды разработчика
- [MONITOR_GUIDE.md](./MONITOR_GUIDE.md) — мониторинг системы
- [SECURITY_PLAN_V2.md](../SECURITY_PLAN_V2.md) — план безопасности

---

*Создан: Декабрь 2024. Система бэкапов v2.0 с GFS ротацией и верификацией.*