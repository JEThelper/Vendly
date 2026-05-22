declare module 'opossum' {
  // Type definitions for opossum circuit breaker library
  import { EventEmitter } from 'events';

  interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
    fallback?: (...args: any[]) => any;
    name?: string;
    healthCheckInterval?: number;
    healthCheck?: () => Promise<any>;
    enabled?: boolean;
    semaphore?: number;
    maxConcurrentRequests?: number;
  }

  interface CircuitBreakerStats {
    fires: number;
    successes: number;
    failures: number;
    rejects: number;
    fires: number;
    fallbacks: number;
  }

  class CircuitBreaker extends EventEmitter {
    constructor(action: (...args: any[]) => Promise<any>, options?: CircuitBreakerOptions);
    fire(...args: any[]): Promise<any>;
    fallback(...args: any[]): any;
    close(): void;
    open(): void;
    halfOpen(): void;
    isOpen(): boolean;
    isClosed(): boolean;
    stats(): CircuitBreakerStats;
  }

  export = CircuitBreaker;
}

declare module 'uuid' {
  export function v4(): string;
  export interface V4Options {
    random?: number[];
    rng?: () => number[];
  }
}
