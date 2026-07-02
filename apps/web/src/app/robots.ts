import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/docs"],
      // Sessions are private and ephemeral; the API is not a browseable surface.
      disallow: ["/api/", "/session/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
