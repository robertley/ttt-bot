

interface QueueItem {
  fn: () => Promise<any>;
  priority: number;
  id: string;
}


  let queue: QueueItem[] = [];
  let isProcessing = false;
  let currentlyRunning: string | null = null;

  /**
   * Add a function to the queue
   * @param fn The async function to execute
   * @param priority Lower numbers = higher priority (0 is highest), default is 5
   * @param id Optional identifier for the task
   * @returns The ID of the queued function
   */
  function addToQueue(fn: () => Promise<any>, priority = 5, id?: string): string {
    const taskId = id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // if taskId already exists return
    if (queue.some(item => item.id === taskId)) {
      return taskId;
    }
    
    queue.push({
      fn,
      priority,
      id: taskId,
    });

    // Sort queue by priority (lower number = higher priority)
    queue.sort((a, b) => a.priority - b.priority);
    
    // Start processing the queue if it's not already running
    if (!isProcessing) {
      processQueue();
    }

    return taskId;
  }

  /**
   * Add a low-priority function to the queue (will be executed last)
   * @param fn The async function to execute
   * @param id Optional identifier for the task
   * @returns The ID of the queued function
   */
  function addLowPriority(fn: () => Promise<any>, id?: string): string {
    return addToQueue(fn, 100, id);
  }

  /**
   * Add a high-priority function to the queue (will be executed first)
   * @param fn The async function to execute
   * @param id Optional identifier for the task
   * @returns The ID of the queued function
   */
  function addHighPriority(fn: () => Promise<any>, id?: string): string {
    return addToQueue(fn, 0, id);
  }

  /**
   * Process the queue one item at a time
   */
  async function processQueue(): Promise<void> {
    if (queue.length === 0) {
      isProcessing = false;
      currentlyRunning = null;
      return;
    }

    isProcessing = true;
    const item = queue.shift();
    
    if (item) {
      currentlyRunning = item.id;
      
      try {
        await item.fn();
      } catch (error) {
        console.error(`Error executing queued function ${item.id}:`, error);
      } finally {
        currentlyRunning = null;
        // Continue processing the queue
        await processQueue();
      }
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
      isProcessing: isProcessing,
      currentlyRunning: currentlyRunning,
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