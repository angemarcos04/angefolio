import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum([
      'Planning',
      'Prototype',
      'In Progress',
      'Live',
      'Archived',
    ]),
    featured: z.boolean(),
    visible: z.boolean(),
    stack: z.array(z.string()),
    github: z.url().optional(),
    demo: z.url().optional(),
    caseStudy: z.string().optional(),
    date: z.coerce.date(),
    category: z.string().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    published: z.boolean(),
    featured: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
  }),
});

const lab = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lab' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['Idea', 'Prototype', 'Testing', 'Paused', 'Archived']),
    tags: z.array(z.string()),
    visible: z.boolean(),
    date: z.coerce.date(),
  }),
});

export const collections = { projects, notes, lab };
