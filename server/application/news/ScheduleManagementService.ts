import * as nodeCron from 'node-cron';
import { sourceConfigRepository } from '../../infrastructure/persistence/SourceConfigRepository';

export interface ScheduleInfo {
  nextCycleAt: Date | null;
  nextFastCycleAt: Date | null;
  nextSlowCycleAt: Date | null;
  fastCronExpression: string;
  slowCronExpression: string;
  isRunning: boolean;
}

export interface CycleMetrics {
  lastCycleAt: Date | null;
  lastCycleDurationMs: number | null;
  cycleStartedAt: Date | null;
  currentSourceName: string | null;
  currentSourceIndex: number | null;
  totalSourcesInCycle: number;
}

/**
 * Сервис для управления расписанием сбора новостей с единственной ответственностью
 * 
 * Отвечает только за:
 * - Управление cron-задачами
 * - Парсинг cron-выражений
 * - Расчет времени следующего запуска
 * - Координацию расписания fast/slow источников
 */
export class ScheduleManagementService {
  private fastCronJob: nodeCron.ScheduledTask | null = null;
  private slowCronJob: nodeCron.ScheduledTask | null = null;
  private fastCronExpression = '* * * * *'; // каждую минуту по умолчанию
  private slowCronExpression = '*/5 * * * *'; // каждые 5 минут по умолчанию
  
  // Метрики текущего цикла
  private cycleMetrics: CycleMetrics = {
    lastCycleAt: null,
    lastCycleDurationMs: null,
    cycleStartedAt: null,
    currentSourceName: null,
    currentSourceIndex: null,
    totalSourcesInCycle: 0
  };
  
  private isRunning = false;

  /**
   * Инициализирует расписание из базы данных
   */
  async initialize(): Promise<void> {
    try {
      const fastCron = await sourceConfigRepository.get('fast_interval_cron');
      const slowCron = await sourceConfigRepository.get('slow_interval_cron');
      
      this.fastCronExpression = fastCron;
      this.slowCronExpression = slowCron;
      
      console.log(`📅 Schedule initialized (fast: ${fastCron}, slow: ${slowCron})`);
    } catch (error) {
      console.error('Failed to load cron expressions from database:', error);
      console.log('📅 Using default schedule (fast: */1, slow: */5)');
    }
  }

  /**
   * Запускает cron-задачи с заданными обработчиками
   */
  startSchedule(
    fastHandler: () => void | Promise<void>,
    slowHandler: () => void | Promise<void>
  ): void {
    this.stopSchedule();
    
    try {
      this.fastCronJob = nodeCron.schedule(this.fastCronExpression, () => {
        if (!this.isRunning) {
          fastHandler();
        }
      });
      
      this.slowCronJob = nodeCron.schedule(this.slowCronExpression, () => {
        if (!this.isRunning) {
          slowHandler();
        }
      });
      
      console.log(`📅 Schedule started (fast: ${this.fastCronExpression}, slow: ${this.slowCronExpression})`);
    } catch (error) {
      console.error('Failed to start schedule:', error);
    }
  }

  /**
   * Останавливает все cron-задачи
   */
  stopSchedule(): void {
    if (this.fastCronJob) {
      this.fastCronJob.stop();
      this.fastCronJob = null;
    }
    
    if (this.slowCronJob) {
      this.slowCronJob.stop();
      this.slowCronJob = null;
    }
    
    console.log('📅 Schedule stopped');
  }

  /**
   * Перезагружает расписание из базы данных
   */
  async reloadFromDatabase(
    fastHandler: () => void | Promise<void>,
    slowHandler: () => void | Promise<void>
  ): Promise<void> {
    await this.initialize();
    this.startSchedule(fastHandler, slowHandler);
  }

  /**
   * Обновляет cron-выражения и перезапускает расписание
   */
  updateSchedule(
    fastCron: string,
    slowCron: string,
    fastHandler: () => void | Promise<void>,
    slowHandler: () => void | Promise<void>
  ): void {
    this.fastCronExpression = fastCron;
    this.slowCronExpression = slowCron;
    this.startSchedule(fastHandler, slowHandler);
  }

  /**
   * Получает информацию о текущем расписании
   */
  getScheduleInfo(): ScheduleInfo {
    const now = new Date();
    
    return {
      nextCycleAt: this.getNextCycleTime(now),
      nextFastCycleAt: this.getNextRunTime(this.fastCronExpression, now),
      nextSlowCycleAt: this.getNextRunTime(this.slowCronExpression, now),
      fastCronExpression: this.fastCronExpression,
      slowCronExpression: this.slowCronExpression,
      isRunning: this.isRunning
    };
  }

