export function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  JWT_ACCESS_SECRET: mustGetEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: mustGetEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES ?? '7d',
};
