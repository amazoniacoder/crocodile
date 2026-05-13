/**
 * WebSocket Health Monitor
 * Monitors connection health and provides diagnostics
 */
export class WebSocketHealthMonitor {
  private connectionAttempts = 0;
  private lastSuccessfulConnection: number | null = null;
  private connectionErrors: string[] = [];
  private maxErrorHistory = 10;

  recordConnectionAttempt(): void {
    this.connectionAttempts++;
  }

  recordSuccessfulConnection(): void {
    this.lastSuccessfulConnection = Date.now();
    this.connectionErrors = []; // Clear errors on successful connection
  }

  recordConnectionError(error: string): void {
    this.connectionErrors.push(`${new Date().toISOString()}: ${error}`);
    
    // Keep only recent errors
    if (this.connectionErrors.length > this.maxErrorHistory) {
      this.connectionErrors = this.connectionErrors.slice(-this.maxErrorHistory);
    }
  }

  getHealthStatus(): {
    isHealthy: boolean;
    connectionAttempts: number;
    lastSuccessfulConnection: number | null;
    recentErrors: string[];
    timeSinceLastConnection: number | null;
  } {
    const timeSinceLastConnection = this.lastSuccessfulConnection 
      ? Date.now() - this.lastSuccessfulConnection 
      : null;

    const isHealthy = this.lastSuccessfulConnection !== null && 
                     (timeSinceLastConnection === null || timeSinceLastConnection < 60000) && // Less than 1 minute
                     this.connectionErrors.length < 3; // Less than 3 recent errors

    return {
      isHealthy,
      connectionAttempts: this.connectionAttempts,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      recentErrors: this.connectionErrors,
      timeSinceLastConnection
    };
  }

  reset(): void {
    this.connectionAttempts = 0;
    this.lastSuccessfulConnection = null;
    this.connectionErrors = [];
  }
}

export const websocketHealthMonitor = new WebSocketHealthMonitor();
