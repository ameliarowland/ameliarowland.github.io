# ameliarowland.github.io

Amelia Rowland's map portfolio — built with [Astro](https://astro.build) and
Tailwind CSS, deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Publish a map

Every published map article must meet these requirements:

- Include an interactive map in the article and a link that opens it full
  screen. The content schema enforces both fields at build time; drafts may
  omit them while they are being developed.
- Keep map controls usable at the standard 720 × 540 article size. Overlay
  panels must use no more than 40% of the map width at article-sized desktop
  breakpoints and scroll internally instead of covering most of the map.
- Preserve a roomier control layout for the full-screen map where appropriate.
- Link every non-language tool keyword shown at the top of an article to its
  official website or specification. Scripting languages remain plain text;
  the content schema enforces the configured tool links.
- Include contextual inline links in the article prose for named libraries,
  datasets, services, and source repositories.
- Render article body copy with full justification while keeping headings
  left-aligned.
- Never publish fabricated or placeholder factual data. Every map attribute
  must be traceable to a cited authoritative source or a documented,
  reproducible calculation from sourced data. If an attribute cannot be
  verified, omit it; do not invent plausible scores, classifications,
  amenities, accessibility claims, environmental qualities, or descriptions.

1. Export a preview image as PNG/JPG/SVG and put it in `public/maps/`.
2. Add a Markdown file in `src/content/maps/`, e.g. `my-map.md`:

   ```markdown
   ---
   title: "My Map"
   description: "One-sentence summary shown on the card and in search results."
   date: 2026-06-09
   image: /maps/my-map.png
   # required for published posts — interactive iframe shown in the article:
   embedUrl: https://www.arcgis.com/apps/Embed/index.html?webmap=YOUR_ID
   # required for published posts — destination of the full-screen link:
   externalUrl: https://www.arcgis.com/apps/mapviewer/index.html?webmap=YOUR_ID
   tools: [QGIS, ArcGIS Pro]
   tags: [sustainability]
   ---

   The story behind the map goes here, in Markdown.
   ```

3. Commit and push to `main` — GitHub Actions builds and deploys automatically.

Delete the two `sample-*.md` files (and their SVGs in `public/maps/`) once real
maps are in.

## Deploy (one-time setup)

1. Create a GitHub repository named `ameliarowland.github.io` and push this
   folder to its `main` branch.
2. In the repo: **Settings → Pages → Source → GitHub Actions**.
3. If the username differs from `ameliarowland`, update `site` in
   `astro.config.mjs`.

The site goes live at `https://<username>.github.io` a minute or two after each
push.
