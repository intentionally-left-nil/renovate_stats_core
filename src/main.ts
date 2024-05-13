import * as core from '@actions/core';
import getPullStats from './pulls';
export async function run(): Promise<void> {
  try {
    const prs = await getPullStats();
    core.setOutput('all', JSON.stringify(prs));
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
