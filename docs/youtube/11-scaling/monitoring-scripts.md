# Cluster Management Scripts

## Health Check and Monitoring Scripts

### Comprehensive Health Check Script

```bash
#!/bin/bash
# cluster-health-check.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOAD_BALANCERS=("10.0.0.10" "10.0.0.11")
APP_SERVERS=("10.0.1.10" "10.0.1.11" "10.0.1.12")
DB_SERVERS=("10.0.2.10" "10.0.2.11" "10.0.2.12")
REDIS_SERVERS=("10.0.4.10:7000" "10.0.4.11:7000" "10.0.4.12:7000")
ETCD_SERVERS=("10.0.3.10:2379" "10.0.3.11:2379" "10.0.3.12:2379")

# Slack webhook for alerts
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

send_alert() {
    local message="$1"
    local severity="$2"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 Crocodile Cluster Alert [$severity]: $message\"}" \
        "$SLACK_WEBHOOK" 2>/dev/null || true
}

check_load_balancers() {
    log "Checking Load Balancers..."
    
    for lb in "${LOAD_BALANCERS[@]}"; do
        if curl -f -s --max-time 5 "http://$lb/api/health" > /dev/null; then
            echo "✅ Load Balancer $lb is healthy"
        else
            error "Load Balancer $lb is down"
            send_alert "Load Balancer $lb is down" "CRITICAL"
            return 1
        fi
    done
}

check_app_servers() {
    log "Checking Application Servers..."
    
    healthy_count=0
    for app in "${APP_SERVERS[@]}"; do
        if curl -f -s --max-time 5 "http://$app:5000/api/health" > /dev/null; then
            echo "✅ App Server $app is healthy"
            ((healthy_count++))
        else
            error "App Server $app is down"
            send_alert "App Server $app is down" "HIGH"
        fi
    done
    
    if [ $healthy_count -eq 0 ]; then
        error "All application servers are down!"
        send_alert "All application servers are down!" "CRITICAL"
        return 1
    elif [ $healthy_count -lt ${#APP_SERVERS[@]} ]; then
        warn "$healthy_count/${#APP_SERVERS[@]} application servers are healthy"
    fi
}

check_database_cluster() {
    log "Checking PostgreSQL Cluster..."
    
    # Check Patroni API
    master_found=false
    for db in "${DB_SERVERS[@]}"; do
        response=$(curl -s --max-time 5 "http://$db:8008/master" 2>/dev/null || echo "")
        if [ "$response" = "postgres" ]; then
            echo "✅ PostgreSQL Master found on $db"
            master_found=true
        fi
        
        response=$(curl -s --max-time 5 "http://$db:8008/replica" 2>/dev/null || echo "")
        if [ "$response" = "postgres" ]; then
            echo "✅ PostgreSQL Replica on $db is healthy"
        fi
    done
    
    if [ "$master_found" = false ]; then
        error "No PostgreSQL master found!"
        send_alert "No PostgreSQL master found!" "CRITICAL"
        return 1
    fi
    
    # Check replication lag
    for db in "${DB_SERVERS[@]}"; do
        lag=$(psql -h "$db" -U crocodile -d crocodile_db -t -c "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()));" 2>/dev/null | xargs || echo "")
        if [[ "$lag" =~ ^[0-9]+\.?[0-9]*$ ]] && (( $(echo "$lag > 60" | bc -l) )); then
            warn "High replication lag on $db: ${lag}s"
            send_alert "High replication lag on $db: ${lag}s" "MEDIUM"
        fi
    done
}

check_redis_cluster() {
    log "Checking Redis Cluster..."
    
    for redis in "${REDIS_SERVERS[@]}"; do
        host=$(echo "$redis" | cut -d: -f1)
        port=$(echo "$redis" | cut -d: -f2)
        
        if redis-cli -h "$host" -p "$port" -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
            echo "✅ Redis node $redis is healthy"
            
            # Check cluster status
            cluster_state=$(redis-cli -h "$host" -p "$port" -a "$REDIS_PASSWORD" cluster info 2>/dev/null | grep "cluster_state:" | cut -d: -f2 | tr -d '\r')
            if [ "$cluster_state" != "ok" ]; then
                warn "Redis cluster state is not OK on $redis: $cluster_state"
                send_alert "Redis cluster state issue on $redis: $cluster_state" "MEDIUM"
            fi
        else
            error "Redis node $redis is down"
            send_alert "Redis node $redis is down" "HIGH"
        fi
    done
}

check_etcd_cluster() {
    log "Checking etcd Cluster..."
    
    for etcd in "${ETCD_SERVERS[@]}"; do
        if curl -f -s --max-time 5 "http://$etcd/health" > /dev/null; then
            echo "✅ etcd node $etcd is healthy"
        else
            error "etcd node $etcd is down"
            send_alert "etcd node $etcd is down" "HIGH"
        fi
    done
}

check_cluster_performance() {
    log "Checking Cluster Performance..."
    
    # Test load balancer response time
    for lb in "${LOAD_BALANCERS[@]}"; do
        response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 10 "http://$lb/api/health" 2>/dev/null || echo "timeout")
        if [ "$response_time" != "timeout" ]; then
            response_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
            if [ "$response_ms" -gt 1000 ]; then
                warn "High response time on LB $lb: ${response_ms}ms"
                send_alert "High response time on LB $lb: ${response_ms}ms" "MEDIUM"
            else
                echo "✅ LB $lb response time: ${response_ms}ms"
            fi
        fi
    done
}

generate_cluster_report() {
    log "Generating Cluster Status Report..."
    
    cat > /tmp/cluster-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Crocodile Cluster Status Report</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .healthy { color: green; }
        .warning { color: orange; }
        .error { color: red; }
        .section { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>Crocodile News Aggregator - Cluster Status</h1>
    <p>Generated: $(date)</p>
    
    <div class="section">
        <h2>Load Balancers</h2>
EOF

    for lb in "${LOAD_BALANCERS[@]}"; do
        if curl -f -s --max-time 5 "http://$lb/api/health" > /dev/null; then
            echo "        <p class=\"healthy\">✅ $lb - Healthy</p>" >> /tmp/cluster-report.html
        else
            echo "        <p class=\"error\">❌ $lb - Down</p>" >> /tmp/cluster-report.html
        fi
    done
    
    cat >> /tmp/cluster-report.html << EOF
    </div>
    
    <div class="section">
        <h2>Application Servers</h2>
EOF

    for app in "${APP_SERVERS[@]}"; do
        if curl -f -s --max-time 5 "http://$app:5000/api/health" > /dev/null; then
            echo "        <p class=\"healthy\">✅ $app - Healthy</p>" >> /tmp/cluster-report.html
        else
            echo "        <p class=\"error\">❌ $app - Down</p>" >> /tmp/cluster-report.html
        fi
    done
    
    echo "    </div>" >> /tmp/cluster-report.html
    echo "</body></html>" >> /tmp/cluster-report.html
    
    # Copy to web server
    cp /tmp/cluster-report.html /var/www/html/cluster-status.html 2>/dev/null || true
}

main() {
    log "Starting Crocodile Cluster Health Check..."
    
    exit_code=0
    
    check_load_balancers || exit_code=1
    check_app_servers || exit_code=1
    check_database_cluster || exit_code=1
    check_redis_cluster || exit_code=1
    check_etcd_cluster || exit_code=1
    check_cluster_performance
    
    generate_cluster_report
    
    if [ $exit_code -eq 0 ]; then
        log "✅ All cluster components are healthy"
    else
        error "❌ Some cluster components have issues"
    fi
    
    exit $exit_code
}

# Run health check
main "$@"
```

