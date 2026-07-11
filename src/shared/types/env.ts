export type AppConfigProps = {
  PORT: number;
  VERSION: string;
  APP_NAME: string;
  APP_DESCRIPTION: string;
  NODE_ENV: string;
  FRONTEND_URL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  MAIL: MailConfig;
  JWT: JWTConfig;
  ADMIN: AdminConfig;
};

type MailConfig = {
  API_KEY: string;
  FROM: string;
  NAME: string;
};

type JWTConfig = {
  SECRET: string;
  REFRESH_SECRET: string;
  EXPIRES_IN: number;
  REFRESH_EXPIRES_IN: number;
};

type AdminConfig = {
  EMAIL: string;
  PASSWORD: string;
};
