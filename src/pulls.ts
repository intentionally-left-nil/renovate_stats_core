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
  mergedBy: string | null;
  createdAt: Date;
  mergedAt: Date | null;
  openFor: number;
  isOpen: boolean;
  isMerged: boolean;
};

async function getPRs(): Promise<PullRequests> {
  let createdAfter: Date | undefined;
  const createdAfterInput: string = core.getInput('created_after') ?? '';
  if (createdAfterInput) {
    createdAfter = new Date(createdAfterInput);
  }

  const client = getClient();
  const { owner, repo } = github.context.repo;
  let pulls: PullRequests = [];
  for await (const response of client.paginate.iterator(client.pulls.list, {
    owner,
    repo,
    base: 'main',
    per_page: 100,
    state: 'all'
  })) {
    core.info(
      `Loaded PRs ${pulls.length + 1}-${pulls.length + response.data.length}...`
    );
    pulls = pulls.concat(response.data);
  }
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

export default async function getPullStats(): Promise<PullStat[]> {
  const prs = await getPRs();
  const stats: PullStat[] = [];
  const client = getClient();
  const { owner, repo } = github.context.repo;
  let i = 0;
  for (const pr of prs) {
    const details = await client.pulls.get({
      owner,
      repo,
      pull_number: pr.number
    });
    const mergedBy = details.data.merged_by?.login ?? null;
    if (i % 100 === 0) {
      core.info(`Processing PRs ${i + 1} / ${prs.length}...`);
    }
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
      mergedBy,
      openFor,
      isOpen: pr.state === 'open',
      isMerged: pr.merged_at !== null
    });
    i++;
  }
  return stats;
}
