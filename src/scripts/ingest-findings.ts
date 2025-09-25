#!/usr/bin/env node
import "@/lib/utils/load-env";
import { ingestFindingsFromFile } from "@/lib/graph/ingest-findings";

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error("Usage: npm run ingest:graph -- <path-to-findings.json>");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await ingestFindingsFromFile(inputPath);
    console.log(
      `Ingested ${result.findings} findings → ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships (base ${result.provenance.base.relationships}, agent ${result.provenance.agent.relationships}).`,
    );
  } catch (error) {
    console.error("Graph ingestion failed:", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Unexpected error in ingestion script", error);
  process.exitCode = 1;
});
