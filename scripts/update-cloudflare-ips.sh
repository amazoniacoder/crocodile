#!/bin/bash

# Cloudflare IP Update Script
# Updates Nginx configuration with current Cloudflare IP ranges

set -e

NGINX_CF_CONFIG="/etc/nginx/cloudflare-ips.conf"
TEMP_FILE="/tmp/cloudflare-ips.tmp"

echo "🔄 Updating Cloudflare IP ranges..."

# Create temporary file
cat > "$TEMP_FILE" << 'EOF'
# Cloudflare IP Ranges - Auto-generated
# Last updated: $(date)

EOF

echo "📥 Downloading IPv4 ranges..."
curl -s https://www.cloudflare.com/ips-v4 | while read ip; do
    echo "allow $ip;" >> "$TEMP_FILE"
done

echo "📥 Downloading IPv6 ranges..."
curl -s https://www.cloudflare.com/ips-v6 | while read ip; do
    echo "allow $ip;" >> "$TEMP_FILE"
done

# Add deny all at the end
echo "deny all;" >> "$TEMP_FILE"

# Backup existing config
if [ -f "$NGINX_CF_CONFIG" ]; then
    cp "$NGINX_CF_CONFIG" "${NGINX_CF_CONFIG}.backup.$(date +%Y%m%d)"
fi

# Move new config
sudo mv "$TEMP_FILE" "$NGINX_CF_CONFIG"
sudo chown root:root "$NGINX_CF_CONFIG"
sudo chmod 644 "$NGINX_CF_CONFIG"

echo "✅ Cloudflare IP ranges updated"

# Test nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed!"
    echo "🔄 Restoring backup..."
    if [ -f "${NGINX_CF_CONFIG}.backup.$(date +%Y%m%d)" ]; then
        sudo mv "${NGINX_CF_CONFIG}.backup.$(date +%Y%m%d)" "$NGINX_CF_CONFIG"
        echo "✅ Backup restored"
    fi
    exit 1
fi

echo "📊 Current Cloudflare IP count:"
grep -c "allow" "$NGINX_CF_CONFIG" || echo "0"