# Error Monitor Oz

An automated error monitoring and bug fixing system powered by Warp Oz. This tool monitors AWS DynamoDB audit logs for errors, automatically creates bug work items in Azure DevOps, uses Warp Oz to fix bugs, creates pull requests, and notifies your team via Microsoft Teams.

## Features

- **Automated Error Detection**: Monitors DynamoDB audit log table for unprocessed errors
- **Stack Trace Parsing**: Parses stack traces from multiple languages (TypeScript, JavaScript, Python, Go, Java, C#, Ruby, Rust)
- **Repository Identification**: Automatically identifies the source repository from error context
- **DevOps Integration**: Creates bug work items in Azure DevOps with full context
- **AI-Powered Bug Fixes**: Uses Warp Oz agent to analyze and fix bugs
- **Automated PRs**: Creates pull requests with the fix and links them to work items
- **Team Notifications**: Posts notifications to Microsoft Teams channels
- **Mock Adapters**: Includes mock implementations for local development and testing

## Installation

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
```

## Usage

```bash
# Build
npm run build

# Run with mock adapters (development)
npm run start -- --mock

# Run once (production)
npm run start

# Run continuous monitoring
npm run start -- --continuous
```

## Running with Warp Oz

```bash
oz agent run-cloud --prompt "Monitor errors and fix bugs" --environment <ENV_ID>
```

## License

MIT