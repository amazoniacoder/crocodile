# Cluster Configuration Files

## Load Balancer Configuration

### Nginx Upstream with Health Checks

```nginx
# /etc/nginx/nginx.conf
events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Upstream app servers
    upstream app_servers {
        least_conn;
        server 10.0.1.10:5000 weight=3 max_fails=3 fail_timeout=30s;
        server 10.0.1.11:5000 weight=3 max_fails=3 fail_timeout=30s;
        server 10.0.1.12:5000 weight=2 max_fails=3 fail_timeout=30s;
        
        # Health check (nginx-plus feature, for open source use external script)
        # health_check interval=10s fails=3 passes=2 uri=/api/health;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=ws:10m rate=10r/m;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    
    server {
        listen 80;
        server_name crocodile.news www.crocodile.news;
        return 301 https://crocodile.news$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name crocodile.news;
        
        ssl_certificate /etc/letsencrypt/live/crocodile.news/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/crocodile.news/privkey.pem;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        
        # Rate limiting
        limit_conn conn_limit_per_ip 20;
        
        # Static files (served from shared storage)
        location /uploads {
            alias /shared/uploads;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # WebSocket with sticky sessions
        location /ws {
            limit_req zone=ws burst=5 nodelay;
            
            proxy_pass http://app_servers;
            ip_hash;  # Sticky sessions for WebSocket
            
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
        
        # API endpoints
        location /api {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://app_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Retry on failure
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
            proxy_next_upstream_tries 2;
            proxy_next_upstream_timeout 10s;
        }
        
        # SPA fallback
        location / {
            proxy_pass http://app_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Keepalived for Load Balancer HA

```bash
# /etc/keepalived/keepalived.conf (LB-1)
vrrp_script chk_nginx {
    script "/usr/bin/curl -f http://localhost/api/health || exit 1"
    interval 2
    weight -2
    fall 3
    rise 2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 110
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass your_password
    }
    virtual_ipaddress {
        10.0.0.100/24
    }
    track_script {
        chk_nginx
    }
    notify_master "/etc/keepalived/notify.sh MASTER"
    notify_backup "/etc/keepalived/notify.sh BACKUP"
    notify_fault "/etc/keepalived/notify.sh FAULT"
}
```

## PostgreSQL Cluster with Patroni

### Patroni Configuration (Master)

```yaml
# /etc/patroni/patroni.yml
scope: crocodile-cluster
name: pg-master-1
namespace: /crocodile/

restapi:
  listen: 0.0.0.0:8008
  connect_address: 10.0.2.10:8008
  authentication:
    username: patroni
    password: patroni_password

etcd:
  hosts: 10.0.3.10:2379,10.0.3.11:2379,10.0.3.12:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 30
    maximum_lag_on_failover: 1048576
    master_start_timeout: 300
    synchronous_mode: true
    synchronous_mode_strict: false
    synchronous_node_count: 1
    
    postgresql:
      use_pg_rewind: true
      use_slots: true
      
      parameters:
        # Performance
        max_connections: 200
        shared_buffers: 1GB
        effective_cache_size: 3GB
        work_mem: 32MB
        maintenance_work_mem: 256MB
        
        # Replication
        wal_level: replica
        max_wal_senders: 10
        max_replication_slots: 10
        wal_keep_size: 1GB
        hot_standby: on
        hot_standby_feedback: on
        
        # Logging
        log_destination: 'stderr'
        log_min_duration_statement: 1000
        log_checkpoints: on
        log_connections: on
        log_disconnections: on
        log_lock_waits: on
        
        # Checkpoints
        checkpoint_timeout: 15min
        checkpoint_completion_target: 0.9
        
  initdb:
    - encoding: UTF8
    - data-checksums
    
  pg_hba:
    - host replication replicator 10.0.2.0/24 md5
    - host all all 10.0.0.0/16 md5
    - host all all 0.0.0.0/0 reject
    
  users:
    crocodile:
      password: crocodile_password
      options:
        - createrole
        - createdb
    replicator:
      password: replicator_password
      options:
        - replication

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.2.10:5432
  data_dir: /var/lib/postgresql/17/main
  bin_dir: /usr/lib/postgresql/17/bin
  config_dir: /etc/postgresql/17/main
  pgpass: /var/lib/postgresql/.pgpass
  
  authentication:
    replication:
      username: replicator
      password: replicator_password
    superuser:
      username: postgres
      password: postgres_password
      
  parameters:
    unix_socket_directories: '/var/run/postgresql'
    
  create_replica_methods:
    - basebackup
    
  basebackup:
    checkpoint: 'fast'
    max-rate: '100M'
    
