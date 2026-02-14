import { loadConfig, loadMockConfig, type AppConfig } from './config/index.js';
import {
  DynamoDBAdapter,
  MockDynamoDBAdapter,
  GitHubAdapter,
  MockGitHubAdapter,
  AzureDevOpsAdapter,
  MockDevOpsAdapter,
  TeamsAdapter,
  MockTeamsAdapter,
  OzAdapter,
  MockOzAdapter,
  type IDynamoDBAdapter,
  type IGitHubAdapter,
  type IDevOpsAdapter,
  type ITeamsAdapter,
  type IOzAdapter,
} from './adapters/index.js';
import { BugFixOrchestratorService } from './services/index.js';
import { logger } from './utils/logger.js';

/**
 * Creates adapters based on configuration
 */
function createAdapters(config: AppConfig): {
  dynamoAdapter: IDynamoDBAdapter;
  githubAdapter: IGitHubAdapter;
  devOpsAdapter: IDevOpsAdapter;
  teamsAdapter: ITeamsAdapter;
  ozAdapter: IOzAdapter;
} {
  if (config.app.useMockAdapters) {
    logger.info('Using mock adapters for development/testing');
    return {
      dynamoAdapter: new MockDynamoDBAdapter(),
      githubAdapter: new MockGitHubAdapter(),
      devOpsAdapter: new MockDevOpsAdapter(),
      teamsAdapter: new MockTeamsAdapter(),
      ozAdapter: new MockOzAdapter(),
    };
  }

  logger.info('Using production adapters');
  return {
    dynamoAdapter: new DynamoDBAdapter({
      region: config.aws.region,
      tableName: config.aws.dynamoTableName,
    }),
    githubAdapter: new GitHubAdapter({
      token: config.github.token,
    }),
    devOpsAdapter: new AzureDevOpsAdapter({
      organization: config.devOps.organization,
      project: config.devOps.project,
      pat: config.devOps.pat,
    }),
    teamsAdapter: new TeamsAdapter({
      accessToken: config.teams.accessToken,
    }),
    ozAdapter: new OzAdapter({
      apiKey: config.oz.apiKey,
      environmentId: config.oz.environmentId,
    }),
  };
}

/**
 * Main application class
 */
class ErrorMonitorApp {
  private orchestrator: BugFixOrchestratorService;
  private isRunning = false;
  private pollIntervalMs: number;

  constructor(config: AppConfig) {
    const adapters = createAdapters(config);

    this.orchestrator = new BugFixOrchestratorService(
      adapters.dynamoAdapter,
      adapters.devOpsAdapter,
      adapters.githubAdapter,
      adapters.teamsAdapter,
      adapters.ozAdapter,
      {
        teamsTeamId: config.teams.teamId,
        teamsChannelId: config.teams.channelId,
        devOpsProject: config.devOps.project,
        ozEnvironmentId: config.oz.environmentId,
      }
    );

    this.pollIntervalMs = config.app.pollIntervalMs;
  }

  /**
   * Runs a single processing cycle
   */
  async runOnce(): Promise<void> {
    logger.info('Running single error processing cycle');
    const results = await this.orchestrator.processUnprocessedErrors();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(`Processing complete: ${successful} successful, ${failed} failed`);

    for (const result of results) {
      if (result.success) {
        logger.info(`Fixed error ${result.errorId}`, {
          repository: result.repository,
          prUrl: result.pullRequestUrl,
          workItemId: result.workItemId,
        });
      } else {
        logger.error(`Failed to fix error ${result.errorId}`, {
          error: result.errorMessage,
        });
      }
    }
  }

  /**
   * Runs continuous monitoring with polling
   */
  async runContinuous(): Promise<void> {
    logger.info(`Starting continuous monitoring (poll interval: ${this.pollIntervalMs}ms)`);
    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.runOnce();
      } catch (error) {
        logger.error('Error during processing cycle', { error });
      }

      await this.sleep(this.pollIntervalMs);
    }

    logger.info('Monitoring stopped');
  }

  /**
   * Stops continuous monitoring
   */
  stop(): void {
    logger.info('Stopping error monitor');
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * CLI argument parsing
 */
function parseArgs(): { mode: 'once' | 'continuous' | 'mock'; help: boolean } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { mode: 'once', help: true };
  }

  if (args.includes('--mock') || args.includes('-m')) {
    return { mode: 'mock', help: false };
  }

  if (args.includes('--continuous') || args.includes('-c')) {
    return { mode: 'continuous', help: false };
  }

  return { mode: 'once', help: false };
}

function printHelp(): void {
  console.log(`
Error Monitor Oz - Automated Bug Detection and Fixing

Usage: npm run start [options]

Options:
  --once, -o        Run a single processing cycle (default)
  --continuous, -c  Run continuous monitoring with polling
  --mock, -m        Use mock adapters for testing
  --help, -h        Show this help message

Environment Variables:
  WARP_API_KEY          Warp API key for Oz agent
  AWS_REGION            AWS region
  DYNAMODB_TABLE_NAME   DynamoDB audit log table name
  AZURE_DEVOPS_ORG      Azure DevOps organization
  AZURE_DEVOPS_PROJECT  Azure DevOps project
  AZURE_DEVOPS_PAT      Azure DevOps personal access token
  GITHUB_TOKEN          GitHub personal access token
  TEAMS_ACCESS_TOKEN    Microsoft Teams access token
  TEAMS_TEAM_ID         Teams team ID
  TEAMS_CHANNEL_ID      Teams channel ID
  REDASH_URL            Redash base URL
  REDASH_API_KEY        Redash API key
  OZ_ENVIRONMENT_ID     Optional Oz environment ID
  USE_MOCK_ADAPTERS     Use mock adapters (true/false)
  POLL_INTERVAL_MS      Polling interval in milliseconds
  LOG_LEVEL             Logging level (debug, info, warn, error)

Example:
  # Run once with production adapters
  npm run start

  # Run continuous monitoring
  npm run start -- --continuous

  # Run with mock adapters for testing
  npm run start -- --mock
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { mode, help } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  try {
    const config = mode === 'mock' ? loadMockConfig() : loadConfig();
    const app = new ErrorMonitorApp(config);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      app.stop();
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      app.stop();
    });

    if (mode === 'continuous') {
      await app.runContinuous();
    } else {
      await app.runOnce();
    }
  } catch (error) {
    logger.error('Application error', { error });
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for programmatic use
export { ErrorMonitorApp, createAdapters, loadConfig, loadMockConfig };
