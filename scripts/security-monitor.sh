#!/bin/bash

# Security Monitoring Script for NewsAggregator
# Comprehensive security status check

set -e

echo "🛡️ NewsAggregator Security Status - $(date)"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    
    if [ "$status" = "OK" ]; then
        echo -e "  ${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "  ${YELLOW}⚠️  $message${NC}"
    elif [ "$status" = "ERROR" ]; then
        echo -e "  ${RED}❌ $message${NC}"
    else
        echo -e "  ${BLUE}ℹ️  $message${NC}"
    fi
}

# 1. System Services Status
echo ""
echo "🔧 System Services:"
for service in nginx fail2ban postgresql redis-server; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        print_status "OK" "$service is running"
    else
        print_status "ERROR" "$service is not running"
    fi
done

# 2. SSL Certificate Status
echo ""
echo "🔒 SSL Certificate:"
DOMAIN=${DOMAIN:-localhost}
if [ "$DOMAIN" != "localhost" ]; then
    if command -v openssl &> /dev/null; then
        CERT_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        if [ $? -eq 0 ]; then
            EXPIRY=$(echo "$CERT_INFO" | grep notAfter | cut -d= -f2)
            EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo "0")
            NOW_EPOCH=$(date +%s)
            DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
            
            if [ $DAYS_LEFT -gt 30 ]; then
                print_status "OK" "SSL certificate expires in $DAYS_LEFT days"
            elif [ $DAYS_LEFT -gt 7 ]; then
                print_status "WARNING" "SSL certificate expires in $DAYS_LEFT days"
            else
                print_status "ERROR" "SSL certificate expires in $DAYS_LEFT days!"
            fi
        else
            print_status "ERROR" "Cannot check SSL certificate"
        fi
    else
        print_status "WARNING" "OpenSSL not available for certificate check"
    fi
else
    print_status "INFO" "SSL check skipped (localhost domain)"
fi

# 3. Disk Usage
echo ""
echo "💾 Disk Usage:"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')

if [ "$DISK_USAGE" -lt 80 ]; then
    print_status "OK" "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_status "WARNING" "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
else
    print_status "ERROR" "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
fi

# 4. Memory Usage
echo ""
echo "🧠 Memory Usage:"
MEM_INFO=$(free -m)
MEM_TOTAL=$(echo "$MEM_INFO" | awk 'NR==2{print $2}')
MEM_USED=$(echo "$MEM_INFO" | awk 'NR==2{print $3}')
MEM_PERCENT=$(( MEM_USED * 100 / MEM_TOTAL ))

if [ "$MEM_PERCENT" -lt 80 ]; then
    print_status "OK" "Memory usage: ${MEM_PERCENT}% (${MEM_USED}MB / ${MEM_TOTAL}MB)"
elif [ "$MEM_PERCENT" -lt 90 ]; then
    print_status "WARNING" "Memory usage: ${MEM_PERCENT}% (${MEM_USED}MB / ${MEM_TOTAL}MB)"
else
    print_status "ERROR" "Memory usage: ${MEM_PERCENT}% (${MEM_USED}MB / ${MEM_TOTAL}MB)"
fi

# 5. Fail2Ban Status
echo ""
echo "🛡️ Fail2Ban Protection:"
if systemctl is-active --quiet fail2ban; then
    # Get jail status
    JAILS=$(fail2ban-client status 2>/dev/null | grep "Jail list" | cut -d: -f2 | tr ',' '\n' | wc -l)
    BANNED_IPS=0
    
    for jail in $(fail2ban-client status 2>/dev/null | grep "Jail list" | cut -d: -f2 | tr ',' '\n' | xargs); do
        JAIL_BANNED=$(fail2ban-client status "$jail" 2>/dev/null | grep "Currently banned" | awk '{print $4}')
        BANNED_IPS=$((BANNED_IPS + JAIL_BANNED))
    done
    
    print_status "OK" "Fail2Ban active with $JAILS jails, $BANNED_IPS IPs currently banned"
    
    # Recent bans (last 24h)
    RECENT_BANS=$(journalctl -u fail2ban --since "24 hours ago" 2>/dev/null | grep "Ban " | wc -l)
    if [ "$RECENT_BANS" -gt 50 ]; then
        print_status "WARNING" "$RECENT_BANS bans in last 24h (high activity)"
    else
        print_status "OK" "$RECENT_BANS bans in last 24h"
    fi
else
    print_status "ERROR" "Fail2Ban is not running"
fi

