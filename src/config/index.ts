import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
export interface AppConfig {
  // AWS/DynamoDB
  aws: {
    region: string;
    dynamoTableName: string;
  };

  // Azure DevOps
  devOps: {
    organization: string;
    project: string;
    pat: string;
  };

  // GitHub
  github: {
    token: string;
    organization?: string;
  };

  // Microsoft Teams
  teams: {
    accessToken: string;
    teamId: string;
    channelId: string;
  };

  // Redash
  redash: {
    baseUrl: string;
    apiKey: string;
  };

  // Warp Oz
  oz: {
    apiKey: string;
    environmentId?: string;
  };

  // Application settings
  app: {
    useMockAdapters: boolean;
    pollIntervalMs: number;
    maxErrorsPerCycle: number;
    logLevel: string;
  };
}

/**
 * Loads configuration from environment variables
 */
export function loadConfig(): AppConfig {
  return {
    aws: {
      region: getEnvRequired('AWS_REGION'),
      dynamoTableName: getEnvRequired('DYNAMODB_TABLE_NAME'),
    },
    devOps: {
      organization: getEnvRequired('AZURE_DEVOPS_ORG'),
      project: getEnvRequired('AZURE_DEVOPS_PROJECT'),
      pat: getEnvRequired('AZURE_DEVOPS_PAT'),
    },
    github: {
      token: getEnvRequired('GITHUB_TOKEN'),
      organization: getEnvOptional('GITHUB_ORG'),
    },
    teams: {
      accessToken: getEnvRequired('TEAMS_ACCESS_TOKEN'),
      teamId: getEnvRequired('TEAMS_TEAM_ID'),
      channelId: getEnvRequired('TEAMS_CHANNEL_ID'),
    },
    redash: {
      baseUrl: getEnvRequired('REDASH_URL'),
      apiKey: getEnvRequired('REDASH_API_KEY'),
    },
    oz: {
      apiKey: getEnvRequired('WARP_API_KEY'),
      environmentId: getEnvOptional('OZ_ENVIRONMENT_ID'),
    },
    app: {
      useMockAdapters: getEnvOptional('USE_MOCK_ADAPTERS') === 'true',
      pollIntervalMs: parseInt(getEnvOptional('POLL_INTERVAL_MS') ?? '60000', 10),
      maxErrorsPerCycle: parseInt(getEnvOptional('MAX_ERRORS_PER_CYCLE') ?? '10', 10),
      logLevel: getEnvOptional('LOG_LEVEL') ?? 'info',
    },
  };
}

/**
 * Loads configuration with mock adapters for development
 */
export function loadMockConfig(): AppConfig {
  return {
    aws: {
      region: 'us-east-1',
      dynamoTableName: 'mock-audit-log',
    },
    devOps: {
      organization: 'mock-org',
      project: 'mock-project',
      pat: 'mock-pat',
    },
    github: {
      token: 'mock-token',
      organization: 'mock-org',
    },
    teams: {
      accessToken: 'mock-token',
      teamId: 'mock-team',
      channelId: 'mock-channel',
    },
    redash: {
      baseUrl: 'https://mock-redash.example.com',
      apiKey: 'mock-api-key',
    },
    oz: {
      apiKey: 'mock-api-key',
      environmentId: 'mock-env',
    },
    app: {
      useMockAdapters: true,
      pollIntervalMs: 5000,
      maxErrorsPerCycle: 10,
      logLevel: 'debug',
    },
  };
}

function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    // In mock mode, return a placeholder
    if (process.env['USE_MOCK_ADAPTERS'] === 'true') {
      return `mock-${key.toLowerCase()}`;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}
