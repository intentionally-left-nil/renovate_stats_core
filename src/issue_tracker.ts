import getClient from './client';
import * as github from '@actions/github';
import * as core from '@actions/core';
import type { Endpoints } from '@octokit/types';
type Issue =
  Endpoints['GET /repos/{owner}/{repo}/issues']['response']['data'][0];

async function getRenovateIssue(): Promise<Issue | undefined> {
  const client = getClient();
  const { owner, repo } = github.context.repo;
  core.debug(`Getting issues for ${owner}/${repo}`);
  const issues = await client.issues.listForRepo({
    owner,
    repo,
    state: 'open'
  });
  core.debug(`Found ${issues.data.length} issues`);
  const issue = issues.data.find(i => i.title === 'Dependency Dashboard');
  if (!issue?.body) {
    core.warning('No Renovate Dashboard issue found');
  }
  return issue;
}

async function parseRenovateIssue(markdown: string): Promise<unknown> {
  const { remark } = await import('remark');
  const { default: remarkParse } = await import('remark-parse');
  const parsed = remark().use(remarkParse).parse(markdown);
  return parsed;
}

export default async function getIssueTrackerStats(): Promise<unknown> {
  const issue = await getRenovateIssue();
  if (issue && issue.body) {
    return await parseRenovateIssue(issue.body);
  } else {
    return { error: 'No Renovate issue found' };
  }
}
