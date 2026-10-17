export type MarkdownStarterKind = 'project' | 'blog' | 'note' | 'lab';

export const markdownStarters: Record<MarkdownStarterKind, string> = {
  project:
    '## Overview\n\n## Problem\n\n## Approach\n\n## Implementation\n\n## Challenges\n\n## Results\n\n## Lessons Learned',
  blog: '## Introduction\n\n## Background\n\n## Main Discussion\n\n## Conclusion',
  note: '## Context\n\n## Notes\n\n## References',
  lab: '## Objective\n\n## Environment\n\n## Procedure\n\n## Observations\n\n## Results\n\n## Lessons Learned',
};
