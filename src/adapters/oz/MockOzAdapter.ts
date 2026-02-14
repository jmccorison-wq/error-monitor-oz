import type {
  IOzAdapter,
  OzMcpServerConfig,
  OzFixResult,
  OzRunStatus,
} from '../interfaces/index.js';
import type { StackTrace } from '../../models/index.js';

interface MockRun {
  runId: string;
  status: OzRunStatus['status'];
  params: {
    errorMessage: string;
    repository: string;
    branch: string;
  };
  startTime: number;
}

/**
 * Mock Oz adapter for testing and development
 */
export class MockOzAdapter implements IOzAdapter {
  private runs: Map<string, MockRun> = new Map();
  private runCounter = 1;
  private simulateFailure = false;
  private simulatedDelay = 1000;

  async fixBug(params: {
    errorMessage: string;
    stackTrace: StackTrace;
    repository: string;
    branch: string;
    context?: string;
    environmentId?: string;
    mcpServers?: Record<string, OzMcpServerConfig>;
  }): Promise<OzFixResult> {
    const runId = `mock-run-${this.runCounter++}`;
    const startTime = Date.now();

    // Create the run record
    this.runs.set(runId, {
      runId,
      status: 'running',
      params: {
        errorMessage: params.errorMessage,
        repository: params.repository,
        branch: params.branch,
      },
      startTime,
    });

    // Simulate processing time
    await this.sleep(this.simulatedDelay);

    // Update status to completed
    const run = this.runs.get(runId);
    if (run) {
      run.status = this.simulateFailure ? 'failed' : 'completed';
    }

    const durationMs = Date.now() - startTime;

    if (this.simulateFailure) {
      return {
        runId,
        success: false,
        summary: 'Mock fix failed',
        filesModified: [],
        error: 'Simulated failure for testing',
        durationMs,
      };
    }

    // Generate mock fix result
    const primaryFrame = params.stackTrace.frames.find((f) => f.isUserCode);
    const fixedFile = primaryFrame?.filePath ?? 'src/unknown.ts';

    return {
      runId,
      success: true,
      summary: `Fixed ${params.errorMessage} in ${fixedFile} by adding null check and proper error handling`,
      filesModified: [fixedFile],
      commitSha: `mock-sha-${Date.now().toString(36)}`,
      durationMs,
    };
  }

  async getRunStatus(runId: string): Promise<OzRunStatus> {
    const run = this.runs.get(runId);

    if (!run) {
      return {
        runId,
        status: 'failed',
        message: 'Run not found',
        startedAt: new Date().toISOString(),
      };
    }

    return {
      runId: run.runId,
      status: run.status,
      message:
        run.status === 'completed'
          ? 'Fix completed successfully'
          : run.status === 'failed'
            ? 'Fix failed'
            : 'Working on fix...',
      startedAt: new Date(run.startTime).toISOString(),
      completedAt: run.status !== 'running' ? new Date().toISOString() : undefined,
    };
  }

  async waitForCompletion(runId: string, _timeoutMs?: number): Promise<OzFixResult> {
    const run = this.runs.get(runId);
    const durationMs = run ? Date.now() - run.startTime : 0;

    if (!run) {
      return {
        runId,
        success: false,
        summary: 'Run not found',
        filesModified: [],
        error: 'Run not found',
        durationMs,
      };
    }

    // Simulate waiting
    await this.sleep(100);

    return {
      runId,
      success: run.status === 'completed',
      summary:
        run.status === 'completed'
          ? `Fixed ${run.params.errorMessage}`
          : 'Fix failed',
      filesModified: run.status === 'completed' ? ['src/fixed-file.ts'] : [],
      commitSha: run.status === 'completed' ? `mock-sha-${Date.now()}` : undefined,
      error: run.status === 'failed' ? 'Simulated failure' : undefined,
      durationMs,
    };
  }

  async cancelRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'cancelled';
    }
  }

  // Helper methods for testing
  setSimulateFailure(value: boolean): void {
    this.simulateFailure = value;
  }

  setSimulatedDelay(ms: number): void {
    this.simulatedDelay = ms;
  }

  getRuns(): MockRun[] {
    return Array.from(this.runs.values());
  }

  clear(): void {
    this.runs.clear();
    this.runCounter = 1;
    this.simulateFailure = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
