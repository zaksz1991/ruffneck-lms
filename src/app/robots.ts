import type { MetadataRoute } from "next";

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ruffneck-lms.vercel.app").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/showcase", "/p/"],
      disallow: [
        "/admin/",
        "/student/",
        "/api/",
        "/login",
        "/signup",
        "/account/",
      ],
    },
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
    host: PUBLIC_SITE_URL,
  };
}