# 6. Nginx Security
echo ""
echo "🌐 Nginx Security:"
if systemctl is-active --quiet nginx; then
    # Check if Cloudflare IPs config exists
    if [ -f "/etc/nginx/cloudflare-ips.conf" ]; then
        CF_IPS=$(grep -c "allow" /etc/nginx/cloudflare-ips.conf 2>/dev/null || echo "0")
        print_status "OK" "Cloudflare IP whitelist active ($CF_IPS ranges)"
    else
        print_status "WARNING" "Cloudflare IP whitelist not configured"
    fi
    
    # Check rate limiting configuration
    if grep -q "limit_req_zone" /etc/nginx/sites-enabled/* 2>/dev/null; then
        print_status "OK" "Rate limiting configured"
    else
        print_status "WARNING" "Rate limiting not configured"
    fi
    
    # Check security headers
    if grep -q "add_header.*X-Frame-Options" /etc/nginx/sites-enabled/* 2>/dev/null; then
        print_status "OK" "Security headers configured"
    else
        print_status "WARNING" "Security headers not configured"
    fi
else
    print_status "ERROR" "Nginx is not running"
fi

# 7. Database Security
echo ""
echo "🗄️ Database Security:"
if systemctl is-active --quiet postgresql; then
    # Check if PostgreSQL is listening only on localhost
    PG_LISTEN=$(sudo -u postgres psql -t -c "SHOW listen_addresses;" 2>/dev/null | xargs)
    if [ "$PG_LISTEN" = "localhost" ] || [ "$PG_LISTEN" = "127.0.0.1" ]; then
        print_status "OK" "PostgreSQL listening on localhost only"
    else
        print_status "WARNING" "PostgreSQL listening on: $PG_LISTEN"
    fi
    
    # Check backup status
    if [ -d "/backups/daily" ]; then
        LATEST_BACKUP=$(ls -t /backups/daily/pg_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
            if [ "$BACKUP_AGE" -lt 25 ]; then  # Less than 25 hours
                print_status "OK" "Latest backup: ${BACKUP_AGE}h ago"
            else
                print_status "WARNING" "Latest backup: ${BACKUP_AGE}h ago (outdated)"
            fi
        else
            print_status "ERROR" "No backups found"
        fi
    else
        print_status "WARNING" "Backup directory not configured"
    fi
else
    print_status "ERROR" "PostgreSQL is not running"
fi

# 8. Network Security
echo ""
echo "🌐 Network Security:"

# Check open ports
OPEN_PORTS=$(ss -tuln | grep LISTEN | awk '{print $5}' | cut -d: -f2 | sort -n | uniq | tr '\n' ' ')
print_status "INFO" "Open ports: $OPEN_PORTS"

# Check for suspicious connections
SUSPICIOUS_CONNECTIONS=$(ss -tuln | grep -E ":(22|80|443|5000)" | wc -l)
print_status "INFO" "$SUSPICIOUS_CONNECTIONS active connections on main ports"

# 9. Log Analysis
echo ""
echo "📊 Security Log Analysis:"

# Check auth failures
AUTH_FAILURES=$(grep "authentication failure" /var/log/auth.log 2>/dev/null | grep "$(date +%b\ %d)" | wc -l)
if [ "$AUTH_FAILURES" -gt 10 ]; then
    print_status "WARNING" "$AUTH_FAILURES authentication failures today"
else
    print_status "OK" "$AUTH_FAILURES authentication failures today"
fi

# Check Nginx errors
NGINX_ERRORS=$(grep "$(date +%Y/%m/%d)" /var/log/nginx/error.log 2>/dev/null | wc -l)
if [ "$NGINX_ERRORS" -gt 50 ]; then
    print_status "WARNING" "$NGINX_ERRORS Nginx errors today"
else
    print_status "OK" "$NGINX_ERRORS Nginx errors today"
fi

# 10. Application Security
echo ""
echo "🚀 Application Security:"

# Check if NewsAggregator is running
if pgrep -f "node.*server" > /dev/null; then
    print_status "OK" "NewsAggregator application is running"
    
    # Check if admin API is accessible
    if curl -s -f "http://localhost:5000/api/health" > /dev/null 2>&1; then
        print_status "OK" "Health endpoint accessible"
    else
        print_status "WARNING" "Health endpoint not accessible"
    fi
else
    print_status "ERROR" "NewsAggregator application is not running"
fi

# Summary
echo ""
echo "📋 Security Summary:"
echo "  • Run this check regularly: ./security-monitor.sh"
echo "  • View detailed logs: journalctl -u fail2ban -f"
echo "  • Check Nginx status: systemctl status nginx"
echo "  • Monitor alerts: tail -f /var/log/fail2ban.log"
echo ""
echo "🔧 Quick fixes:"
echo "  • Restart service: sudo systemctl restart <service>"
echo "  • Unban IP: sudo fail2ban-unban.sh <ip>"
echo "  • Check SSL: openssl s_client -connect $DOMAIN:443"
echo "  • View backups: ls -la /backups/daily/"