tags:
  nofailover: false
  noloadbalance: false
  clonefrom: false
  nosync: false
```

### HAProxy for PostgreSQL Load Balancing

```bash
# /etc/haproxy/haproxy.cfg
global
    maxconn 4096
    log stdout local0
    
defaults
    mode tcp
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option tcplog
    
# PostgreSQL Master (writes)
listen postgres_master
    bind *:5000
    option httpchk GET /master
    http-check expect status 200
    default-server inter 3s fall 3 rise 2
    server pg-master-1 10.0.2.10:5432 check port 8008
    server pg-master-2 10.0.2.11:5432 check port 8008 backup
    server pg-master-3 10.0.2.12:5432 check port 8008 backup
    
# PostgreSQL Slaves (reads)
listen postgres_slaves
    bind *:5001
    balance roundrobin
    option httpchk GET /replica
    http-check expect status 200
    default-server inter 3s fall 3 rise 2
    server pg-slave-1 10.0.2.11:5432 check port 8008
    server pg-slave-2 10.0.2.12:5432 check port 8008
    server pg-master-1 10.0.2.10:5432 check port 8008 backup
    
# Stats page
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
```

## Redis Cluster Configuration

### Redis Cluster Setup Script

```bash
#!/bin/bash
# setup-redis-cluster.sh

# Redis nodes configuration
NODES=(
    "10.0.4.10:7000"
    "10.0.4.11:7000" 
    "10.0.4.12:7000"
    "10.0.4.10:7001"
    "10.0.4.11:7001"
    "10.0.4.12:7001"
)

# Create cluster
redis-cli --cluster create ${NODES[@]} \
    --cluster-replicas 1 \
    --cluster-yes

# Verify cluster
redis-cli --cluster check 10.0.4.10:7000

# Show cluster info
redis-cli -c -h 10.0.4.10 -p 7000 cluster info
redis-cli -c -h 10.0.4.10 -p 7000 cluster nodes
```

### Redis Node Configuration

```bash
# /etc/redis/redis-7000.conf
port 7000
cluster-enabled yes
cluster-config-file nodes-7000.conf
cluster-node-timeout 15000
cluster-announce-ip 10.0.4.10
cluster-announce-port 7000
cluster-announce-bus-port 17000

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (disabled for cache)
save ""
appendonly no

# Security
requirepass cluster_password
masterauth cluster_password

# Network
bind 0.0.0.0
protected-mode no
tcp-keepalive 300

# Logging
loglevel notice
logfile /var/log/redis/redis-7000.log
```

## Application Cluster Configuration

### Database Connection Manager

```typescript
// src/database/cluster-manager.ts
import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface DatabaseNode {
  host: string;
  port: number;
  role: 'master' | 'slave';
  pool: Pool;
  healthy: boolean;
}

export class DatabaseClusterManager extends EventEmitter {
  private nodes: Map<string, DatabaseNode> = new Map();
  private masterNode: DatabaseNode | null = null;
  private slaveNodes: DatabaseNode[] = [];
  
  constructor(private config: {
    nodes: Array<{ host: string; port: number; role: 'master' | 'slave' }>;
    database: string;
    username: string;
    password: string;
  }) {
    super();
    this.initializeNodes();
    this.startHealthChecks();
  }
  
