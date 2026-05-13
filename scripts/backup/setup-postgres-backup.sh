#!/bin/bash

# PostgreSQL Backup Setup Script
# Implements Grandfather-Father-Son (GFS) rotation strategy

set -e

echo "🔧 Setting up PostgreSQL backup with GFS rotation..."

# Create backup directories
echo "📁 Creating backup directories..."
sudo mkdir -p /backups/{daily,weekly,monthly}
sudo chown postgres:postgres /backups -R
sudo chmod 750 /backups -R

# Create backup verification script
echo "📝 Creating backup verification script..."
sudo tee /usr/local/bin/backup-verify.sh > /dev/null << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/backup-verify.log"
ERROR_COUNT=0

echo "$(date): Starting backup verification" >> $LOG_FILE

# Check latest daily backup
LATEST_DAILY=$(ls -t /backups/daily/pg_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LATEST_DAILY" ]; then
    if gunzip -t "$LATEST_DAILY" 2>/dev/null; then
        echo "$(date): Daily backup OK: $LATEST_DAILY" >> $LOG_FILE
    else
        echo "$(date): ERROR: Daily backup corrupted: $LATEST_DAILY" >> $LOG_FILE
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
else
    echo "$(date): ERROR: No daily backups found" >> $LOG_FILE
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# Check backup size (should be > 1MB)
if [ -n "$LATEST_DAILY" ]; then
    SIZE=$(stat -c%s "$LATEST_DAILY" 2>/dev/null || echo "0")
    if [ "$SIZE" -lt 1048576 ]; then  # 1MB
        echo "$(date): WARNING: Backup size too small: $SIZE bytes" >> $LOG_FILE
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
fi

# Send alert if errors found
if [ $ERROR_COUNT -gt 0 ]; then
    echo "Backup verification failed. Check $LOG_FILE" | logger -t backup-verify
fi

echo "$(date): Verification completed with $ERROR_COUNT errors" >> $LOG_FILE
EOF

sudo chmod +x /usr/local/bin/backup-verify.sh
sudo chown postgres:postgres /usr/local/bin/backup-verify.sh

# Create cron jobs
echo "⏰ Setting up cron jobs..."
sudo tee /etc/cron.d/pg-backup > /dev/null << 'EOF'
# PostgreSQL Backup with GFS Rotation
# Daily backups (keep 7 days)
0 2 * * * postgres pg_dump crocodile_db | gzip > /backups/daily/pg_$(date +\%Y\%m\%d).sql.gz
5 2 * * * find /backups/daily -name "pg_*.sql.gz" -mtime +7 -delete

# Weekly backups (keep 4 weeks) - every Sunday
0 3 * * 0 postgres cp /backups/daily/pg_$(date +\%Y\%m\%d).sql.gz /backups/weekly/pg_week_$(date +\%Y_W\%U).sql.gz
5 3 * * 0 find /backups/weekly -name "pg_week_*.sql.gz" -mtime +28 -delete

# Monthly backups (keep 12 months) - 1st of each month
0 4 1 * * postgres cp /backups/daily/pg_$(date +\%Y\%m\%d).sql.gz /backups/monthly/pg_month_$(date +\%Y\%m).sql.gz
5 4 1 * * find /backups/monthly -name "pg_month_*.sql.gz" -mtime +365 -delete

# Backup verification every Monday at 5:00
0 5 * * 1 postgres /usr/local/bin/backup-verify.sh
EOF

# Create log file
sudo touch /var/log/backup-verify.log
sudo chown postgres:postgres /var/log/backup-verify.log

echo "✅ PostgreSQL backup setup completed!"
echo ""
echo "📊 Backup schedule:"
echo "  • Daily: Every day at 2:00 AM (keep 7 days)"
echo "  • Weekly: Every Sunday at 3:00 AM (keep 4 weeks)"
echo "  • Monthly: 1st of month at 4:00 AM (keep 12 months)"
echo "  • Verification: Every Monday at 5:00 AM"
echo ""
echo "📁 Backup locations:"
echo "  • Daily: /backups/daily/"
echo "  • Weekly: /backups/weekly/"
echo "  • Monthly: /backups/monthly/"
echo ""
echo "🔍 Check logs: tail -f /var/log/backup-verify.log"