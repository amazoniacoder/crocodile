import { db, type PendingAction } from './db';
import { getBrowserId } from './reactions';

const MAX_RETRIES = 3;

type ActionPayload =
  | { articleId: number; type: 'like' | 'dislike' }
  | { articleId: number; emotionId: string };

/** Добавляет действие в очередь IDB */
export async function enqueuePendingAction(
  type: PendingAction['type'],
  payload: ActionPayload,
): Promise<void> {
  try {
    await db.pendingActions.add({
      type,
      payload: payload as Record<string, unknown>,
      createdAt: Date.now(),
      retries: 0,
      status: 'pending',
    });
  } catch {
    // ignore IDB errors
  }
}

/** Отправляет одно действие на сервер */
async function sendAction(action: PendingAction): Promise<boolean> {
  const browserId = getBrowserId();
  try {
    if (action.type === 'react') {
      const { articleId, type } = action.payload as { articleId: number; type: string };
      const res = await fetch(`/api/news/${articleId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-browser-id': browserId },
        body: JSON.stringify({ type }),
      });
      return res.ok;
    }
    if (action.type === 'emotion') {
      const { articleId, emotionId } = action.payload as { articleId: number; emotionId: string };
      const res = await fetch(`/api/news/${articleId}/emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-browser-id': browserId },
        body: JSON.stringify({ emotionId }),
        cache: 'no-store',
      });
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}

/** Сбрасывает все pending-действия на сервер */
export async function flushPendingActions(): Promise<void> {
  let actions: PendingAction[];
  try {
    actions = await db.pendingActions.where('status').equals('pending').toArray();
  } catch {
    return;
  }
  if (!actions.length) return;

  for (const action of actions) {
    const ok = await sendAction(action);
    try {
      if (ok) {
        await db.pendingActions.delete(action.id!);
      } else {
        const retries = action.retries + 1;
        if (retries >= MAX_RETRIES) {
          await db.pendingActions.update(action.id!, { status: 'failed', retries });
        } else {
          await db.pendingActions.update(action.id!, { retries });
        }
      }
    } catch {
      // ignore
    }
  }
}

/** Регистрирует flush при событии online (fallback для iOS без Background Sync) */
export function flushOnOnline(): void {
  window.addEventListener('online', () => {
    flushPendingActions();
  });
  // Также при старте — вдруг есть накопленные действия
  if (navigator.onLine) {
    flushPendingActions();
  }
}