### Failover Simulation Script

```bash
#!/bin/bash
# failover-test.sh

set -e

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

test_app_server_failover() {
    log "Testing Application Server Failover..."
    
    # Stop one app server
    local target_server="10.0.1.10"
    log "Stopping app server $target_server"
    
    ssh deploy@$target_server "pm2 stop crocodile"
    
    # Test that load balancer routes around failed server
    for i in {1..10}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://10.0.0.10/api/health")
        if [ "$response" != "200" ]; then
            log "❌ Request $i failed with status $response"
        else
            log "✅ Request $i successful"
        fi
        sleep 1
    done
    
    # Restart the server
    log "Restarting app server $target_server"
    ssh deploy@$target_server "pm2 start crocodile"
    
    sleep 10
    log "App server failover test completed"
}

test_database_failover() {
    log "Testing Database Failover..."
    
    # Find current master
    local current_master=""
    for db in "10.0.2.10" "10.0.2.11" "10.0.2.12"; do
        response=$(curl -s "http://$db:8008/master" 2>/dev/null || echo "")
        if [ "$response" = "postgres" ]; then
            current_master=$db
            break
        fi
    done
    
    if [ -z "$current_master" ]; then
        log "❌ No master found"
        return 1
    fi
    
    log "Current master: $current_master"
    
    # Trigger switchover
    log "Triggering planned switchover..."
    curl -s -X POST "http://$current_master:8008/switchover" \
        -d '{"leader": "pg-slave-1"}' \
        -H "Content-Type: application/json"
    
    # Wait for switchover
    sleep 15
    
    # Verify new master
    local new_master=""
    for db in "10.0.2.10" "10.0.2.11" "10.0.2.12"; do
        response=$(curl -s "http://$db:8008/master" 2>/dev/null || echo "")
        if [ "$response" = "postgres" ]; then
            new_master=$db
            break
        fi
    done
    
    if [ "$new_master" != "$current_master" ]; then
        log "✅ Switchover successful: $current_master -> $new_master"
    else
        log "❌ Switchover failed"
        return 1
    fi
    
    log "Database failover test completed"
}

test_redis_failover() {
    log "Testing Redis Cluster Failover..."
    
    # Find a master node
    local master_node=""
    for redis in "10.0.4.10:7000" "10.0.4.11:7000" "10.0.4.12:7000"; do
        host=$(echo "$redis" | cut -d: -f1)
        port=$(echo "$redis" | cut -d: -f2)
        
        role=$(redis-cli -h "$host" -p "$port" -a "$REDIS_PASSWORD" info replication 2>/dev/null | grep "role:master" || echo "")
        if [ -n "$role" ]; then
            master_node=$redis
            break
        fi
    done
    
    if [ -z "$master_node" ]; then
        log "❌ No Redis master found"
        return 1
    fi
    
    log "Found Redis master: $master_node"
    
    # Set test data
    host=$(echo "$master_node" | cut -d: -f1)
    port=$(echo "$master_node" | cut -d: -f2)
    
    redis-cli -h "$host" -p "$port" -a "$REDIS_PASSWORD" set "test:failover" "before_failover" > /dev/null
    
    # Simulate node failure (stop Redis)
    log "Simulating Redis node failure..."
    ssh deploy@$host "sudo systemctl stop redis-server"
    
    # Wait for cluster to detect failure and promote slave
    sleep 10
    
    # Try to read data from cluster
    for redis in "10.0.4.10:7000" "10.0.4.11:7000" "10.0.4.12:7000"; do
        test_host=$(echo "$redis" | cut -d: -f1)
        test_port=$(echo "$redis" | cut -d: -f2)
        
        if [ "$redis" != "$master_node" ]; then
            value=$(redis-cli -h "$test_host" -p "$test_port" -a "$REDIS_PASSWORD" get "test:failover" 2>/dev/null || echo "")
            if [ "$value" = "before_failover" ]; then
                log "✅ Data accessible from $redis after failover"
                break
            fi
        fi
    done
    
    # Restart the failed node
    log "Restarting failed Redis node..."
    ssh deploy@$host "sudo systemctl start redis-server"
    
    sleep 10
    log "Redis failover test completed"
}

load_test_during_failover() {
    log "Running load test during failover..."
    
    # Start background load test
    ab -n 1000 -c 10 -s 60 "http://10.0.0.10/api/articles" > /tmp/load_test_before.txt 2>&1 &
    local load_test_pid=$!
    
    sleep 5
    
    # Trigger app server failover during load test
    test_app_server_failover
    
    # Wait for load test to complete
    wait $load_test_pid
    
    # Analyze results
    local rps_before=$(grep "Requests per second" /tmp/load_test_before.txt | awk '{print $4}')
    log "RPS during failover: $rps_before"
    
    # Run another load test after failover
    ab -n 1000 -c 10 "http://10.0.0.10/api/articles" > /tmp/load_test_after.txt 2>&1
    local rps_after=$(grep "Requests per second" /tmp/load_test_after.txt | awk '{print $4}')
    log "RPS after failover: $rps_after"
}

main() {
    log "Starting Crocodile Cluster Failover Tests..."
    
    test_app_server_failover
    echo
    test_database_failover
    echo
    test_redis_failover
    echo
    load_test_during_failover
    
    log "All failover tests completed"
}

# Run tests
main "$@"
```

