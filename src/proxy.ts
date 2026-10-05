import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { isServerConfigured } from "@/lib/env";

export function proxy(request: NextRequest) {
  if (!isServerConfigured()) {
    return NextResponse.redirect(new URL("/?configuracion=pendiente", request.url));
  }

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/productos/:path*",
    "/vender/:path*",
    "/ventas/:path*",
    "/caja/:path*",
    "/scanner/:path*",
    "/deeta-ai/:path*",
    "/configuracion/:path*",
    "/onboarding/:path*",
  ],
};
