/**
 * Interface for Microsoft Teams operations
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface ITeamsAdapter {
  /**
   * Sends a message to a Teams channel
   * @param params - Message parameters
   */
  sendChannelMessage(params: {
    teamId: string;
    channelId: string;
    message: string;
    format?: 'text' | 'markdown';
    importance?: 'normal' | 'high' | 'urgent';
  }): Promise<void>;

  /**
   * Sends a notification about a new PR
   * @param params - PR notification parameters
   */
  sendPRNotification(params: {
    teamId: string;
    channelId: string;
    prUrl: string;
    prTitle: string;
    repository: string;
    bugTitle: string;
    workItemId?: number;
    fixSummary: string;
  }): Promise<void>;

  /**
   * Sends an error notification
   * @param params - Error notification parameters
   */
  sendErrorNotification(params: {
    teamId: string;
    channelId: string;
    errorMessage: string;
    errorId: string;
    stage: string;
  }): Promise<void>;

  /**
   * Lists available teams
   */
  listTeams(): Promise<
    Array<{
      id: string;
      displayName: string;
      description?: string;
    }>
  >;

  /**
   * Lists channels in a team
   * @param teamId - Team ID
   */
  listChannels(
    teamId: string
  ): Promise<
    Array<{
      id: string;
      displayName: string;
      description?: string;
    }>
  >;
}
