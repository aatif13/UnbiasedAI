/** @type {import('next').NextConfig} */
const googleClientId = (
  process.env.GOOGLE_CLIENT_ID ??
  process.env.AUTH_GOOGLE_ID ??
  process.env.AUTH_GOOGLE_CLIENT_ID ??
  ""
).trim();
const googleClientSecret = (
  process.env.GOOGLE_CLIENT_SECRET ??
  process.env.AUTH_GOOGLE_SECRET ??
  process.env.AUTH_GOOGLE_CLIENT_SECRET ??
  ""
).trim();

const nextConfig = {
  env: {
    /** Lets the client show “Continue with Google” when server OAuth env is set (no secret exposed). */
    NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED: googleClientId.length > 0 && googleClientSecret.length > 0 ? "1" : "",
  },
};

export default nextConfig;
