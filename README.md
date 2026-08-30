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

Every published map article must include an interactive map in the article and
a link that opens the map full screen. The content schema enforces both fields
at build time; drafts may omit them while they are being developed.

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
