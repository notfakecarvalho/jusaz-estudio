import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão e manda quem não entrou para /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  const entrou = !!data?.claims;
  const noLogin = request.nextUrl.pathname.startsWith("/login");
  const publica = request.nextUrl.pathname.startsWith("/meta/");
  if (!entrou && !noLogin && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (entrou && !publica) {
    // Só o administrador do estúdio vê as telas do Estúdio JusAz; os demais usuários ficam em /reels.
    const { data: adm } = await supabase.from("admins").select("user_id").eq("user_id", data!.claims.sub).maybeSingle();
    const admin = !!adm;
    const emReels = request.nextUrl.pathname.startsWith("/reels");
    if (noLogin || (!admin && !emReels)) {
      const url = request.nextUrl.clone();
      url.pathname = admin ? "/" : "/reels";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|tgz)$).*)"],
};
