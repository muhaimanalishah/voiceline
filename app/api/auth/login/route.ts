import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassphrase,
  createSessionToken,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passphrase } = body;

    if (typeof passphrase !== "string" || !passphrase) {
      return NextResponse.json(
        { error: "Passphrase is required." },
        { status: 400 }
      );
    }

    const isValid = verifyPassphrase(passphrase);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect passphrase. Please try again." },
        { status: 401 }
      );
    }

    const sessionToken = await createSessionToken();
    const response = NextResponse.json({ success: true });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
