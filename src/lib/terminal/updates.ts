import type {
  PortfolioTerminalData,
  TerminalNote,
  TerminalProject,
  TerminalUpdate,
} from './types';

export function selectLatestPublicUpdate(
  notes: TerminalNote[],
  projects: TerminalProject[],
): TerminalUpdate | undefined {
  const publicUpdates = [
    ...notes.map((note) => ({
      label: `note: ${note.title}`,
      date: note.updatedAt ?? note.createdAt,
      url: note.url,
    })),
    ...projects.flatMap((project) =>
      project.updatedAt
        ? [
            {
              label: `project: ${project.title}`,
              date: project.updatedAt,
              url: project.url,
            },
          ]
        : [],
    ),
  ];

  const latestUpdate = publicUpdates
    .filter((update) => Boolean(update.date))
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  return latestUpdate
    ? { ...latestUpdate, date: latestUpdate.date.slice(0, 10) }
    : undefined;
}

export function getPreviewUpdate(
  data: Pick<PortfolioTerminalData, 'buildCommit' | 'latestUpdate'>,
) {
  return data.buildCommit
    ? {
        command: '$ git log -1 --oneline',
        text: `${data.buildCommit.slice(0, 8)} angefolio build commit`,
      }
    : {
        command: '$ cat recent.log',
        text: data.latestUpdate
          ? `${data.latestUpdate.date ?? 'undated'} ${data.latestUpdate.label}`
          : 'No public updates available.',
      };
}
