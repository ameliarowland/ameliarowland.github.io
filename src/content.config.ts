import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const maps = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/maps' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    // Path to a preview image, e.g. /maps/my-map.png (file in public/maps/)
    image: z.string(),
    // Optional embed URL for an interactive map (ArcGIS Online, StoryMaps, Felt, etc.)
    embedUrl: z.string().url().optional(),
    // Optional external link, e.g. a full StoryMap or live app
    externalUrl: z.string().url().optional(),
    tools: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { maps };
