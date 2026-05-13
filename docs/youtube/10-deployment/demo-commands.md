# Deployment Demo Commands

## Native Deployment Commands

### Server Preparation
```bash
# Connect to server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential htop

# Create deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
su - deploy
```

### Install Dependencies
```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Should show v20.x.x

# Python for NER service
sudo apt install -y python3.11 python3.11-venv python3-pip

# PM2 process manager
sudo npm install -g pm2
```

### PostgreSQL Setup
```bash
# Install PostgreSQL 17
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-17

# Start and enable
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER crocodile WITH PASSWORD 'strong_password_here';
CREATE DATABASE crocodile_db OWNER crocodile;
GRANT ALL PRIVILEGES ON DATABASE crocodile_db TO crocodile;
\q
EOF

# Optimize for 4GB RAM
sudo tee -a /etc/postgresql/17/main/postgresql.conf << EOF
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 16MB
maintenance_work_mem = 128MB
max_connections = 50
EOF

sudo systemctl restart postgresql

# Test connection
psql -U crocodile -d crocodile_db -h localhost -c "SELECT version();"
```

### Redis Setup
```bash
# Install Redis
sudo apt install -y redis-server

# Configure
sudo tee /etc/redis/redis.conf << EOF
maxmemory 512mb
maxmemory-policy allkeys-lru
save ""
appendonly no
EOF

sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Test
redis-cli ping  # Should return PONG
```

### Application Deployment
```bash
# Upload code (from local machine)
rsync -avz --exclude='node_modules' \
  --exclude='.git' \
  --exclude='client/node_modules' \
  --exclude='dist' \
  --exclude='client/dist' \
  --exclude='logs' \
  D:/BlogPro/ deploy@your-server-ip:/home/deploy/app/

# On server: build application
cd /home/deploy/app
npm install
npm run build

# Verify build
ls dist/          # Should show index.js
ls client/dist/   # Should show index.html + assets/
```

### Environment Configuration
```bash
# Create .env file
cp .env.example .env
nano .env

# Generate tokens
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx web-push generate-vapid-keys
```

### Database Migration
```bash
# Run migrations
npx drizzle-kit migrate

# Verify tables
psql -U crocodile -d crocodile_db -h localhost -c "\dt"
# Should show 16+ tables
```

### PM2 Configuration
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'crocodile',
      script: '/home/deploy/app/dist/index.js',
      cwd: '/home/deploy/app',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1200M',
      env_file: '/home/deploy/app/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/deploy/app/logs/pm2-error.log',
      out_file: '/home/deploy/app/logs/pm2-out.log'
    },
    {
      name: 'ner-service',
      script: '/home/deploy/ner-service/venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 2',
      cwd: '/home/deploy/ner-service',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '600M'
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Execute the command that pm2 startup outputs

# Monitor
pm2 status
pm2 monit
```

### Nginx Setup
```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Create Nginx config
sudo tee /etc/nginx/sites-available/crocodile << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://your-domain.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.your-domain.com;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    return 301 https://your-domain.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /uploads {
        alias /home/deploy/app/public/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/crocodile /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## Docker Deployment Commands

### Prepare Docker Environment
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Deploy with Docker
```bash
# Upload code and Docker configs
rsync -avz --exclude='node_modules' --exclude='.git' \
  D:/BlogPro/ deploy@your-server-ip:/home/deploy/app/

# Create environment file
cd /home/deploy/app
cp .env.example .env.docker
nano .env.docker  # Configure for Docker

# Build and start services
docker-compose --env-file .env.docker up -d --build

# Check status
docker-compose ps
docker-compose logs -f app
```

### Docker Management Commands
```bash
# View logs
docker-compose logs -f app
docker-compose logs -f ner-service
docker-compose logs -f postgres

# Monitor resources
docker stats

# Scale services
docker-compose up -d --scale app=2

# Update application
docker-compose build app
docker-compose up -d --no-deps app

# Backup database
docker-compose exec postgres pg_dump -U crocodile crocodile_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U crocodile crocodile_db < backup.sql

# Clean up
docker system prune -f
docker volume prune -f
```

## Performance Testing Commands

### Load Testing
```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Test API endpoint
ab -n 10000 -c 100 https://your-domain.com/api/articles

# Test with keep-alive
ab -n 10000 -c 100 -k https://your-domain.com/api/health

# WebSocket test
npm install -g wscat
wscat -c wss://your-domain.com/ws
```

### Resource Monitoring
```bash
# System resources
htop
iotop
free -h
df -h

# Network connections
netstat -tulpn | grep :5000
ss -tulpn | grep :5000

# Process monitoring
ps aux --sort=-%mem | head -10
ps aux --sort=-%cpu | head -10

# PM2 monitoring (native)
pm2 monit
pm2 logs --lines 100

# Docker monitoring
docker stats --no-stream
docker inspect crocodile-app | jq '.[0].State'
```

### Database Performance
```bash
# PostgreSQL stats
psql -U crocodile -d crocodile_db -h localhost << EOF
SELECT schemaname,tablename,attname,n_distinct,correlation 
FROM pg_stats WHERE tablename = 'news_articles';

SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;
EOF

# Redis stats
redis-cli info memory
redis-cli info stats
```

## Troubleshooting Commands

### Common Issues
```bash
# Check service status
systemctl status postgresql
systemctl status redis-server
systemctl status nginx
pm2 status

# Check ports
sudo lsof -i :5000
sudo lsof -i :5432
sudo lsof -i :6379

# Check logs
tail -f /var/log/nginx/error.log
tail -f /home/deploy/app/logs/error.log
journalctl -u postgresql -f

# Test connections
curl http://localhost:5000/api/health
curl http://localhost:8001/health
psql -U crocodile -d crocodile_db -h localhost -c "SELECT 1;"
redis-cli ping
```

### Docker Troubleshooting
```bash
# Container health
docker-compose ps
docker inspect crocodile-app --format='{{.State.Health.Status}}'

# Container logs
docker-compose logs --tail=100 app
docker-compose logs --tail=50 postgres

# Enter container
docker-compose exec app sh
docker-compose exec postgres psql -U crocodile crocodile_db

# Network debugging
docker network ls
docker network inspect crocodile_crocodile-network
```

## Backup and Maintenance

### Automated Backups
```bash
# Create backup script
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f $BACKUP_DIR/crocodile_$DATE.dump

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
  -C /home/deploy app --exclude=node_modules --exclude=logs

# Cleanup old backups (keep 14 days)
find $BACKUP_DIR -name "*.dump" -mtime +14 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +14 -delete
EOF

chmod +x /home/deploy/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/deploy/backup.sh
```

### Update Procedures
```bash
# Native update
cd /home/deploy/app
git pull  # or rsync new code
npm install
npm run build
npx drizzle-kit migrate
pm2 reload crocodile  # Zero-downtime restart

# Docker update
docker-compose build app
docker-compose up -d --no-deps app
```