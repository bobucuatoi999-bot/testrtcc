const mediasoup = require('mediasoup');
const os = require('os');
const config = require('../config');
const { workerSettings } = require('./config');

/**
 * Mediasoup Worker Pool Manager
 * Manages worker processes for handling media processing
 */
class WorkerPool {
  constructor() {
    this.workers = [];
    this.nextWorkerIndex = 0;
  }

  /**
   * Initialize worker pool
   * Development: 2 workers
   * Production: 4 workers (or NUM_CPUS - 1, whichever is less)
   */
  async initialize() {
    const numWorkers = this.getWorkerCount();
    console.log(`🚀 Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      try {
        const worker = await mediasoup.createWorker(workerSettings);
        
        worker.on('died', () => {
          console.error(`❌ Worker ${worker.pid} died, exiting...`);
          process.exit(1);
        });

        this.workers.push(worker);
        console.log(`✅ Worker ${i + 1}/${numWorkers} created (PID: ${worker.pid})`);
      } catch (error) {
        console.error(`❌ Error creating worker ${i + 1}:`, error);
        throw error;
      }
    }

    console.log(`✅ Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Get number of workers based on environment
   */
  getWorkerCount() {
    if (config.NODE_ENV === 'development') {
      return 2;
    }

    const numCpus = os.cpus().length;
    const configuredWorkers = config.MEDIASOUP.NUM_WORKERS;
    return Math.min(configuredWorkers, numCpus - 1);
  }

  /**
   * Get next worker using round-robin
   */
  getNextWorker() {
    if (this.workers.length === 0) {
      throw new Error('No workers available');
    }

    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Get all workers
   */
  getWorkers() {
    return this.workers;
  }

  /**
   * Close all workers
   */
  async close() {
    console.log('🛑 Closing all workers...');
    await Promise.all(this.workers.map(worker => worker.close()));
    this.workers = [];
    console.log('✅ All workers closed');
  }
}

// Singleton instance
let workerPoolInstance = null;

function getWorkerPool() {
  if (!workerPoolInstance) {
    workerPoolInstance = new WorkerPool();
  }
  return workerPoolInstance;
}

module.exports = { WorkerPool, getWorkerPool };

