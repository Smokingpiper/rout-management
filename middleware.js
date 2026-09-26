import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

// ログインを必須にするパス（それ以外の管理系APIやログイン画面自体は対象外）
const PROTECTED_PREFIXES = ["/admin", "/driver", "/union", "/account"];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function hasValidSession(sessionId) {
  if (!sessionId) return false;
  try {
    const [row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));
    return !!row;
  } catch {
    // DB到達不可などの場合は安全側（未ログイン扱い）に倒す
    return false;
  }
}

export async function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が未設定の間はBasic認証をスキップ（ローカル開発用）
  if (user && password) {
    const authHeader = request.headers.get("authorization");
    let basicOk = false;
    if (authHeader) {
      const [scheme, encoded] = authHeader.split(" ");
      if (scheme === "Basic" && encoded) {
        const decoded = atob(encoded);
        const separatorIndex = decoded.indexOf(":");
        const suppliedUser = decoded.slice(0, separatorIndex);
        const suppliedPassword = decoded.slice(separatorIndex + 1);
        if (suppliedUser === user && suppliedPassword === password) basicOk = true;
      }
    }
    if (!basicOk) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="rout-management"' },
      });
    }
  }

  const { pathname } = request.nextUrl;
  if (isProtectedPath(pathname)) {
    const sessionId = request.cookies.get("session_id")?.value;
    if (!(await hasValidSession(sessionId))) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
