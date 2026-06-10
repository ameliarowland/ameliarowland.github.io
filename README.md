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

1. Export your map as PNG/JPG/SVG and put it in `public/maps/`.
2. Add a Markdown file in `src/content/maps/`, e.g. `my-map.md`:

   ```markdown
   ---
   title: "My Map"
   description: "One-sentence summary shown on the card and in search results."
   date: 2026-06-09
   image: /maps/my-map.png
   # optional — renders an iframe instead of the static image:
   # embedUrl: https://www.arcgis.com/apps/Embed/index.html?webmap=YOUR_ID
   # externalUrl: https://storymaps.arcgis.com/stories/YOUR_ID
   tools: [QGIS, ArcGIS Pro]
   tags: [sustainability]
   ---

   The story behind the map goes here, in Markdown.
   ```

3. Commit and push to `main` — GitHub Actions builds and deploys automatically.

Delete the two `sample-*.md` files (and their SVGs in `public/maps/`) once real
maps are in.

## Deploy (one-time setup)

1. Create a GitHub repository named `<username>.github.io` (e.g.
   `ameliarowland09.github.io`) and push this folder to its `main` branch.
2. In the repo: **Settings → Pages → Source → GitHub Actions**.
3. If the username differs from `ameliarowland09`, update `site` in
   `astro.config.mjs`.

The site goes live at `https://<username>.github.io` a minute or two after each
push.
