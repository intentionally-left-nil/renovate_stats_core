import * as core from '@actions/core';
import getPullStats from './pulls';
import getIssueTrackerStats from './issue_tracker';
import {
  getPackageStats,
  getReviewerStats,
  getIssueStats
} from './aggregate_stats';
export async function run(): Promise<void> {
  try {
    const prs = await getPullStats();
    const issueStats = await getIssueTrackerStats();
    const packageStats = getPackageStats(prs);
    const reviewerStats = getReviewerStats(prs);
    const aggregateIssueStats = issueStats ? getIssueStats(issueStats) : null;
    core.setOutput('packages', JSON.stringify(packageStats));
    core.setOutput('reviewers', JSON.stringify(reviewerStats));
    core.setOutput('status', JSON.stringify(aggregateIssueStats));
    core.setOutput(
      'raw',
      JSON.stringify({
        prs,
        packages: packageStats,
        reviewers: reviewerStats,
        status: aggregateIssueStats
      })
    );
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
