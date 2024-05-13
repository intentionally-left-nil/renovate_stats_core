import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';

let octokit: Octokit | null = null;
export default function getClient(): Octokit {
  if (octokit == null) {
    const token = core.getInput('github_token');
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}
