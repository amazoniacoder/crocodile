import { EventEmitter } from 'events';
import type { DomainEvent } from '../../domain/events/DomainEvent';
import type { ArticlesCollected } from '../../domain/events/ArticlesCollected';
import type { ClusterUpdated } from '../../domain/events/ClusterUpdated';

// ─── Реестр событий ──────────────────────────────────────────────────────────
// Добавить новое событие: 1) создать тип в domain/events/ 2) добавить строку сюда

interface EventMap {
  'articles.collected': ArticlesCollected;
  'cluster.updated':    ClusterUpdated;
  'source.updated':     { sourceId: number; changes: any; type: string; occurredAt: Date };
  'reaction.updated':   { articleId: number; type: string; occurredAt: Date };
}

type EventHandler<T extends DomainEvent> = (event: T) => void | Promise<void>;

// ─── Реализация ──────────────────────────────────────────────────────────────
// ТОЧКА ЗАМЕНЫ: при переходе на PM2 cluster mode заменить тело класса на
// Redis pub/sub (ioredis). Интерфейс emit/on остаётся неизменным —
// подписчики в application/ не потребуют правок.

class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(20);
  }

  emit<K extends keyof EventMap>(type: K, event: EventMap[K]): void {
    this.emitter.emit(type, event);
  }

  on<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.emitter.on(type, (event: EventMap[K]) => {
      Promise.resolve(handler(event)).catch(err =>
        console.error(`[EventBus] Unhandled error in handler for "${type}":`, err)
      );
    });
  }

  off<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.emitter.off(type, handler);
  }

  once<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.emitter.once(type, (event: EventMap[K]) => {
      Promise.resolve(handler(event)).catch(err =>
        console.error(`[EventBus] Unhandled error in once-handler for "${type}":`, err)
      );
    });
  }
}

export const eventBus = new EventBus();
export type { EventMap, EventHandler };
