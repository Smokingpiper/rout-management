import { NextResponse } from "next/server";

export function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が未設定の間は認証をスキップ（ローカル開発用）
  if (!user || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const suppliedUser = decoded.slice(0, separatorIndex);
      const suppliedPassword = decoded.slice(separatorIndex + 1);
      if (suppliedUser === user && suppliedPassword === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="rout-management"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
