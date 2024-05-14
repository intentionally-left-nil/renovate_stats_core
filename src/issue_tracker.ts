import getClient from './client';
import * as github from '@actions/github';
import * as core from '@actions/core';
import type { Root, RootContent, List, Paragraph } from 'mdast';
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

export interface Sections {
  'Rate-Limited': string[];
  'Edited/Blocked': string[];
  Open: string[];
  'Ignored or Blocked': string[];
}

function findCheckboxParent(node: RootContent): Paragraph | null {
  if (
    node.type === 'paragraph' &&
    node.children.length &&
    node.children[0].type === 'text' &&
    node.children[0].value.startsWith('[ ]')
  ) {
    return node;
  }
  switch (node.type) {
    case 'paragraph':
    case 'blockquote':
    case 'heading':
    case 'link':
    case 'listItem':
      for (const child of node.children) {
        const match = findCheckboxParent(child);
        if (match) {
          return match;
        }
      }
  }
  return null;
}

function getTextContent(node: RootContent): string {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'link':
    case 'paragraph':
    case 'blockquote':
    case 'list':
    case 'listItem':
    case 'heading':
      return node.children.map(getTextContent).join(' ');
    default:
      return '';
  }
}

function getListItems(list: List): string[] {
  const linesToIgnore = [
    'Check this box to trigger a request for Renovate to run again on this repository'
  ];
  return list.children
    .map(child => {
      const paragraph = findCheckboxParent(child);
      return paragraph ? getTextContent(paragraph) : '';
    })
    .map(s => s.replace(/^\[ \] /, '').trim())
    .filter(s => !linesToIgnore.includes(s))
    .filter(Boolean);
}

function parseIssue(root: Root): Sections {
  const sections: Sections = {
    'Rate-Limited': [],
    'Edited/Blocked': [],
    Open: [],
    'Ignored or Blocked': []
  };
  let sectionName: keyof Sections | null = null;
  for (const node of root.children) {
    if (node.type === 'heading') {
      if (
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0] &&
        Object.keys(sections).includes(node.children[0].value)
      ) {
        sectionName = node.children[0].value as keyof Sections;
      }
    } else if (node.type === 'list' && sectionName) {
      sections[sectionName] = getListItems(node);
    }
  }
  return sections;
}

async function markdownToJson(markdown: string): Promise<Root> {
  const { remark } = await import('remark');
  const { default: remarkParse } = await import('remark-parse');
  const parsed = remark().use(remarkParse).parse(markdown);
  return parsed;
}

export default async function getIssueTrackerStats(): Promise<Sections | null> {
  const issue = await getRenovateIssue();
  if (issue && issue.body) {
    const markdown = await markdownToJson(issue.body);
    const sections = parseIssue(markdown);
    return sections;
  } else {
    return null;
  }
}
