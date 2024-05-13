import * as core from '@actions/core';
import * as github from '@actions/github';
import { wait } from './wait';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
type PullRequests =
  Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'];

async function getPRs(): Promise<PullRequests> {
  let createdAfter: Date | undefined;
  const createdAfterInput: string = core.getInput('createdAfter') ?? '';
  if (createdAfterInput) {
    createdAfter = new Date(createdAfterInput);
  }

  const token: string = process.env.GITHUB_TOKEN ?? '';
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = github.context.repo;
  let pulls = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
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

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds');

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`);
    core.debug('Hello, world!');

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString());
    await wait(parseInt(ms, 10));
    core.debug(new Date().toTimeString());

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString());

    const prs = await getPRs();
    core.setOutput('all', JSON.stringify(prs));
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
