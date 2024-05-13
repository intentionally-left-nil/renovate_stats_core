import * as core from '@actions/core';
import * as github from '@actions/github';
import type { Endpoints } from '@octokit/types';
import getClient from './client';
type PullRequest =
  Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][0];
type PullRequests = PullRequest[];

export type PullStat = {
  id: number;
  title: string;
  approvers: string[];
  createdAt: Date;
  mergedAt: Date | null;
  openFor: number;
  isOpen: boolean;
  isMerged: boolean;
};

async function getPRs(): Promise<PullRequests> {
  let createdAfter: Date | undefined;
  const createdAfterInput: string = core.getInput('createdAfter') ?? '';
  if (createdAfterInput) {
    createdAfter = new Date(createdAfterInput);
  }

  const client = getClient();
  const { owner, repo } = github.context.repo;
  let pulls = await client.paginate(client.pulls.list, {
    owner,
    repo,
    state: 'all',
    base: 'main'
  });
  pulls = pulls.filter(pull =>
    pull.labels.some(label => label.name === 'renovate')
  );

  if (createdAfter) {
    pulls = pulls.filter(pull => new Date(pull.created_at) > createdAfter);
  }
  return pulls;
}

async function getApprovers(pull: PullRequest): Promise<string[]> {
  const client = getClient();
  const { owner, repo } = github.context.repo;
  const reviews = await client.pulls.listReviews({
    owner,
    repo,
    pull_number: pull.number
  });
  const approvers = reviews.data
    .filter(review => review.state === 'APPROVED')
    .map(review => review.user?.login ?? '')
    .filter(Boolean);
  return approvers;
}

export default async function pullStats(): Promise<PullStat[]> {
  const prs = await getPRs();
  const stats: PullStat[] = [];
  for (const pr of prs) {
    const approvers = await getApprovers(pr);
    const createdAt = new Date(pr.created_at);
    const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
    const openFor = (mergedAt ?? new Date()).getTime() - createdAt.getTime();
    stats.push({
      id: pr.number,
      title: pr.title,
      approvers,
      createdAt,
      mergedAt,
      openFor,
      isOpen: pr.state === 'open',
      isMerged: pr.merged_at !== null
    });
  }
  return stats;
}
