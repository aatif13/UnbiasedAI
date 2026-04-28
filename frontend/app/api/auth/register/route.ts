import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a local user with a bcrypt password (email/password auth).
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { email: rawEmail, password, name: rawName } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    const email = String(rawEmail ?? "")
      .toLowerCase()
      .trim();
    const pwd = String(password ?? "");
    const name = rawName ? String(rawName).trim() || null : null;

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (pwd.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(pwd, 12);
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error:
            "Cannot reach Postgres. Fix DATABASE_URL in frontend/.env.local (user, password, host, database) and ensure the server is running.",
        },
        { status: 503 },
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P1000") {
      return NextResponse.json(
        {
          error:
            "Database rejected the credentials in DATABASE_URL. Update the postgres user/password in .env.local.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
