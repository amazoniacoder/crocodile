/**
 * WebSocket Health Monitor
 * Ensures WebSocket connections remain stable and reconnect when needed
 */
class WebSocketHealthMonitor {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private websocketService: any = null;
  
  constructor(websocketService: any) {
    this.websocketService = websocketService;
  }
  
  /**
   * Start health monitoring
   */
  start() {
    if (this.healthCheckInterval) {
      return; // Already running
    }
    
    console.log('🏥 Starting WebSocket health monitoring');
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Stop health monitoring
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🏥 Stopped WebSocket health monitoring');
    }
  }
  
  /**
   * Perform health check
   */
  private performHealthCheck() {
    if (!this.websocketService) {
      return;
    }
    
    // Check if WebSocket should be connected for current route
    if (!this.websocketService.shouldEnableForCurrentRoute()) {
      return;
    }
    
    // Check connection status
    if (!this.websocketService.isConnected()) {
      console.log('🏥 WebSocket connection is down, attempting to reconnect');
      this.websocketService.connect();
    }
  }
}

export default WebSocketHealthMonitor;