### Performance Monitoring Script

```bash
#!/bin/bash
# cluster-performance-monitor.sh

METRICS_FILE="/var/log/cluster-metrics.log"
GRAFANA_WEBHOOK="http://grafana:3000/api/webhooks/cluster-metrics"

collect_metrics() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Load Balancer Metrics
    for lb in "10.0.0.10" "10.0.0.11"; do
        # Response time
        response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 10 "http://$lb/api/health" 2>/dev/null || echo "0")
        
        # Active connections
        active_conn=$(ssh root@$lb "netstat -an | grep :80 | grep ESTABLISHED | wc -l" 2>/dev/null || echo "0")
        
        echo "$timestamp,lb,$lb,response_time,$response_time" >> $METRICS_FILE
        echo "$timestamp,lb,$lb,active_connections,$active_conn" >> $METRICS_FILE
    done
    
    # Application Server Metrics
    for app in "10.0.1.10" "10.0.1.11" "10.0.1.12"; do
        # CPU and Memory usage
        cpu_usage=$(ssh deploy@$app "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d% -f1" 2>/dev/null || echo "0")
        mem_usage=$(ssh deploy@$app "free | grep Mem | awk '{printf \"%.2f\", \$3/\$2 * 100.0}'" 2>/dev/null || echo "0")
        
        # PM2 process status
        pm2_status=$(ssh deploy@$app "pm2 jlist | jq -r '.[] | select(.name==\"crocodile\") | .pm2_env.status'" 2>/dev/null || echo "unknown")
        
        # Node.js heap usage
        heap_usage=$(ssh deploy@$app "curl -s http://localhost:5000/api/metrics | jq -r '.memory.heapUsed'" 2>/dev/null || echo "0")
        
        echo "$timestamp,app,$app,cpu_usage,$cpu_usage" >> $METRICS_FILE
        echo "$timestamp,app,$app,memory_usage,$mem_usage" >> $METRICS_FILE
        echo "$timestamp,app,$app,heap_usage,$heap_usage" >> $METRICS_FILE
        echo "$timestamp,app,$app,pm2_status,$pm2_status" >> $METRICS_FILE
    done
    
    # Database Metrics
    for db in "10.0.2.10" "10.0.2.11" "10.0.2.12"; do
        # Connection count
        conn_count=$(psql -h $db -U crocodile -d crocodile_db -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "0")
        
        # Database size
        db_size=$(psql -h $db -U crocodile -d crocodile_db -t -c "SELECT pg_size_pretty(pg_database_size('crocodile_db'));" 2>/dev/null | xargs || echo "0")
        
        # Replication lag (for slaves)
        repl_lag=$(psql -h $db -U crocodile -d crocodile_db -t -c "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()));" 2>/dev/null | xargs || echo "0")
        
        echo "$timestamp,db,$db,connections,$conn_count" >> $METRICS_FILE
        echo "$timestamp,db,$db,size,$db_size" >> $METRICS_FILE
        echo "$timestamp,db,$db,replication_lag,$repl_lag" >> $METRICS_FILE
    done
    
    # Redis Metrics
    for redis in "10.0.4.10:7000" "10.0.4.11:7000" "10.0.4.12:7000"; do
        host=$(echo "$redis" | cut -d: -f1)
        port=$(echo "$redis" | cut -d: -f2)
        
        # Memory usage
        mem_used=$(redis-cli -h $host -p $port -a "$REDIS_PASSWORD" info memory 2>/dev/null | grep "used_memory:" | cut -d: -f2 | tr -d '\r' || echo "0")
        
        # Connected clients
        clients=$(redis-cli -h $host -p $port -a "$REDIS_PASSWORD" info clients 2>/dev/null | grep "connected_clients:" | cut -d: -f2 | tr -d '\r' || echo "0")
        
        # Operations per second
        ops=$(redis-cli -h $host -p $port -a "$REDIS_PASSWORD" info stats 2>/dev/null | grep "instantaneous_ops_per_sec:" | cut -d: -f2 | tr -d '\r' || echo "0")
        
        echo "$timestamp,redis,$redis,memory_used,$mem_used" >> $METRICS_FILE
        echo "$timestamp,redis,$redis,connected_clients,$clients" >> $METRICS_FILE
        echo "$timestamp,redis,$redis,ops_per_sec,$ops" >> $METRICS_FILE
    done
}

send_to_grafana() {
    # Send metrics to Grafana (if configured)
    if [ -n "$GRAFANA_WEBHOOK" ]; then
        tail -n 100 $METRICS_FILE | curl -X POST -H "Content-Type: application/json" \
            -d @- "$GRAFANA_WEBHOOK" 2>/dev/null || true
    fi
}

rotate_logs() {
    # Rotate metrics log if it gets too large (>100MB)
    if [ -f "$METRICS_FILE" ] && [ $(stat -f%z "$METRICS_FILE" 2>/dev/null || stat -c%s "$METRICS_FILE" 2>/dev/null || echo 0) -gt 104857600 ]; then
        mv "$METRICS_FILE" "${METRICS_FILE}.old"
        gzip "${METRICS_FILE}.old"
    fi
}

main() {
    collect_metrics
    send_to_grafana
    rotate_logs
}

# Run every minute via cron
main "$@"
```

