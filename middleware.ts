import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware — Session refresh + dedicated login portal routing & strict persona isolation.
 * Reference: Schema v3 Custom Access Token Hooks (§15 jwt_app_meta)
 *
 * App Metadata Claims:
 * - roles: string[]
 * - school_ids: string[]
 * - merchant_ids: string[]
 * - parent_id: string | null
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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
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

  // Extract roles from app_metadata (Schema v3 JWT injection)
  const appMetadata = user?.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const legacyRole = (user?.user_metadata?.role as string) || (appMetadata.role as string) || "";
  const roles = userRoles.length > 0 ? userRoles : (legacyRole ? [legacyRole] : []);

  const isParent = roles.includes("parent");
  const isSchoolStaff = roles.some((r) => r === "school_admin" || r === "school_treasurer");
  const isMerchantStaff = roles.some((r) => r === "merchant_staff" || r === "merchant_owner");
  const isPlatformAdmin = roles.some((r) => r === "platform_admin" || r === "platform_support");

  // Webhooks path - always unauthenticated
  if (pathname.startsWith("/api/webhooks")) {
    return supabaseResponse;
  }

  // If user is ALREADY logged in and attempts to visit /login or /login/*
  if (user && pathname.startsWith("/login")) {
    const redirectUrl = request.nextUrl.clone();
    if (isSchoolStaff || isPlatformAdmin) {
      redirectUrl.pathname = "/school";
    } else if (isMerchantStaff) {
      redirectUrl.pathname = "/pos";
    } else if (isParent) {
      redirectUrl.pathname = "/parent";
    } else {
      redirectUrl.pathname = "/parent";
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Unauthenticated access to /login or /login/* is allowed
  if (pathname.startsWith("/login")) {
    return supabaseResponse;
  }

  // Unauthenticated user attempting to access protected route
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Strict Persona Route Enforcement
  if (pathname.startsWith("/school")) {
    if (!isSchoolStaff && !isPlatformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isMerchantStaff ? "/pos" : isParent ? "/parent" : "/login/school";
      return NextResponse.redirect(redirectUrl);
    }
  } else if (pathname.startsWith("/pos")) {
    if (!isMerchantStaff && !isPlatformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isSchoolStaff ? "/school" : isParent ? "/parent" : "/login/merchant";
      return NextResponse.redirect(redirectUrl);
    }
  } else if (pathname.startsWith("/parent") || pathname.startsWith("/dashboard") || pathname.startsWith("/pagu") || pathname.startsWith("/vault")) {
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
    /*
     * Match all request paths except static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icons/|manifest.json).*)",
  ],
};