  private initializeNodes() {
    this.config.nodes.forEach(nodeConfig => {
      const pool = new Pool({
        host: nodeConfig.host,
        port: nodeConfig.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      
      const node: DatabaseNode = {
        ...nodeConfig,
        pool,
        healthy: true
      };
      
      this.nodes.set(`${nodeConfig.host}:${nodeConfig.port}`, node);
      
      if (nodeConfig.role === 'master') {
        this.masterNode = node;
      } else {
        this.slaveNodes.push(node);
      }
    });
  }
  
  async write(query: string, params?: any[]): Promise<any> {
    if (!this.masterNode || !this.masterNode.healthy) {
      throw new Error('No healthy master node available');
    }
    
    try {
      return await this.masterNode.pool.query(query, params);
    } catch (error) {
      this.emit('error', { type: 'write', node: this.masterNode, error });
      throw error;
    }
  }
  
  async read(query: string, params?: any[]): Promise<any> {
    const healthySlaves = this.slaveNodes.filter(node => node.healthy);
    
    if (healthySlaves.length === 0) {
      // Fallback to master for reads
      return this.write(query, params);
    }
    
    // Round-robin selection
    const selectedNode = healthySlaves[Math.floor(Math.random() * healthySlaves.length)];
    
    try {
      return await selectedNode.pool.query(query, params);
    } catch (error) {
      this.emit('error', { type: 'read', node: selectedNode, error });
      // Retry on master
      return this.write(query, params);
    }
  }
  
  private startHealthChecks() {
    setInterval(async () => {
      for (const [nodeId, node] of this.nodes) {
        try {
          await node.pool.query('SELECT 1');
          if (!node.healthy) {
            node.healthy = true;
            this.emit('nodeRecovered', node);
          }
        } catch (error) {
          if (node.healthy) {
            node.healthy = false;
            this.emit('nodeDown', node);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }
}
```

### Redis Cluster Manager

```typescript
// src/cache/redis-cluster-manager.ts
import { Cluster } from 'ioredis';
import { EventEmitter } from 'events';

export class RedisClusterManager extends EventEmitter {
  private cluster: Cluster;
  private isConnected = false;
  
  constructor(private nodes: Array<{ host: string; port: number }>) {
    super();
    this.initializeCluster();
  }
  
  private initializeCluster() {
    this.cluster = new Cluster(this.nodes, {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 5000,
        lazyConnect: true,
      },
      enableOfflineQueue: false,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      scaleReads: 'slave',
      readOnly: false,
    });
    
    this.cluster.on('connect', () => {
      this.isConnected = true;
      this.emit('connected');
    });
    
    this.cluster.on('error', (error) => {
      this.emit('error', error);
    });
    
    this.cluster.on('node error', (error, node) => {
      this.emit('nodeError', { error, node });
    });
    
    this.cluster.on('failover', (error, address) => {
      this.emit('failover', { error, address });
    });
  }
  
  async set(key: string, value: string, ttl?: number): Promise<string | null> {
    if (!this.isConnected) {
      await this.cluster.connect();
    }
    
    if (ttl) {
      return this.cluster.setex(key, ttl, value);
    }
    return this.cluster.set(key, value);
  }
  
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      await this.cluster.connect();
    }
    
    return this.cluster.get(key);
  }
  
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isConnected) {
      await this.cluster.connect();
    }
    
    return this.cluster.mget(...keys);
  }
  
  async del(key: string): Promise<number> {
    if (!this.isConnected) {
      await this.cluster.connect();
    }
    
    return this.cluster.del(key);
  }
  
  async getClusterInfo(): Promise<any> {
    return {
      nodes: await this.cluster.cluster('nodes'),
      info: await this.cluster.cluster('info'),
      slots: await this.cluster.cluster('slots'),
    };
  }
}
```

## Docker Compose for Full Cluster

```yaml
# docker-compose.cluster.yml
version: '3.8'

services:
  # Load Balancers
  nginx-lb-1:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/cluster.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    networks:
      - frontend
    deploy:
      placement:
        constraints: [node.labels.role == lb]
        
  # Application Servers
  app-1:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://crocodile:password@postgres-master:5000/crocodile_db
      - DATABASE_READ_URL=postgres://crocodile:password@postgres-slaves:5001/crocodile_db
      - REDIS_CLUSTER_NODES=redis-1:7000,redis-2:7000,redis-3:7000
    networks:
      - frontend
      - backend
    deploy:
      replicas: 3
      placement:
        constraints: [node.labels.role == app]
        
  # PostgreSQL Master
  postgres-master:
    image: postgres:17
    environment:
      - POSTGRES_DB=crocodile_db
      - POSTGRES_USER=crocodile
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_master_data:/var/lib/postgresql/data
    networks:
      - backend
    deploy:
      placement:
        constraints: [node.labels.role == db-master]
        
  # PostgreSQL Slaves
  postgres-slave:
    image: postgres:17
    environment:
      - PGUSER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_MASTER_SERVICE=postgres-master
    networks:
      - backend
    deploy:
      replicas: 2
      placement:
        constraints: [node.labels.role == db-slave]
        
  # Redis Cluster Nodes
  redis-1:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf
    volumes:
      - ./redis/redis-7000.conf:/etc/redis/redis.conf
      - redis_1_data:/data
    networks:
      - backend
    deploy:
      placement:
        constraints: [node.labels.role == cache]

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    
volumes:
  postgres_master_data:
  redis_1_data:
```