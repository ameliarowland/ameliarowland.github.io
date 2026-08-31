import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { getToolLink, toolNeedsLink } from './data/tool-links';

const maps = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/maps' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      // Path to a preview image, e.g. /maps/my-map.png (file in public/maps/)
      image: z.string(),
      // Interactive map shown inside the article.
      embedUrl: z.string().url().optional(),
      // Full-screen version linked next to the embedded map.
      externalUrl: z.string().url().optional(),
      // Use a taller frame for full interactive applications.
      tallEmbed: z.boolean().default(false),
      tools: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    })
    .superRefine((map, context) => {
      if (map.draft) return;

      if (!map.embedUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Published map articles must embed an interactive map.',
          path: ['embedUrl'],
        });
      }

      if (!map.externalUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Published map articles must link to a full-screen map.',
          path: ['externalUrl'],
        });
      }

      map.tools.forEach((tool, index) => {
        if (toolNeedsLink(tool) && !getToolLink(tool)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Non-language tool "${tool}" must have an official link in src/data/tool-links.ts.`,
            path: ['tools', index],
          });
        }
      });
    }),
});

export const collections = { maps };
