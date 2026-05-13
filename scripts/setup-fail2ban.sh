#!/bin/bash

# Fail2Ban Setup Script for NewsAggregator
# Protects SSH and HTTP services from brute force attacks

set -e

echo "🛡️ Setting up Fail2Ban protection..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Install Fail2Ban
echo "📦 Installing Fail2Ban..."
apt update
apt install -y fail2ban

# Create custom configuration
echo "📝 Creating Fail2Ban configuration..."

# Main jail configuration
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Ban settings
bantime = 3600          # 1 hour ban
findtime = 600          # 10 minutes window
maxretry = 5            # 5 attempts before ban
backend = auto

# Ignore local IPs
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

# Email notifications (optional)
# destemail = admin@example.com
# sender = fail2ban@example.com
# mta = sendmail

# Action to take when banning
banaction = iptables-multiport
banaction_allports = iptables-allports

# Protocol
protocol = tcp

# Chain for iptables
chain = INPUT

# Log level
loglevel = INFO
logtarget = /var/log/fail2ban.log

#
# SSH Protection
#
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200          # 2 hours for SSH
findtime = 600

#
# Nginx HTTP Auth Protection
#
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 6
bantime = 1800          # 30 minutes

#
# Nginx Rate Limiting Protection
#
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600           # 10 minutes

#
# Nginx Bad Bots Protection
#
[nginx-badbots]
enabled = true
filter = nginx-badbots
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400         # 24 hours for bots

#
# Admin Panel Protection (custom)
#
[nginx-admin-auth]
enabled = true
filter = nginx-admin-auth
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 3
bantime = 3600          # 1 hour
findtime = 300          # 5 minutes

#
# DDoS Protection
#
[nginx-req-limit]
enabled = true
filter = nginx-req-limit
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 100
bantime = 300           # 5 minutes
findtime = 60           # 1 minute window
EOF

# Create custom filters
echo "🔍 Creating custom Fail2Ban filters..."

# Admin authentication filter
cat > /etc/fail2ban/filter.d/nginx-admin-auth.conf << 'EOF'
# Fail2Ban filter for Nginx admin authentication failures
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 401
            ^<HOST> -.*"(GET|POST|PUT|DELETE) /admin.*" 401
            ^<HOST> -.*"(GET|POST|PUT|DELETE) /api/admin.*" 403

ignoreregex =
EOF

# Bad bots filter
cat > /etc/fail2ban/filter.d/nginx-badbots.conf << 'EOF'
# Fail2Ban filter for bad bots and scanners
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*HTTP.*" (404|444) .*"(libwww-perl|wget|curl|nikto|sqlmap|nmap|masscan|zgrab)"
            ^<HOST> -.*"(GET|POST).*(\.php|\.asp|\.jsp|wp-admin|phpmyadmin|\.env|\.git).*" (404|403)
            ^<HOST> -.*"(GET|POST).*" (404|403) .*"(bot|crawler|spider|scraper)"

ignoreregex =
EOF

# Request limit filter
cat > /etc/fail2ban/filter.d/nginx-req-limit.conf << 'EOF'
# Fail2Ban filter for request flooding
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE).*" (200|301|302|304|404) \d+ ".*" ".*"$

ignoreregex = ^<HOST> -.*"(GET|POST|PUT|DELETE) /(api/health|favicon\.ico|robots\.txt).*"
EOF

# Create action for Cloudflare (if using Cloudflare)
cat > /etc/fail2ban/action.d/cloudflare.conf << 'EOF'
# Fail2Ban action for Cloudflare API
[Definition]
actionstart =
actionstop =
actioncheck =
actionban = curl -s -X POST "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules" \
            -H "X-Auth-Email: <cfuser>" \
            -H "X-Auth-Key: <cftoken>" \
            -H "Content-Type: application/json" \
            --data '{"mode":"block","configuration":{"target":"ip","value":"<ip>"},"notes":"Blocked by Fail2Ban"}'
actionunban = curl -s -X DELETE "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules/<id>" \
              -H "X-Auth-Email: <cfuser>" \
              -H "X-Auth-Key: <cftoken>"

[Init]
cfuser = your-email@example.com
cftoken = your-cloudflare-api-key
EOF

# Create systemd service override for better logging
mkdir -p /etc/systemd/system/fail2ban.service.d/
cat > /etc/systemd/system/fail2ban.service.d/override.conf << 'EOF'
[Service]
# Restart on failure
Restart=on-failure
RestartSec=5

# Better logging
StandardOutput=journal
StandardError=journal
EOF

# Create log rotation for fail2ban
cat > /etc/logrotate.d/fail2ban << 'EOF'
/var/log/fail2ban.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        systemctl reload fail2ban > /dev/null 2>&1 || true
    endrotate
}
EOF

