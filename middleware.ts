import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware — Session refresh + dedicated login portal routing & strict persona isolation.
 * Reference: Schema v3 Custom Access Token Hooks (§15 jwt_app_meta)
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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  // Refresh session & fetch user object
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Whitelisted public / auth / static routes
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/img") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/sw.js");

  // Extract roles from app_metadata or user_metadata
  const appMetadata = user?.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const legacyRole = (user?.user_metadata?.role as string) || (appMetadata.role as string) || "";
  const roles = userRoles.length > 0 ? userRoles : (legacyRole ? [legacyRole] : []);

  const isParent = roles.includes("parent");
  const isSchoolStaff = roles.some((r) => r === "school_admin" || r === "school_treasurer");
  const isMerchantStaff = roles.some((r) => r === "merchant_staff" || r === "merchant_owner");
  const isPlatformAdmin = roles.some((r) => r === "platform_admin" || r === "platform_support");

  // 2. Handle /login & /register pages for authenticated users
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
    if (isSchoolStaff || isPlatformAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/school";
      return NextResponse.redirect(url);
    } else if (isMerchantStaff) {
      const url = request.nextUrl.clone();
      url.pathname = "/pos";
      return NextResponse.redirect(url);
    } else if (isParent) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // If authenticated user has no specific role assigned yet, stay on page
    return supabaseResponse;
  }

  // 3. Bypass auth checks for whitelisted public routes
  if (isPublicRoute) {
    return supabaseResponse;
  }

  // 4. Handle root path "/"
  if (pathname === "/") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    if (isSchoolStaff || isPlatformAdmin) url.pathname = "/school";
    else if (isMerchantStaff) url.pathname = "/pos";
    else if (isParent) url.pathname = "/dashboard";
    else url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 5. Unauthenticated user trying to access protected paths
  if (!user) {
    const url = request.nextUrl.clone();
    if (pathname.startsWith("/school")) {
      url.pathname = "/login/school";
    } else if (pathname.startsWith("/pos") || pathname.startsWith("/canteen")) {
      url.pathname = "/login/merchant";
    } else if (
      pathname.startsWith("/parent") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/pagu") ||
      pathname.startsWith("/vault") ||
      pathname.startsWith("/spp") ||
      pathname.startsWith("/settings") ||
      pathname === "/ai"
    ) {
      url.pathname = "/login/parent";
    } else {
      url.pathname = "/login";
    }
    return NextResponse.redirect(url);
  }

  // 6. Strict Persona Route Enforcement for authenticated users
  if (pathname.startsWith("/school")) {
    if (!isSchoolStaff && !isPlatformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isMerchantStaff ? "/pos" : isParent ? "/dashboard" : "/login/school";
      return NextResponse.redirect(redirectUrl);
    }
  } else if (pathname.startsWith("/pos") || pathname.startsWith("/canteen")) {
    if (!isMerchantStaff && !isPlatformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isSchoolStaff ? "/school" : isParent ? "/dashboard" : "/login/merchant";
      return NextResponse.redirect(redirectUrl);
    }
  } else if (
    pathname.startsWith("/parent") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/pagu") ||
    pathname.startsWith("/vault") ||
    pathname.startsWith("/spp") ||
    pathname.startsWith("/settings") ||
    pathname === "/ai"
  ) {
    if (!isParent && !isPlatformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isSchoolStaff ? "/school" : isMerchantStaff ? "/pos" : "/login/parent";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|sitemap.xml|robots.txt|icons/|img/|manifest.json).*)",
  ],
};
