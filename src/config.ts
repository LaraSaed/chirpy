process.loadEnvFile();

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

type APIConfig = {
  fileserverHits: number;
  dbURL: string;
};

export const config: APIConfig = {
  fileserverHits: 0,
  dbURL: envOrThrow("DB_URL"),
};
