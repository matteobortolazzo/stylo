// stopwatch.ts
export class Stopwatch {
  private startTime: number;
  private isRunning: boolean;

  constructor() {
      this.startTime = 0;
      this.isRunning = false;
  }

  start(): void {
      if (!this.isRunning) {
          this.startTime = Date.now();
          this.isRunning = true;
      }
  }

  stop(): number {
      if (this.isRunning) {
          this.isRunning = false;
          return Date.now() - this.startTime;
      }
      return 0;
  }
}
