import type { ITeamsAdapter } from '../interfaces/index.js';

interface MockMessage {
  teamId: string;
  channelId: string;
  message: string;
  format?: 'text' | 'markdown';
  importance?: 'normal' | 'high' | 'urgent';
  timestamp: string;
}

/**
 * Mock Teams adapter for testing and development
 */
export class MockTeamsAdapter implements ITeamsAdapter {
  private messages: MockMessage[] = [];
  private teams = [
    { id: 'team-1', displayName: 'Engineering', description: 'Engineering team' },
    { id: 'team-2', displayName: 'DevOps', description: 'DevOps team' },
  ];
  private channels = new Map([
    [
      'team-1',
      [
        { id: 'channel-1', displayName: 'General', description: 'General discussion' },
        { id: 'channel-2', displayName: 'Bugs', description: 'Bug tracking' },
      ],
    ],
    [
      'team-2',
      [
        { id: 'channel-3', displayName: 'General', description: 'General discussion' },
        { id: 'channel-4', displayName: 'Alerts', description: 'System alerts' },
      ],
    ],
  ]);

  async sendChannelMessage(params: {
    teamId: string;
    channelId: string;
    message: string;
    format?: 'text' | 'markdown';
    importance?: 'normal' | 'high' | 'urgent';
  }): Promise<void> {
    this.messages.push({
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  async sendPRNotification(params: {
    teamId: string;
    channelId: string;
    prUrl: string;
    prTitle: string;
    repository: string;
    bugTitle: string;
    workItemId?: number;
    fixSummary: string;
  }): Promise<void> {
    const message = `
🤖 **Automated Bug Fix PR Created**

**Repository:** ${params.repository}
**Bug:** ${params.bugTitle}
${params.workItemId ? `**Work Item:** #${params.workItemId}` : ''}

**Summary:** ${params.fixSummary}

[**View Pull Request →**](${params.prUrl})
    `.trim();

    await this.sendChannelMessage({
      teamId: params.teamId,
      channelId: params.channelId,
      message,
      format: 'markdown',
      importance: 'high',
    });
  }

  async sendErrorNotification(params: {
    teamId: string;
    channelId: string;
    errorMessage: string;
    errorId: string;
    stage: string;
  }): Promise<void> {
    const message = `
⚠️ **Auto-Fix Error**

**Error ID:** ${params.errorId}
**Stage:** ${params.stage}
**Message:** ${params.errorMessage}
    `.trim();

    await this.sendChannelMessage({
      teamId: params.teamId,
      channelId: params.channelId,
      message,
      format: 'markdown',
      importance: 'urgent',
    });
  }

  async listTeams(): Promise<
    Array<{ id: string; displayName: string; description?: string }>
  > {
    return this.teams;
  }

  async listChannels(
    teamId: string
  ): Promise<Array<{ id: string; displayName: string; description?: string }>> {
    return this.channels.get(teamId) ?? [];
  }

  // Helper methods for testing
  getMessages(): MockMessage[] {
    return [...this.messages];
  }

  getLastMessage(): MockMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  clear(): void {
    this.messages = [];
  }
}
