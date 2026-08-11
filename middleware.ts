import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware — Session refresh + route protection.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.1 (Auth), §6.3 (RLS)
 *
 * Strategy:
 * - Refresh the Supabase session cookie on every request.
 * - Protect /dashboard, /pagu, /vault, /spp, /ai (parent)
 *   /pos, /pos/settlement, /pos/ai (canteen)
 *   /school/* (school admin)
 *   /admin/* (platform admin)
 * - Redirect unauthenticated users to /login.
 * - API routes are protected by individual route handlers (RLS + server auth check).
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — must not run getUser() result-dependent logic between this and return
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths — always allowed
  const publicPaths = ["/login", "/api/webhooks"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!isPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public/* files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icons/|manifest.json).*)",
  ],
};
