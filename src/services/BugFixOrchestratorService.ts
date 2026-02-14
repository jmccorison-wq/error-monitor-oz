import type {
  IDynamoDBAdapter,
  IDevOpsAdapter,
  IGitHubAdapter,
  ITeamsAdapter,
  IOzAdapter,
} from '../adapters/index.js';
import type {
  AuditLogError,
  FixResult,
  FixWorkflowStatus,
  FixWorkflowStage,
} from '../models/index.js';
import { mapErrorSeverityToBugPriority, mapErrorSeverityToBugSeverity } from '../models/index.js';
import { StackTraceParserService } from './StackTraceParserService.js';
import { RepositoryFinderService, type RepositoryInfo } from './RepositoryFinderService.js';
import { logger } from '../utils/logger.js';

interface OrchestratorConfig {
  teamsTeamId: string;
  teamsChannelId: string;
  devOpsProject?: string;
  ozEnvironmentId?: string;
}

/**
 * Orchestrates the complete bug fix workflow
 * Coordinates between all adapters to: detect errors -> create work items -> fix bugs -> create PRs -> notify team
 */
export class BugFixOrchestratorService {
  private readonly stackTraceParser: StackTraceParserService;
  private readonly repositoryFinder: RepositoryFinderService;

  constructor(
    private readonly dynamoAdapter: IDynamoDBAdapter,
    private readonly devOpsAdapter: IDevOpsAdapter,
    private readonly githubAdapter: IGitHubAdapter,
    private readonly teamsAdapter: ITeamsAdapter,
    private readonly ozAdapter: IOzAdapter,
    private readonly config: OrchestratorConfig
  ) {
    this.stackTraceParser = new StackTraceParserService();
    this.repositoryFinder = new RepositoryFinderService(githubAdapter);
  }

  /**
   * Processes all unprocessed errors
   */
  async processUnprocessedErrors(): Promise<FixResult[]> {
    logger.info('Starting error processing cycle');

    const errors = await this.dynamoAdapter.getUnprocessedErrors({
      severity: ['critical', 'error'],
      limit: 10, // Process in batches
    });

    logger.info(`Found ${errors.length} unprocessed errors`);

    const results: FixResult[] = [];

    for (const error of errors) {
      try {
        const result = await this.processError(error);
        results.push(result);
      } catch (err) {
        logger.error(`Failed to process error ${error.id}`, { error: err });
        await this.handleWorkflowError(error, 'processing', err as Error);
      }
    }

    logger.info(`Completed processing ${results.length} errors`);
    return results;
  }

