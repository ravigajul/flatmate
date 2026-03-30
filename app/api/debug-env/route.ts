import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "NOT_SET";
  return NextResponse.json({
    clientId_length: clientId.length,
    clientId_start: clientId.substring(0, 20),
    clientId_end: clientId.substring(clientId.length - 10),
    has_quotes: clientId.startsWith('"') || clientId.endsWith('"'),
    nextauth_secret_set: !!process.env.NEXTAUTH_SECRET,
    nextauth_url: process.env.NEXTAUTH_URL,
  });
}
