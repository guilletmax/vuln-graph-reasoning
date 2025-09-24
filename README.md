This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Graph Ingestion

The `findings_data.json` file can be ingested into a Neo4j AuraDB instance together with optional agent-enriched relationships.

1. Install the additional tooling (once):

   ```bash
   npm install neo4j-driver tsx
   ```

2. Export Neo4j credentials (AuraDB connection string uses the `neo4j+s://` scheme):

   ```bash
   export NEO4J_URI="neo4j+s://<bolt-host>"
   export NEO4J_USERNAME="neo4j"
   export NEO4J_PASSWORD="<password>"
   ```

3. (Optional) Enable AI-enriched relationships via LiteLLM-compatible endpoint:

   ```bash
   export LITELLM_BASE_URL="https://litellm.your-company.dev"
   export LITELLM_API_KEY="sk-..."
   export GRAPH_AGENT_MODEL="gpt-4o-mini" # or any model supported by the router
   ```

4. Execute the one-time ingestion (protected by dataset fingerprinting so reruns are no-ops):

   ```bash
   npm run ingest:graph -- findings_data.json
   ```

   If the command throws `getaddrinfo ENOTFOUND`, Aura rotated the Bolt hostname—grab the current URI from the Aura console and update `NEO4J_URI` before retrying.

The script models findings, assets, services, packages, scanners, and scans as nodes; supplies canonical relationships (e.g., `(:Finding)-[:FOUND_ON]->(:Asset)`, `(:Package)-[:ASSOCIATED_WITH]->(:Vulnerability)`); and merges additional relationships suggested by the agent (or heuristic fallbacks) before recording an `:IngestionRun` node keyed by dataset hash.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
