import { Observable, Subject, Subscription } from "rxjs";
import { observeNotification } from "rxjs/internal/Notification";

// returns response message if needed
type QueueFunction = () => Promise<string | void>;

interface QueueItem {
  fn: QueueFunction;
  priority: number;
  id: string;
  playerId: string;
  timeMs: number;
  subscription?: Subscription;
  cancelable: boolean;
  completed: boolean;
  observable: Observable<string | void>;
  finishedSubject: Subject<string | void>;
}

interface QueueResponse {
  success: boolean;
  cooldownMs?: number;
  finishedSubject?: Subject<string | void>;
}

const playerLastMoveMap = new Map<string, number>();
const PLAYER_MOVE_COOLDOWN_MS = 10;

let queue: QueueItem[] = [];
let processingQueueItem: QueueItem | null = null;

/**
 * Add a function to the queue
 * @param fn The async function to execute
 * @param priority Lower numbers = higher priority (0 is highest), default is 5
 * @param id Optional identifier for the task
 * @returns The ID of the queued function
 */
function addToQueue(fn: QueueFunction, playerId?: string, priority = 5, id?: string, cancelable = false): QueueResponse {
  console.log(id, priority, processingQueueItem?.id, processingQueueItem?.priority);
  if (priority < processingQueueItem?.priority && processingQueueItem?.cancelable) {
    console.log(`Cancelling current task ${processingQueueItem.id} for higher priority task.`);
    if (processingQueueItem.subscription == null) {
      throw new Error('Processing queue item has no subscription.');
    }
    processingQueueItem.subscription?.unsubscribe();
    processingQueueItem = null;
  }
  // console.log(`Attempt to add to queue... ${playerId}`);
  const taskId = id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // if taskId already exists return
  if (queue.some(item => item.id === taskId)) {
    return { success: false, cooldownMs: undefined };
  }

  if (playerId != null) {
    // console.log(`Queueing task ${taskId} for ${playerId} with priority ${priority}\n`);
    let playerLastMoveMs = playerLastMoveMap.get(playerId) || 0;
    // console.log(`Player ${playerId} last move was at ${playerLastMoveMs}\n`);
    let now = Date.now();
    let timeSinceLastMove = now - playerLastMoveMs;
    if (timeSinceLastMove < PLAYER_MOVE_COOLDOWN_MS) {
      // console.log(`Player ${playerId} is on cooldown. Skipping task ${taskId}`);
      return { success: false, cooldownMs: PLAYER_MOVE_COOLDOWN_MS - timeSinceLastMove };
    }
    playerLastMoveMap.set(playerId, now);
  }

  // console.log('pushing to queue...')

  let taskObservable = new Observable<string | void>((observer) => {
    fn().then(result => {
      observer.next(result);
      observer.complete();
    }).catch(error => {
      console.error('Error in queued function:', error);
      observer.error(error);
    })
  });

  // console.log('made observable...')

  let finishedSubject = new Subject<string | void>();

  // console.log('made subject...')

  queue.push({
    fn: fn,
    priority,
    id: taskId,
    playerId: playerId,
    timeMs: Date.now(),
    cancelable: cancelable,
    completed: false,
    observable: taskObservable,
    finishedSubject: finishedSubject
  });

  // Start processing the queue if it's not already running
  if (processingQueueItem == null) {
    setTimeout(() => {
      console.log('Starting queue processing...');
      processQueue();
    });
  }

  return { success: true, finishedSubject: finishedSubject };
}

/**
 * Add a low-priority function to the queue (will be executed last)
 * @param fn The async function to execute
 * @param id Optional identifier for the task
 * @returns The ID of the queued function
 */
function addLowPriority(fn: QueueFunction, playerId?: string, id?: string, cancelable = true): QueueResponse {
  return addToQueue(fn, playerId, 100, id, cancelable);
}

/**
 * Add a high-priority function to the queue (will be executed first)
 * @param fn The async function to execute
 * @param id Optional identifier for the task
 * @returns The ID of the queued function
 */
function addHighPriority(fn: QueueFunction, playerId?: string, id?: string, cancelable = false): QueueResponse {
  return addToQueue(fn, playerId, 0, id, cancelable);
}

/**
 * Process the queue one item at a time
 */
function processQueue() {
  console.log(`Processing queue... ${queue.length} items in queue.`);
  if (queue.length === 0) {
    processingQueueItem = null;
    return;
  }

  // Sort queue by priority (lower number = higher priority)
  queue.sort((a, b) => {
    if (a.priority === b.priority) {
      return a.timeMs - b.timeMs; // If same priority, sort by time added (FIFO)
    }
    return a.priority - b.priority;
  });
  

  const item = queue[0];
  processingQueueItem = item;

  console.log(`trying item ${item.id} with priority ${item.priority}`);

  try {
    item.subscription = item.observable.subscribe({
      next: (result) => {
        queue.shift(); // Remove the processed item from the queue
        processQueue();
        item.finishedSubject.next(result);
        item.finishedSubject.complete();
      },
      error: (error) => {
        console.error(`Error executing queued function ${item.id}:`, error);
        item.finishedSubject.error(error);
      }
    });
  } catch (error) {
    console.error(`Error executing queued function ${item.id}:`, error);
  }
}

/**
 * Clear all pending tasks from the queue
 */
function clearQueue(): void {
  queue = [];
}

/**
 * Remove a specific task from the queue by ID
 * @param id The ID of the task to remove
 * @returns true if the task was found and removed, false otherwise
 */
function removeFromQueue(id: string): boolean {
  const initialLength = queue.length;
  queue = queue.filter(item => item.id !== id);
  return initialLength !== queue.length;
}

/**
 * Get the current queue status
 * @returns Information about the current queue state
 */
function getQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
  currentlyRunning: string | null;
  pendingTasks: string[];
} {
  return {
    queueLength: queue.length,
    isProcessing: processingQueueItem != null,
    currentlyRunning: processingQueueItem?.id || null,
    pendingTasks: queue.map(item => item.id),
  };
}


export const queueService = {
  addToQueue,
  addLowPriority,
  addHighPriority,
  processQueue,
  clearQueue,
  removeFromQueue,
  getQueueStatus,
};