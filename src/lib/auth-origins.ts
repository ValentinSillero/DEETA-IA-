type VercelAuthEnvironment = {
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_BRANCH_URL?: string;
};

function toHttpOrigin(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
    );

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function getTrustedAuthOrigins(
  baseURL: string,
  environment: VercelAuthEnvironment = {
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  },
) {
  const origins = [
    baseURL,
    environment.VERCEL_URL,
    environment.VERCEL_PROJECT_PRODUCTION_URL,
    environment.VERCEL_BRANCH_URL,
  ]
    .map(toHttpOrigin)
    .filter((origin): origin is string => origin !== null);

  return [...new Set(origins)];
}
