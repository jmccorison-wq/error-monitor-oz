import OzAPI from 'oz-agent-sdk';
import type {
  IOzAdapter,
  OzMcpServerConfig,
  OzFixResult,
  OzRunStatus,
} from '../interfaces/index.js';
import type { StackTrace } from '../../models/index.js';

/**
 * Oz adapter implementation using the oz-agent-sdk
 */
export class OzAdapter implements IOzAdapter {
  private readonly client: OzAPI;
  private readonly defaultEnvironmentId?: string;

  constructor(config: { apiKey?: string; environmentId?: string }) {
    this.client = new OzAPI({
      apiKey: config.apiKey ?? process.env['WARP_API_KEY'],
    });
    this.defaultEnvironmentId = config.environmentId;
  }

  async fixBug(params: {
    errorMessage: string;
    stackTrace: StackTrace;
    repository: string;
    branch: string;
    context?: string;
    environmentId?: string;
    mcpServers?: Record<string, OzMcpServerConfig>;
  }): Promise<OzFixResult> {
    const prompt = this.buildFixPrompt(params);

    const response = await this.client.agent.run({
      prompt,
      config: {
        environment_id: params.environmentId ?? this.defaultEnvironmentId,
        name: `auto-fix-${params.repository.replace('/', '-')}`,
        mcp_servers: params.mcpServers as Record<
          string,
          {
            warp_id?: string;
            command?: string;
            args?: string[];
            env?: Record<string, string>;
            url?: string;
            headers?: Record<string, string>;
          }
        >,
      },
    });

    const runId = response.run_id ?? response.task_id ?? 'unknown';

    // Wait for completion and return result
    return this.waitForCompletion(runId, 300000); // 5 minute timeout
  }

  async getRunStatus(runId: string): Promise<OzRunStatus> {
    // The SDK may not have a direct status endpoint, so we'll simulate
    // In production, you'd use the actual SDK method
    return {
      runId,
      status: 'running',
      message: 'Agent is working on the fix',
      startedAt: new Date().toISOString(),
    };
  }

  async waitForCompletion(runId: string, timeoutMs = 300000): Promise<OzFixResult> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getRunStatus(runId);

      if (status.status === 'completed') {
        return {
          runId,
          success: true,
          summary: status.message ?? 'Fix completed successfully',
          filesModified: [],
          durationMs: Date.now() - startTime,
        };
      }

      if (status.status === 'failed') {
        return {
          runId,
          success: false,
          summary: 'Fix failed',
          filesModified: [],
          error: status.message,
          durationMs: Date.now() - startTime,
        };
      }

      if (status.status === 'cancelled') {
        return {
          runId,
          success: false,
          summary: 'Fix was cancelled',
          filesModified: [],
          error: 'Run cancelled',
          durationMs: Date.now() - startTime,
        };
      }

      await this.sleep(pollInterval);
    }

    return {
      runId,
      success: false,
      summary: 'Fix timed out',
      filesModified: [],
      error: `Timeout after ${timeoutMs}ms`,
      durationMs: Date.now() - startTime,
    };
  }

  async cancelRun(runId: string): Promise<void> {
    // The SDK may not have a cancel method, log for now
    console.log(`Cancelling run ${runId}`);
  }

  private buildFixPrompt(params: {
    errorMessage: string;
    stackTrace: StackTrace;
    repository: string;
    branch: string;
    context?: string;
  }): string {
    const primaryFrame = params.stackTrace.frames.find((f) => f.isUserCode);
    const fileInfo = primaryFrame
      ? `File: ${primaryFrame.filePath}${primaryFrame.lineNumber ? `:${primaryFrame.lineNumber}` : ''}`
      : '';

    const functionInfo = primaryFrame?.functionName
      ? `Function: ${primaryFrame.functionName}`
      : '';

    return `
Fix the following bug in the ${params.repository} repository on the ${params.branch} branch:

## Error
${params.errorMessage}

## Location
${fileInfo}
${functionInfo}

## Stack Trace
\`\`\`
${params.stackTrace.raw}
\`\`\`

${params.context ? `## Additional Context\n${params.context}` : ''}

## Instructions
1. Clone the repository if not already present
2. Checkout the ${params.branch} branch
3. Analyze the error and stack trace
4. Implement a fix for the bug
5. Ensure the fix doesn't break existing functionality
6. Commit the changes with a descriptive message

Please fix this bug and provide a summary of your changes.
    `.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
