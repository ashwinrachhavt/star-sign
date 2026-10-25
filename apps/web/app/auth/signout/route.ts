import { NextResponse, type NextRequest } from "next/server";
import { signOutCurrent } from "@/lib/auth/bridge";

export async function POST(request: NextRequest) {
  await signOutCurrent();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