  /**
   * Processes a single error through the complete workflow
   */
  async processError(error: AuditLogError): Promise<FixResult> {
    const startTime = new Date().toISOString();
    let status: FixWorkflowStatus = {
      stage: 'initializing',
      progress: 0,
      message: 'Starting error processing',
      startTime,
    };

    try {
      // Step 1: Parse the stack trace
      status = this.updateStatus(status, 'parsing_error', 10, 'Parsing stack trace');
      const stackTrace = this.stackTraceParser.parse(error.stackTrace, error.message);

      // Step 2: Find the repository
      const repoInfo = await this.repositoryFinder.findRepository(error, stackTrace);
      if (!repoInfo) {
        throw new Error(`Could not identify repository for error ${error.id}`);
      }

      // Step 3: Create DevOps bug work item and add to backlog
      status = this.updateStatus(status, 'creating_work_item', 20, 'Creating bug work item');
      const areaPath = this.determineAreaPath(error, repoInfo);
      const iterationPath = this.config.devOpsProject 
        ? `${this.config.devOpsProject}\\Backlog` 
        : undefined;
      const bugWorkItem = await this.devOpsAdapter.createBug({
        title: `[Auto-Fix] ${error.message.slice(0, 100)}`,
        description: this.formatBugDescription(error, stackTrace, repoInfo),
        reproSteps: `Stack trace:\n\`\`\`\n${error.stackTrace}\n\`\`\``,
        systemInfo: `Environment: ${error.environment}\nSource: ${error.source}\nRepository: ${repoInfo.fullName}`,
        priority: mapErrorSeverityToBugPriority(error.severity),
        severity: mapErrorSeverityToBugSeverity(error.severity),
        tags: [
          'auto-fix',
          'oz-agent',
          error.source,
          error.environment,
          repoInfo.name,
          stackTrace.language !== 'unknown' ? stackTrace.language : undefined,
        ].filter((tag): tag is string => Boolean(tag)),
        areaPath,
        iterationPath,
        relatedErrorId: error.id,
      });

      // Step 4: Create bug branch
      status = this.updateStatus(status, 'creating_branch', 40, 'Creating bug branch');
      const branchName = `bug/auto-fix-${error.id}`;
      await this.githubAdapter.createBranch(
        repoInfo.owner,
        repoInfo.name,
        branchName,
        repoInfo.defaultBranch
      );

      // Step 5: Run Oz agent to fix the bug
      status = this.updateStatus(status, 'running_oz_agent', 50, 'Running Oz agent to fix bug');
      const ozResult = await this.ozAdapter.fixBug({
        errorMessage: error.message,
        stackTrace,
        repository: repoInfo.fullName,
        branch: branchName,
        environmentId: this.config.ozEnvironmentId,
        context: `DevOps Work Item: ${bugWorkItem.id}`,
      });

      if (!ozResult.success) {
        throw new Error(`Oz agent failed to fix bug: ${ozResult.error}`);
      }

      // Step 6: Create draft pull request
      status = this.updateStatus(status, 'creating_pull_request', 80, 'Creating draft pull request');
      const pr = await this.githubAdapter.createPullRequest({
        owner: repoInfo.owner,
        repo: repoInfo.name,
        title: `[Auto-Fix] ${error.message.slice(0, 80)}`,
        body: this.formatPRDescription(error, stackTrace, bugWorkItem.id, ozResult.summary),
        head: branchName,
        base: repoInfo.defaultBranch,
        draft: true,
      });

      // Update work item with PR link
      await this.devOpsAdapter.linkPullRequest(bugWorkItem.id!, pr.url);
      await this.devOpsAdapter.addComment(
        bugWorkItem.id!,
        `Automated fix PR created: ${pr.url}\n\nFix summary: ${ozResult.summary}`
      );

      // Step 7: Notify team
      status = this.updateStatus(status, 'notifying_team', 90, 'Notifying team');
      await this.teamsAdapter.sendPRNotification({
        teamId: this.config.teamsTeamId,
        channelId: this.config.teamsChannelId,
        prUrl: pr.url,
        prTitle: pr.url,
        repository: repoInfo.fullName,
        bugTitle: error.message,
        workItemId: bugWorkItem.id,
        fixSummary: ozResult.summary,
      });

      // Step 8: Mark error as processed
      status = this.updateStatus(status, 'completed', 100, 'Completed');
      await this.dynamoAdapter.markAsProcessed(error.id, {
        workItemId: bugWorkItem.id,
        pullRequestUrl: pr.url,
        branch: branchName,
        ozRunId: ozResult.runId,
      });

      await this.dynamoAdapter.updateErrorWithFixInfo(error.id, {
        workItemId: bugWorkItem.id,
        pullRequestUrl: pr.url,
        branch: branchName,
        fixedAt: new Date().toISOString(),
      });

      return {
        success: true,
        errorId: error.id,
        repository: repoInfo.fullName,
        branch: branchName,
        modifiedFiles: ozResult.filesModified.map((f) => ({
          path: f,
          changeType: 'modified' as const,
          linesAdded: 0,
          linesRemoved: 0,
        })),
        pullRequestUrl: pr.url,
        pullRequestNumber: pr.number,
        workItemId: bugWorkItem.id,
        fixSummary: ozResult.summary,
        ozRunId: ozResult.runId,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error(`Workflow failed for error ${error.id}`, { error: err, stage: status.stage });

      await this.handleWorkflowError(error, status.stage, err as Error);

      return {
        success: false,
        errorId: error.id,
        repository: '',
        branch: '',
        modifiedFiles: [],
        fixSummary: '',
        errorMessage: (err as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private updateStatus(
    current: FixWorkflowStatus,
    stage: FixWorkflowStage,
    progress: number,
    message: string
  ): FixWorkflowStatus {
    logger.debug(`Workflow stage: ${stage} (${progress}%): ${message}`);
    return {
      ...current,
      stage,
      progress,
      message,
    };
  }

  private formatBugDescription(
    error: AuditLogError,
    stackTrace: ReturnType<StackTraceParserService['parse']>,
    repoInfo: RepositoryInfo
  ): string {
    const primaryFrame = stackTrace.frames.find((f) => f.isUserCode);

    return `
## Error Details
**Message:** ${error.message}
**Severity:** ${error.severity}
**Source:** ${error.source}
**Environment:** ${error.environment}
**Timestamp:** ${error.timestamp}

## Location
**Repository:** ${repoInfo.fullName}
**File:** ${primaryFrame?.filePath ?? 'Unknown'}
**Line:** ${primaryFrame?.lineNumber ?? 'Unknown'}
**Function:** ${primaryFrame?.functionName ?? 'Unknown'}

## Stack Trace
\`\`\`
${error.stackTrace}
\`\`\`

---
_This bug was automatically detected and reported by the error monitoring system._
    `.trim();
  }

  private formatPRDescription(
    error: AuditLogError,
    stackTrace: ReturnType<StackTraceParserService['parse']>,
    workItemId: number | undefined,
    fixSummary: string
  ): string {
    const primaryFrame = stackTrace.frames.find((f) => f.isUserCode);

    return `
## Bug Fix

### Error
${error.message}

### Location
- **File:** ${primaryFrame?.filePath ?? 'Unknown'}
- **Line:** ${primaryFrame?.lineNumber ?? 'Unknown'}
- **Function:** ${primaryFrame?.functionName ?? 'Unknown'}

### Fix Summary
${fixSummary}

### Related
${workItemId ? `- Work Item: #${workItemId}` : ''}
- Error ID: ${error.id}

---
_This PR was automatically generated by Warp Oz agent._

Co-Authored-By: Warp <agent@warp.dev>
    `.trim();
  }

  private async handleWorkflowError(
    error: AuditLogError,
    stage: string,
    err: Error
  ): Promise<void> {
    try {
      await this.teamsAdapter.sendErrorNotification({
        teamId: this.config.teamsTeamId,
        channelId: this.config.teamsChannelId,
        errorMessage: err.message,
        errorId: error.id,
        stage,
      });
    } catch (notifyErr) {
      logger.error('Failed to send error notification', { error: notifyErr });
    }
  }

  /**
   * Determines the appropriate area path based on error source and repository
   */
  private determineAreaPath(
    error: AuditLogError,
    repoInfo: RepositoryInfo
  ): string | undefined {
    const project = this.config.devOpsProject;
    if (!project) return undefined;

    // Map common service patterns to area paths
    const sourceToArea: Record<string, string> = {
      'user-service': 'User Management',
      'auth-service': 'Authentication',
      'api-gateway': 'API',
      'report-service': 'Reporting',
      'notification-service': 'Notifications',
      'payment-service': 'Payments',
      'order-service': 'Orders',
      'inventory-service': 'Inventory',
      'frontend': 'Frontend',
      'web': 'Frontend',
      'mobile': 'Mobile',
      'backend': 'Backend',
      'infrastructure': 'Infrastructure',
      'devops': 'DevOps',
    };

    // Check source mapping first
    const sourceLower = error.source.toLowerCase();
    for (const [pattern, area] of Object.entries(sourceToArea)) {
      if (sourceLower.includes(pattern)) {
        return `${project}\\${area}`;
      }
    }

    // Check repository name
    const repoLower = repoInfo.name.toLowerCase();
    for (const [pattern, area] of Object.entries(sourceToArea)) {
      if (repoLower.includes(pattern)) {
        return `${project}\\${area}`;
      }
    }

    // Default to project root area
    return project;
  }
}