# Enable and start Fail2Ban
echo "🚀 Starting Fail2Ban service..."
systemctl daemon-reload
systemctl enable fail2ban
systemctl restart fail2ban

# Wait a moment for service to start
sleep 2

# Check status
echo "📊 Checking Fail2Ban status..."
if systemctl is-active --quiet fail2ban; then
    echo "✅ Fail2Ban is running"
    
    # Show jail status
    echo ""
    echo "🔒 Active jails:"
    fail2ban-client status
    
    echo ""
    echo "📋 Jail details:"
    for jail in sshd nginx-http-auth nginx-limit-req nginx-badbots nginx-admin-auth nginx-req-limit; do
        if fail2ban-client status "$jail" &>/dev/null; then
            echo "  ✅ $jail: $(fail2ban-client status "$jail" | grep "Currently banned" | awk '{print $4}')"
        else
            echo "  ❌ $jail: not active"
        fi
    done
else
    echo "❌ Fail2Ban failed to start"
    systemctl status fail2ban
    exit 1
fi

# Create monitoring script
echo "📊 Creating Fail2Ban monitoring script..."
cat > /usr/local/bin/fail2ban-status.sh << 'EOF'
#!/bin/bash

# Fail2Ban Status Monitor
echo "🛡️ Fail2Ban Status Report - $(date)"
echo "=================================="

# Service status
if systemctl is-active --quiet fail2ban; then
    echo "✅ Service: Running"
else
    echo "❌ Service: Stopped"
    exit 1
fi

# Overall status
echo ""
echo "📊 Overall Status:"
fail2ban-client status

# Individual jail status
echo ""
echo "🔒 Jail Details:"
for jail in $(fail2ban-client status | grep "Jail list" | cut -d: -f2 | tr ',' '\n' | xargs); do
    status=$(fail2ban-client status "$jail")
    currently_failed=$(echo "$status" | grep "Currently failed" | awk '{print $4}')
    total_failed=$(echo "$status" | grep "Total failed" | awk '{print $4}')
    currently_banned=$(echo "$status" | grep "Currently banned" | awk '{print $4}')
    total_banned=$(echo "$status" | grep "Total banned" | awk '{print $4}')
    
    echo "  📋 $jail:"
    echo "    Failed: $currently_failed (total: $total_failed)"
    echo "    Banned: $currently_banned (total: $total_banned)"
done

# Recent bans
echo ""
echo "🚫 Recent Bans (last 24h):"
journalctl -u fail2ban --since "24 hours ago" | grep "Ban " | tail -10 | while read line; do
    echo "  $line"
done

# Log file size
echo ""
echo "📁 Log Files:"
echo "  Fail2Ban log: $(du -h /var/log/fail2ban.log 2>/dev/null | cut -f1 || echo "N/A")"
echo "  Auth log: $(du -h /var/log/auth.log 2>/dev/null | cut -f1 || echo "N/A")"
echo "  Nginx error log: $(du -h /var/log/nginx/error.log 2>/dev/null | cut -f1 || echo "N/A")"
EOF

chmod +x /usr/local/bin/fail2ban-status.sh

# Create unban script
cat > /usr/local/bin/fail2ban-unban.sh << 'EOF'
#!/bin/bash

# Fail2Ban Unban Script
if [ $# -eq 0 ]; then
    echo "Usage: $0 <IP_ADDRESS>"
    echo "Example: $0 192.168.1.100"
    exit 1
fi

IP="$1"

echo "🔓 Unbanning IP: $IP"

# Find which jails have banned this IP
banned_jails=()
for jail in $(fail2ban-client status | grep "Jail list" | cut -d: -f2 | tr ',' '\n' | xargs); do
    if fail2ban-client status "$jail" | grep -q "$IP"; then
        banned_jails+=("$jail")
    fi
done

if [ ${#banned_jails[@]} -eq 0 ]; then
    echo "❌ IP $IP is not banned in any jail"
    exit 1
fi

# Unban from all jails
for jail in "${banned_jails[@]}"; do
    echo "  🔓 Unbanning from $jail..."
    fail2ban-client set "$jail" unbanip "$IP"
done

echo "✅ IP $IP has been unbanned from ${#banned_jails[@]} jail(s)"
EOF

chmod +x /usr/local/bin/fail2ban-unban.sh

echo ""
echo "✅ Fail2Ban setup completed!"
echo ""
echo "📋 Useful commands:"
echo "  • Status: fail2ban-client status"
echo "  • Jail status: fail2ban-client status <jail-name>"
echo "  • Unban IP: fail2ban-unban.sh <ip>"
echo "  • Monitor: fail2ban-status.sh"
echo "  • Logs: journalctl -u fail2ban -f"
echo ""
echo "🔧 Configuration files:"
echo "  • Main config: /etc/fail2ban/jail.local"
echo "  • Custom filters: /etc/fail2ban/filter.d/"
echo "  • Log file: /var/log/fail2ban.log"