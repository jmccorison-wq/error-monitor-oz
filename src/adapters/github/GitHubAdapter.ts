import { Octokit } from '@octokit/rest';
import type { IGitHubAdapter } from '../interfaces/index.js';

/**
 * GitHub adapter implementation using Octokit
 */
export class GitHubAdapter implements IGitHubAdapter {
  private readonly octokit: Octokit;

  constructor(config: { token: string }) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranch?: string
  ): Promise<void> {
    // Get the source branch SHA
    const sourceBranch = fromBranch ?? (await this.getDefaultBranch(owner, repo));
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${sourceBranch}`,
    });

    // Create the new branch
    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
    });
  }

  async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string
  ): Promise<string> {
    // Get the current commit SHA
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const currentCommitSha = refData.object.sha;

    // Get the current tree
    const { data: commitData } = await this.octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await this.octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // Create a new tree
    const { data: newTree } = await this.octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message: `${commitMessage}\n\nCo-Authored-By: Warp <agent@warp.dev>`,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Update the branch reference
    await this.octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return newCommit.sha;
  }

  async createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ url: string; number: number }> {
    const { data: pr } = await this.octokit.pulls.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: `${params.body}\n\nCo-Authored-By: Warp <agent@warp.dev>`,
      head: params.head,
      base: params.base,
      draft: params.draft,
    });

    return {
      url: pr.html_url,
      number: pr.number,
    };
  }

  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getRepository(
    owner: string,
    repo: string
  ): Promise<{ defaultBranch: string; fullName: string; url: string } | null> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });
      return {
        defaultBranch: data.default_branch,
        fullName: data.full_name,
        url: data.html_url,
      };
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async searchRepositories(
    query: string
  ): Promise<Array<{ owner: string; name: string; fullName: string; url: string }>> {
    const { data } = await this.octokit.search.repos({ q: query, per_page: 10 });
    return data.items.map((item) => ({
      owner: item.owner?.login ?? '',
      name: item.name,
      fullName: item.full_name,
      url: item.html_url,
    }));
  }

  async getLatestCommit(
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ sha: string; message: string; author: string } | null> {
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: 1,
      });

      const commit = data[0];
      if (!commit) return null;

      return {
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name ?? 'Unknown',
      };
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repoInfo = await this.getRepository(owner, repo);
    return repoInfo?.defaultBranch ?? 'main';
  }
}
