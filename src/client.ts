import { Octokit } from '@octokit/rest';

let octokit: Octokit | null = null;
export default function getClient(): Octokit {
  if (octokit == null) {
    const token: string = process.env.GITHUB_TOKEN ?? '';
    if (!token) {
      throw new Error('GITHUB_TOKEN is not set');
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}
