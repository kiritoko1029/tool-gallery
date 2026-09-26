# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the Express server, local JSON storage, MCP integration, and shared logic. Keep validation and tool transformations in `tools-core.js`; shared cover/configuration logic belongs in `cover-core.js`.
- `worker/` implements Cloudflare routing and KV storage. Keep REST behavior consistent with `src/server.js`.
- `public/` holds gallery/admin HTML and vanilla JavaScript/CSS in `public/assets/`; no frontend build is required.
- `data/tools.json` stores local entries; `data/covers/` holds local images. Cloud deployment uses KV and R2.
- `scripts/` contains installation/upload utilities; `skill/SKILL.md` documents AI gallery operations. Development decisions live in `.agents/notes/`.

## Build, Test, and Development Commands

Use Node.js 18+ for the application; check Wrangler's Node requirements when developing the Worker.

- `npm install`: install dependencies.
- `npm start`: run Express at `http://localhost:3927`; admin UI is `/admin`.
- `npm run dev`: restart the local server automatically on changes.
- `npm run mcp`: launch the local stdio MCP server.
- `npx wrangler dev`: run the Worker locally.
- `npm run deploy`: publish the Worker and static assets using `wrangler.toml`.
- `npm run skill:install`: install the gallery skill into the user's skills directory.

There are no build, test, or lint scripts.

## Coding Style & Naming Conventions

Use JavaScript ES modules, explicit `.js` import extensions, two-space indentation, semicolons, and single-quoted strings. Follow existing camelCase functions/variables, UPPER_SNAKE_CASE constants, and kebab-case filenames such as `mcp-tools.js`. Use Zod schemas for input validation. Keep shared modules compatible with both Node and Workers. No formatter or linter is configured; match surrounding code.

## Testing Guidelines

No automated test suite, test naming convention, or coverage threshold exists. For manual checks, set `GALLERY_DATA_DIR` to a disposable directory before starting Express. Exercise gallery search/filtering, admin CRUD, invalid-input responses, and token enforcement. Check cover/settings or MCP flows when affected. Repeat API changes against the local Worker and record results in the PR.

## Commit & Pull Request Guidelines

History uses `feat:`, `fix:`, `docs:`, `chore:`, and `content:` prefixes, commonly with Chinese descriptions. Keep commits focused. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for UI changes. Identify configuration or data changes explicitly.

## Security & Configuration

Keep admin tokens and API keys out of Git; `data/.admin-token` and `data/settings.json` are ignored. Use environment variables locally and Wrangler secrets in deployment. `npm run kv:push` overwrites remote data; `npm run kv:pull` overwrites local data. Verify the target and back up data before synchronization.