### Cluster Scaling Script

```bash
#!/bin/bash
# cluster-scale.sh

scale_app_servers() {
    local action=$1  # "up" or "down"
    local count=${2:-1}
    
    case $action in
        "up")
            log "Scaling up application servers by $count instances"
            docker service scale crocodile_app=$(($(docker service ls --filter name=crocodile_app --format "{{.Replicas}}" | cut -d/ -f1) + count))
            ;;
        "down")
            log "Scaling down application servers by $count instances"
            current=$(docker service ls --filter name=crocodile_app --format "{{.Replicas}}" | cut -d/ -f1)
            new_count=$((current - count))
            if [ $new_count -lt 1 ]; then
                new_count=1
            fi
            docker service scale crocodile_app=$new_count
            ;;
    esac
}

auto_scale_based_on_load() {
    # Get average CPU usage across app servers
    total_cpu=0
    server_count=0
    
    for app in "10.0.1.10" "10.0.1.11" "10.0.1.12"; do
        cpu=$(ssh deploy@$app "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d% -f1" 2>/dev/null || echo "0")
        if [ "$cpu" != "0" ]; then
            total_cpu=$(echo "$total_cpu + $cpu" | bc -l)
            ((server_count++))
        fi
    done
    
    if [ $server_count -gt 0 ]; then
        avg_cpu=$(echo "scale=2; $total_cpu / $server_count" | bc -l)
        
        # Scale up if average CPU > 70%
        if (( $(echo "$avg_cpu > 70" | bc -l) )); then
            log "High CPU usage detected: $avg_cpu%. Scaling up..."
            scale_app_servers "up" 1
        # Scale down if average CPU < 30% and more than 2 instances
        elif (( $(echo "$avg_cpu < 30" | bc -l) )) && [ $server_count -gt 2 ]; then
            log "Low CPU usage detected: $avg_cpu%. Scaling down..."
            scale_app_servers "down" 1
        fi
    fi
}

main() {
    case ${1:-"auto"} in
        "up")
            scale_app_servers "up" ${2:-1}
            ;;
        "down")
            scale_app_servers "down" ${2:-1}
            ;;
        "auto")
            auto_scale_based_on_load
            ;;
        *)
            echo "Usage: $0 {up|down|auto} [count]"
            exit 1
            ;;
    esac
}

main "$@"
```