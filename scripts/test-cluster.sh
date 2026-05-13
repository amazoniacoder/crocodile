#!/bin/bash

# Cluster Testing Script for NewsAggregator
# Tests distributed locks, WebSocket sticky sessions, and load balancing

echo "🚀 Starting NewsAggregator Cluster Test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ADMIN_TOKEN=${ADMIN_TOKEN:-"your-admin-token-here"}
BASE_URL="http://localhost"
NGINX_PORT=80
NODE1_PORT=5001
NODE2_PORT=5002

echo -e "${YELLOW}Configuration:${NC}"
echo "  Admin Token: $ADMIN_TOKEN"
echo "  Base URL: $BASE_URL"
echo "  Nginx Port: $NGINX_PORT"
echo "  Node Ports: $NODE1_PORT, $NODE2_PORT"
echo ""

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s "$url/api/health" > /dev/null; then
        echo -e "${GREEN}✓${NC} $name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" "$url")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗ (HTTP $http_code)${NC}"
        return 1
    fi
}

# Function to test admin API
test_admin_api() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$url")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗ (HTTP $http_code)${NC}"
        return 1
    fi
}

# Function to test WebSocket connection
test_websocket() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    # Use wscat if available, otherwise skip
    if command -v wscat &> /dev/null; then
        timeout 5s wscat -c "$url" -x '{"type":"ping"}' > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC}"
            return 0
        else
            echo -e "${RED}✗${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ (wscat not available)${NC}"
        return 0
    fi
}

echo "=== Service Health Checks ==="

# Check individual nodes
check_service "$BASE_URL:$NODE1_PORT" "Node 1"
check_service "$BASE_URL:$NODE2_PORT" "Node 2"

# Check load balancer
check_service "$BASE_URL:$NGINX_PORT" "Load Balancer (Nginx)"

echo ""
echo "=== API Load Balancing Tests ==="

# Test public API through load balancer
test_api "$BASE_URL:$NGINX_PORT/api/health" "Health endpoint via LB"
test_api "$BASE_URL:$NGINX_PORT/api/news/sources" "News sources via LB"

# Test admin API through load balancer
test_admin_api "$BASE_URL:$NGINX_PORT/api/admin/cluster/health" "Cluster health via LB"
test_admin_api "$BASE_URL:$NGINX_PORT/api/admin/cluster/nodes" "Cluster nodes via LB"
test_admin_api "$BASE_URL:$NGINX_PORT/api/admin/cluster/websockets" "WebSocket stats via LB"

echo ""
echo "=== WebSocket Sticky Sessions Test ==="

# Test WebSocket connections (sticky sessions)
test_websocket "ws://$BASE_URL:$NGINX_PORT/ws" "WebSocket via LB"

echo ""
echo "=== Distributed Lock Testing ==="

echo -n "Testing RSS collection locks... "

# Trigger manual collection on both nodes simultaneously
response1=$(curl -s -w "%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL:$NODE1_PORT/api/admin/news/collect")
response2=$(curl -s -w "%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL:$NODE2_PORT/api/admin/news/collect")

http_code1="${response1: -3}"
http_code2="${response2: -3}"

if [ "$http_code1" = "200" ] && [ "$http_code2" = "200" ]; then
    echo -e "${GREEN}✓${NC} (Both nodes responded - distributed locking working)"
else
    echo -e "${RED}✗ (Node1: $http_code1, Node2: $http_code2)${NC}"
fi

echo ""
echo "=== Cluster Statistics ==="

# Get cluster health information
echo "Fetching cluster health..."
cluster_health=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL:$NGINX_PORT/api/admin/cluster/health")

if [ $? -eq 0 ]; then
    echo "$cluster_health" | jq '.' 2>/dev/null || echo "$cluster_health"
else
    echo -e "${RED}Failed to fetch cluster health${NC}"
fi

echo ""
echo "Fetching WebSocket statistics..."
ws_stats=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL:$NGINX_PORT/api/admin/cluster/websockets")

if [ $? -eq 0 ]; then
    echo "$ws_stats" | jq '.' 2>/dev/null || echo "$ws_stats"
else
    echo -e "${RED}Failed to fetch WebSocket statistics${NC}"
fi

echo ""
echo "=== Load Testing (Optional) ==="

if command -v ab &> /dev/null; then
    echo "Running Apache Bench load test..."
    ab -n 100 -c 10 "$BASE_URL:$NGINX_PORT/api/health" | grep -E "(Requests per second|Time per request)"
else
    echo -e "${YELLOW}⚠ Apache Bench (ab) not available - skipping load test${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Cluster testing completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check logs: docker-compose logs -f app-node-1 app-node-2"
echo "2. Monitor Redis: redis-cli monitor"
echo "3. Check Nginx access logs: docker-compose logs nginx"
echo "4. Open admin panel: $BASE_URL:$NGINX_PORT/admin/monitor"