import { createServerFn } from "@tanstack/react-start";

export const getLoginFlagsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { googleOAuthCreds } = await import("./google-oauth");
  return {
    google: Boolean(googleOAuthCreds()),
    database: Boolean(process.env.DATABASE_URL?.trim()),
  };
});