  /**
   * Получает метрики текущего цикла
   */
  getCycleMetrics(): CycleMetrics {
    return { ...this.cycleMetrics };
  }

  /**
   * Начинает новый цикл сбора
   */
  startCycle(totalSources: number): void {
    this.isRunning = true;
    this.cycleMetrics.cycleStartedAt = new Date();
    this.cycleMetrics.totalSourcesInCycle = totalSources;
    this.cycleMetrics.currentSourceIndex = null;
    this.cycleMetrics.currentSourceName = null;
  }

  /**
   * Обновляет прогресс текущего цикла
   */
  updateCycleProgress(sourceIndex: number, sourceName: string): void {
    this.cycleMetrics.currentSourceIndex = sourceIndex;
    this.cycleMetrics.currentSourceName = sourceName;
  }

  /**
   * Завершает текущий цикл сбора
   */
  finishCycle(): void {
    if (this.cycleMetrics.cycleStartedAt) {
      this.cycleMetrics.lastCycleDurationMs = 
        Date.now() - this.cycleMetrics.cycleStartedAt.getTime();
    }
    
    this.cycleMetrics.lastCycleAt = new Date();
    this.cycleMetrics.cycleStartedAt = null;
    this.cycleMetrics.currentSourceName = null;
    this.cycleMetrics.currentSourceIndex = null;
    this.cycleMetrics.totalSourcesInCycle = 0;
    this.isRunning = false;
  }

  /**
   * Проверяет, выполняется ли сейчас цикл сбора
   */
  isCycleRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Вычисляет время следующего запуска из cron-выражения
   */
  private getNextRunTime(cronExpression: string, now: Date): Date | null {
    try {
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length < 5) return null;
      
      const minutePart = parts[0];
      const next = new Date(now);
      next.setSeconds(0, 0);

      if (minutePart === '*') {
        // Каждую минуту
        next.setMinutes(next.getMinutes() + 1);
        return next;
      }

      if (minutePart.startsWith('*/')) {
        // Интервал (например, */5)
        const interval = parseInt(minutePart.slice(2)) || 1;
        const currentMinute = now.getMinutes();
        const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
        
        next.setMinutes(nextMinute);
        if (next <= now) {
          next.setMinutes(next.getMinutes() + interval);
        }
        return next;
      }

      // Конкретная минута
      const exactMinute = parseInt(minutePart, 10);
      if (!Number.isNaN(exactMinute) && exactMinute >= 0 && exactMinute <= 59) {
        next.setMinutes(exactMinute);
        if (next <= now) {
          next.setHours(next.getHours() + 1);
        }
        return next;
      }

      return null;
    } catch (error) {
      console.error('Failed to parse cron expression:', cronExpression, error);
      return null;
    }
  }

  /**
   * Вычисляет ближайшее время следующего цикла (fast или slow)
   */
  private getNextCycleTime(now: Date): Date | null {
    const nextFast = this.getNextRunTime(this.fastCronExpression, now);
    const nextSlow = this.getNextRunTime(this.slowCronExpression, now);

    if (!nextFast && !nextSlow) return null;
    if (!nextFast) return nextSlow;
    if (!nextSlow) return nextFast;
    
    return nextFast <= nextSlow ? nextFast : nextSlow;
  }

  /**
   * Валидирует cron-выражение
   */
  validateCronExpression(expression: string): { valid: boolean; error?: string } {
    try {
      const parts = expression.trim().split(/\s+/);
      
      if (parts.length < 5) {
        return { valid: false, error: 'Cron expression must have at least 5 parts' };
      }

      // Простая валидация минут (первая часть)
      const minutePart = parts[0];
      
      if (minutePart === '*') return { valid: true };
      
      if (minutePart.startsWith('*/')) {
        const interval = parseInt(minutePart.slice(2));
        if (isNaN(interval) || interval <= 0 || interval > 59) {
          return { valid: false, error: 'Invalid minute interval' };
        }
        return { valid: true };
      }
      
      const minute = parseInt(minutePart, 10);
      if (isNaN(minute) || minute < 0 || minute > 59) {
        return { valid: false, error: 'Invalid minute value' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to parse cron expression' };
    }
  }
}

// Singleton instance
export const scheduleManagementService = new ScheduleManagementService();