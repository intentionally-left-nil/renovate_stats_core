import * as core from '@actions/core';
import getPullStats from './pulls';
import getIssueTrackerStats from './issue_tracker';
export async function run(): Promise<void> {
  try {
    const prs = await getPullStats();
    const issueStats = await getIssueTrackerStats();
    core.setOutput('all', JSON.stringify({ prs, issueStats }));
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
