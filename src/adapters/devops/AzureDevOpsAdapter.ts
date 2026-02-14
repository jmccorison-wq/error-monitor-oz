import axios, { type AxiosInstance } from 'axios';
import type { IDevOpsAdapter } from '../interfaces/index.js';
import type { BugWorkItem, CreateBugInput } from '../../models/index.js';

/**
 * Azure DevOps adapter implementation
 */
export class AzureDevOpsAdapter implements IDevOpsAdapter {
  private readonly client: AxiosInstance;

  constructor(config: { organization: string; project: string; pat: string }) {

    const authHeader = Buffer.from(`:${config.pat}`).toString('base64');
    this.client = axios.create({
      baseURL: `https://dev.azure.com/${config.organization}/${config.project}/_apis`,
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json-patch+json',
      },
    });
  }

  async createBug(input: CreateBugInput): Promise<BugWorkItem> {
    const fields = [
      { op: 'add', path: '/fields/System.Title', value: input.title },
      { op: 'add', path: '/fields/System.Description', value: input.description },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
        value: input.reproSteps ?? '',
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.SystemInfo',
        value: input.systemInfo ?? '',
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: input.priority ?? 2,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Severity',
        value: input.severity ?? '2 - High',
      },
    ];

    if (input.tags && input.tags.length > 0) {
      fields.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: input.tags.join('; '),
      });
    }

    if (input.areaPath) {
      fields.push({ op: 'add', path: '/fields/System.AreaPath', value: input.areaPath });
    }

    if (input.iterationPath) {
      fields.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: input.iterationPath,
      });
    }

    if (input.assignedTo) {
      fields.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: input.assignedTo,
      });
    }

    const response = await this.client.post('/wit/workitems/$Bug?api-version=7.0', fields);

    return this.mapToWorkItem(response.data, input.relatedErrorId);
  }

  async updateBug(
    id: number,
    updates: Partial<Omit<BugWorkItem, 'id' | 'relatedErrorId'>>
  ): Promise<BugWorkItem> {
    const fields: Array<{ op: string; path: string; value: unknown }> = [];

    if (updates.title) {
      fields.push({ op: 'replace', path: '/fields/System.Title', value: updates.title });
    }
    if (updates.description) {
      fields.push({
        op: 'replace',
        path: '/fields/System.Description',
        value: updates.description,
      });
    }
    if (updates.priority) {
      fields.push({
        op: 'replace',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: updates.priority,
      });
    }
    if (updates.bugBranch) {
      fields.push({
        op: 'add',
        path: '/fields/Custom.BugBranch',
        value: updates.bugBranch,
      });
    }
    if (updates.pullRequestUrl) {
      fields.push({
        op: 'add',
        path: '/fields/Custom.PullRequestUrl',
        value: updates.pullRequestUrl,
      });
    }

    const response = await this.client.patch(
      `/wit/workitems/${id}?api-version=7.0`,
      fields
    );

    return this.mapToWorkItem(response.data, '');
  }

  async addComment(id: number, comment: string): Promise<void> {
    await this.client.post(`/wit/workitems/${id}/comments?api-version=7.0-preview.3`, {
      text: comment,
    });
  }

  async linkPullRequest(workItemId: number, prUrl: string): Promise<void> {
    const fields = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'ArtifactLink',
          url: prUrl,
          attributes: {
            name: 'Pull Request',
          },
        },
      },
    ];

    await this.client.patch(`/wit/workitems/${workItemId}?api-version=7.0`, fields);
  }

  async getWorkItem(id: number): Promise<BugWorkItem | null> {
    try {
      const response = await this.client.get(`/wit/workitems/${id}?api-version=7.0`);
      return this.mapToWorkItem(response.data, '');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async closeWorkItem(id: number, reason: string): Promise<void> {
    const fields = [
      { op: 'replace', path: '/fields/System.State', value: 'Closed' },
      { op: 'add', path: '/fields/Microsoft.VSTS.Common.ResolvedReason', value: reason },
    ];

    await this.client.patch(`/wit/workitems/${id}?api-version=7.0`, fields);
  }

  private mapToWorkItem(
    data: Record<string, unknown>,
    relatedErrorId: string
  ): BugWorkItem {
    const fields = data['fields'] as Record<string, unknown>;
    return {
      id: data['id'] as number,
      title: (fields['System.Title'] as string) ?? '',
      description: (fields['System.Description'] as string) ?? '',
      reproSteps: fields['Microsoft.VSTS.TCM.ReproSteps'] as string | undefined,
      systemInfo: fields['Microsoft.VSTS.TCM.SystemInfo'] as string | undefined,
      priority: (fields['Microsoft.VSTS.Common.Priority'] as 1 | 2 | 3 | 4) ?? 2,
      severity:
        (fields['Microsoft.VSTS.Common.Severity'] as BugWorkItem['severity']) ?? '2 - High',
      tags: ((fields['System.Tags'] as string) ?? '').split('; ').filter(Boolean),
      assignedTo: fields['System.AssignedTo'] as string | undefined,
      areaPath: fields['System.AreaPath'] as string | undefined,
      iterationPath: fields['System.IterationPath'] as string | undefined,
      relatedErrorId,
      bugBranch: fields['Custom.BugBranch'] as string | undefined,
      pullRequestUrl: fields['Custom.PullRequestUrl'] as string | undefined,
    };
  }
}
