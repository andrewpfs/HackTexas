<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guidance

- This is an AI-powered group trip planner. It helps a host and multiple travelers coordinate schedules, budgets, interests, lodging preferences, candidate plans, and one shared itinerary.
- Optimize for a reliable HackTX demo that can be completed quickly. Keep the architecture straightforward and avoid features that are not required for the current task.
- Write simple, conventional, readable code that a student can understand and explain. Preserve working code and the existing project structure when possible.
- Read `PROJECT_SPEC.md` before changing product behavior. Use `IMPLEMENTATION_PLAN.md` to understand the intended phase order.
- Run `npm run lint` and `npm run build` after meaningful code changes. Add focused tests later when business logic or data handling is introduced.
- Do not run Git or GitHub operations. Do not commit, stage, push, create branches, or create pull requests.
- Manual availability selection is required for the MVP. Google Calendar OAuth is an optional stretch feature and must not block the demo.
- Do not implement real payments or real booking transactions. Booking flows in the MVP must be clearly simulated.
- Never put secrets or real credentials in source code. Keep local credentials in ignored environment files.
- Make all future external API calls from server-side code. Keep travel-data providers separate from Muse Spark reasoning.
