import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const providers: NonNullable<NextAuthOptions["providers"]> = [];

/** Supports `GOOGLE_*` (NextAuth default) and `AUTH_GOOGLE_*` (Auth.js style) names in `.env.local`. */
const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? process.env.AUTH_GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? process.env.AUTH_GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      const password = credentials?.password ?? "";
      if (!email || !password) {
        return null;
      }

      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user?.passwordHash) {
          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) {
            return null;
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
          };
        }
      } catch {
        // DB unavailable — fall through to demo-only
      }

      if (email === "demo@unbiasedai.local" && password === "demo-unbiased-2026") {
        return { id: "demo-user", email, name: "Demo User" };
      }

      return null;
    },
  }),
);

/**
 * NextAuth configuration (Google when env is set + email/password via Prisma or demo user).
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = session.user.email ?? (token.email as string | undefined);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
