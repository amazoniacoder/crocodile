#!/bin/bash

# Nginx Setup Script for NewsAggregator with Cloudflare
# Configures Nginx with security hardening and Cloudflare integration

set -e

DOMAIN="${1:-example.com}"
APP_PORT="${2:-5000}"
NGINX_AVAILABLE="/etc/nginx/sites-available/newsaggregator"
NGINX_ENABLED="/etc/nginx/sites-enabled/newsaggregator"

echo "🔧 Setting up Nginx for NewsAggregator..."
echo "📍 Domain: $DOMAIN"
echo "🔌 App Port: $APP_PORT"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    apt update
    apt install -y nginx
fi

# Create Cloudflare IPs configuration
echo "🌐 Setting up Cloudflare IP ranges..."
./update-cloudflare-ips.sh

# Backup existing default config
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "💾 Backing up default Nginx config..."
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup
fi

# Create main Nginx configuration
echo "📝 Creating Nginx configuration..."
cat > "$NGINX_AVAILABLE" << EOF
# NewsAggregator Nginx Configuration for Cloudflare
# Generated on $(date)

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=admin:10m rate=2r/s;
limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;

# Real IP configuration for Cloudflare
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers even for HTTP
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # Redirect all HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Hide server version
    server_tokens off;
    
    # Request size limits
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    
    # Timeouts
    client_body_timeout 10s;
    client_header_timeout 10s;
    keepalive_timeout 65s;
    send_timeout 10s;
    
    # Restrict to Cloudflare IPs only
    include /etc/nginx/cloudflare-ips.conf;
    
    # Block access to hidden files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Block access to sensitive files
    location ~* \\.(env|log|ini|conf|bak|old|tmp|sql)\$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Admin API - strict rate limiting
    location /api/admin/ {
        limit_req zone=admin burst=5 nodelay;
        
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
        
        # Security headers for admin
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
    }
    
    # Public API - moderate rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Static files
    location / {
        limit_req zone=general burst=50 nodelay;
        
        root /var/www/newsaggregator/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary "Accept-Encoding";
            
            # CORS for fonts
            location ~* \\.(woff|woff2|ttf|eot)\$ {
                add_header Access-Control-Allow-Origin "*";
            }
        }
        
        # PWA files - short cache
        location ~* \\.(webmanifest|json)\$ {
            expires 1h;
            add_header Cache-Control "public";
        }
        
        # Service Worker - no cache
        location = /sw.js {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
        }
    }
    
    # Health check endpoint
    location = /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable the site
echo "🔗 Enabling Nginx site..."
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

# Update main nginx.conf for security
echo "🔒 Updating main Nginx configuration..."
sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf

# Test configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Start/restart Nginx
    echo "🔄 Starting Nginx..."
    systemctl enable nginx
    systemctl restart nginx
    
    echo "✅ Nginx setup completed!"
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# Setup automatic Cloudflare IP updates
echo "⏰ Setting up automatic Cloudflare IP updates..."
cat > /etc/cron.d/cloudflare-ips << EOF
# Update Cloudflare IP ranges weekly
0 2 * * 0 root /path/to/update-cloudflare-ips.sh
EOF

echo ""
echo "📋 Next steps:"
echo "1. Install SSL certificate: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "2. Update /var/www/newsaggregator/dist with your built application"
echo "3. Configure Cloudflare DNS to point to this server"
echo "4. Test the setup: curl -I https://$DOMAIN"
echo ""
echo "🔧 Configuration files:"
echo "  • Nginx config: $NGINX_AVAILABLE"
echo "  • Cloudflare IPs: /etc/nginx/cloudflare-ips.conf"