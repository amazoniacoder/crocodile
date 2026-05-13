import { promisify } from 'util';
import { exec } from 'child_process';
import { log } from '../vite';

const execPromise = promisify(exec);

/**
 * Checks if a port is in use and kills the process using it
 * @param port The port number to check and clear
 */
export async function clearPort(port: number): Promise<void> {
  try {
    // Find process using the port
    const findCommand = process.platform === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} | grep LISTEN`;
    
    const { stdout } = await execPromise(findCommand);
    
    if (stdout) {
      // Extract PID
      let pid: string | null = null;
      
      if (process.platform === 'win32') {
        const match = stdout.match(/LISTENING\s+(\d+)/);
        if (match && match[1]) {
          pid = match[1];
        }
      } else {
        const match = stdout.match(/\S+\s+(\d+)/);
        if (match && match[1]) {
          pid = match[1];
        }
      }
      
      if (pid) {
        // Kill the process
        const killCommand = process.platform === 'win32'
          ? `taskkill /F /PID ${pid}`
          : `kill -9 ${pid}`;
        
        await execPromise(killCommand);
        log(`Killed process ${pid} that was using port ${port}`);
      }
    }
  } catch (error) {
    // Ignore errors - port might not be in use
  }
}

/**
 * Finds an available port starting from the provided port
 * @param startPort The port to start checking from
 * @param maxAttempts Maximum number of ports to check
 * @returns Available port number
 */
export async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    try {
      const findCommand = process.platform === 'win32'
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port}`;
      
      const { stdout } = await execPromise(findCommand);
      
      if (!stdout) {
        return port;
      }
    } catch (error) {
      // Error means command failed, likely because port is not in use
      return port;
    }
  }
  
  // If we couldn't find an available port, return the original
  return startPort;
}