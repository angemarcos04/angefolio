import { readdir } from 'node:fs/promises';

export interface MarkdownSourceFiles {
  exists: boolean;
  filenames: string[];
}

/** Discover optional legacy Markdown sources without hiding other I/O errors. */
export async function discoverMarkdownSources(
  directory: string,
): Promise<MarkdownSourceFiles> {
  let filenames: string[];
  try {
    filenames = await readdir(directory);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return { exists: false, filenames: [] };
    }
    throw error;
  }

  return {
    exists: true,
    filenames: filenames.filter((name) => /\.mdx?$/.test(name)).sort(),
  };
}
