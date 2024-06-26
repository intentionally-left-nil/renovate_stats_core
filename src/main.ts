import * as core from '@actions/core';
import getPullStats from './pulls';
import getIssueTrackerStats from './issue_tracker';
import {
  getPackageStats,
  getReviewerStats,
  getIssueStats,
  getTimelineStats
} from './aggregate_stats';
export async function run(): Promise<void> {
  try {
    core.info('Gathering information from all the Renovate PRs...');
    const prs = await getPullStats();
    core.info('Gathering information from the Renovate Issue tracker...');
    const issueStats = await getIssueTrackerStats();
    core.info('Calculating all the statistics...');
    const packageStats = getPackageStats(prs);
    const reviewerStats = getReviewerStats(prs);
    const aggregateIssueStats = issueStats ? getIssueStats(issueStats) : null;
    const timelineStats = getTimelineStats(prs);
    core.info('Setting outputs...');
    core.setOutput('packages', JSON.stringify(packageStats));
    core.setOutput('reviewers', JSON.stringify(reviewerStats));
    core.setOutput('status', JSON.stringify(aggregateIssueStats));
    core.setOutput('timeline', JSON.stringify(timelineStats));
    core.setOutput(
      'raw',
      JSON.stringify({
        prs,
        issues: issueStats
      })
    );
    core.info('Finished!');
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
