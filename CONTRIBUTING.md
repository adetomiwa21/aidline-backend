# Contributing to Aidline Backend

Thanks for helping make relief and climate funding transparent. This guide gets you from clone to merged pull request.

## Finding something to work on

- Issues labelled `good first issue` are small and well scoped.
- Every issue lists acceptance criteria and the files you will likely touch. Ask in the issue if anything is unclear.
- Comment on an issue to get assigned before you start.

## Local setup

```sh
git clone https://github.com/aidline-org/aidline-backend
cd aidline-backend
npm install
cp .env.example .env
npm run dev:db     # keep running
npm run dev
npm test
```

Tests start their own temporary Postgres, so they work without `dev:db` running.

## Making a change

1. Fork the repo and branch: `git checkout -b feat/short-description`
2. Keep pull requests focused on one issue.
3. Add tests in `test/`. Route changes need an API test, indexer changes need an indexer test.
4. Run the checks CI runs:
   ```sh
   npm run lint
   npm run typecheck
   npm test
   npx prettier --check .
   ```
5. Schema changes go in a new numbered file in `src/db/migrations/`. Never edit a migration that has already been merged.
6. Update `docs/API.md` if you change a request or response.
7. Open a pull request, fill in the template and link the issue with `Closes #123`.

## Code guidelines

- Validate every request with zod. Errors are turned into `400` responses automatically.
- Keep token amounts as strings or `bigint`. Never `Number()` an amount.
- SQL lives next to the route that uses it. Always use parameters (`$1`), never string interpolation of user input.
- The contract is the source of truth. Do not compute balances that the chain already knows.

## Commit messages

Use a short prefix: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Example: `feat: add donor refund history endpoint`.
