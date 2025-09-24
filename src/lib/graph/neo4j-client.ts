import neo4j, { type Driver, type Session } from "neo4j-driver";

type Neo4jConfig = {
  url: string;
  username: string;
  password: string;
};

let cachedDriver: Driver | null = null;

function resolveConfig(): Neo4jConfig {
  const url = process.env.NEO4J_URI ?? process.env.NEO4J_URL;
  const username = process.env.NEO4J_USERNAME ?? process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD ?? process.env.NEO4J_PASS;

  if (!url || !username || !password) {
    throw new Error(
      "Neo4j configuration missing. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD in your environment.",
    );
  }

  return { url, username, password };
}

export function getNeo4jDriver(): Driver {
  if (cachedDriver) {
    return cachedDriver;
  }

  const { url, username, password } = resolveConfig();
  const authToken = neo4j.auth.basic(username, password);
  cachedDriver = neo4j.driver(url, authToken, {
    disableLosslessIntegers: true,
  });

  return cachedDriver;
}

export async function withNeo4jSession<T>(
  work: (session: Session) => Promise<T>,
): Promise<T> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

export async function shutdownNeo4jDriver() {
  if (cachedDriver) {
    await cachedDriver.close();
    cachedDriver = null;
  }
}
