import type { Sections } from './issue_tracker';
import type { PullStat } from './pulls';
import dayjs from 'dayjs';

interface ReviewerStats {
  approved: number;
  approvedThenMerged: number;
  mergedByMe: number;
  uniquePRs: number;
  totalTimeOpen: number;
  timeOpenPerPR: number;
}

interface VersionStat {
  version: string;
  createdAt: Date;
  mergedAt: Date | null;
}

interface PackageStats {
  totalPRsOpen: number;
  totalPRsMerged: number;
  totalTimeOpen: number;
  timeOpenPerPR: number;
  versions: VersionStat[];
}

interface IssueStats {
  date: Date;
  totalPackages: number;
  uniquePackages: number;
  rateLimited: number;
  open: number;
  ignored: number;
}

interface TimelineStats {
  week: Date;
  totalPRsOpened: number;
  totalPRsMerged: number;
}

function getReviewerStats(prs: PullStat[]): { [key: string]: ReviewerStats } {
  const stats: { [key: string]: ReviewerStats } = {};

  const initialize = (key: string): void => {
    if (!stats[key]) {
      stats[key] = {
        approved: 0,
        approvedThenMerged: 0,
        mergedByMe: 0,
        uniquePRs: 0,
        totalTimeOpen: 0,
        timeOpenPerPR: 0
      };
    }
  };
  for (const pr of prs) {
    for (const approver of pr.approvers) {
      initialize(approver);
      stats[approver].uniquePRs++;
      stats[approver].approved++;
      stats[approver].totalTimeOpen += pr.openFor;

      if (pr.isMerged) {
        stats[approver].approvedThenMerged++;
      }
    }
    if (pr.mergedBy) {
      initialize(pr.mergedBy);
      stats[pr.mergedBy].mergedByMe++;
      if (!pr.approvers.includes(pr.mergedBy)) {
        stats[pr.mergedBy].uniquePRs++;
        stats[pr.mergedBy].totalTimeOpen += pr.openFor;
      }
    }
  }

  for (const key of Object.keys(stats)) {
    if (stats[key].uniquePRs > 0) {
      stats[key].timeOpenPerPR =
        stats[key].totalTimeOpen / stats[key].uniquePRs;
    }
  }
  return stats;
}

const titleRe = /\s([^\s]+) to ([^\s]+)\b/i;
function parseTitle(title: string): { name: string; version: string } {
  const match = titleRe.exec(title);
  const name = match ? match[1] : title;
  const version = match ? match[2] : 'unknown';
  return { name, version };
}

function getPackageStats(prs: PullStat[]): { [key: string]: PackageStats } {
  const stats: { [key: string]: PackageStats } = {};
  const initialize = (key: string): void => {
    if (!stats[key]) {
      stats[key] = {
        totalPRsOpen: 0,
        totalPRsMerged: 0,
        totalTimeOpen: 0,
        timeOpenPerPR: 0,
        versions: []
      };
    }
  };
  for (const pr of prs) {
    const { name, version } = parseTitle(pr.title);
    initialize(name);
    stats[name].totalPRsOpen++;
    stats[name].totalTimeOpen += pr.openFor;
    if (pr.isMerged) {
      stats[name].totalPRsMerged++;
    }
    stats[name].versions.push({
      version,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt
    });
  }

  for (const key of Object.keys(stats)) {
    if (stats[key].totalPRsOpen > 0) {
      stats[key].timeOpenPerPR =
        stats[key].totalTimeOpen / stats[key].totalPRsOpen;
    }
    stats[key].versions.sort(
      (a, b) =>
        (a.mergedAt ?? a.createdAt).getTime() -
        (b.mergedAt ?? b.createdAt).getTime()
    );
  }
  return stats;
}

function getIssueStats(sections: Sections): IssueStats {
  const stats: IssueStats = {
    date: new Date(),
    totalPackages: 0,
    uniquePackages: 0,
    rateLimited: 0,
    open: 0,
    ignored: 0
  };
  const uniquePackages = new Set<string>();
  for (const key of Object.keys(sections)) {
    const titles = sections[key as keyof Sections];
    for (const title of titles) {
      let { name } = parseTitle(title);
      const firstSlash = name.indexOf('/');
      if (firstSlash !== -1) {
        name = name.slice(firstSlash + 1);
      }
      uniquePackages.add(name);
      stats.totalPackages++;
    }
  }
  stats.uniquePackages = uniquePackages.size;
  stats.rateLimited = sections['Rate-Limited'].length;
  stats.open = sections.Open.length;
  stats.ignored = sections['Ignored or Blocked'].length;
  return stats;
}

function getTimelineStats(prs: PullStat[]): TimelineStats[] {
  const weeks = new Map<number, TimelineStats>();
  const initialize = (key: Date): void => {
    if (!weeks.has(key.getTime())) {
      weeks.set(key.getTime(), {
        week: key,
        totalPRsOpened: 0,
        totalPRsMerged: 0
      });
    }
  };
  for (const pr of prs) {
    const openedWeek = dayjs(pr.createdAt).startOf('week').toDate();
    initialize(openedWeek);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    weeks.get(openedWeek.getTime())!.totalPRsOpened++;

    if (pr.mergedAt) {
      const mergedWeek = dayjs(pr.mergedAt).startOf('week').toDate();
      initialize(mergedWeek);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      weeks.get(mergedWeek.getTime())!.totalPRsMerged++;
    }
  }
  const timeline = Array.from(weeks.values());
  timeline.sort((a, b) => a.week.getTime() - b.week.getTime());
  return timeline;
}

export { getPackageStats, getReviewerStats, getIssueStats, getTimelineStats };
