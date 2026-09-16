import { NextResponse } from "next/server";
import { publicJwk } from "@/lib/credentials/keys";

export async function GET() {
  const jwk = publicJwk();
  return NextResponse.json({ keys: jwk ? [jwk] : [] });
}
