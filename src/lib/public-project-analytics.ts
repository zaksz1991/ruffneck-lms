import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BOT_OR_PREVIEW_USER_AGENT = /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|google-inspectiontool|lighthouse|pagespeed|prerender|headlesschrome/i;

type RpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function validSlug(slug: string): boolean {
  return slug.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function referrerHostname(referrer: string | null | undefined): string {
  if (!referrer) return "(direct)";
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "(direct)";
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname.length > 120 || !/^[a-z0-9.-]+$/.test(hostname)) {
      return "(direct)";
    }
    return hostname;
  } catch {
    return "(direct)";
  }
}

/**
 * Records one aggregate page view for an approved, currently published project.
 * It stores only the referring hostname and UTC date; no IP, full referrer URL,
 * user agent, cookie, or visitor identifier is written to the database.
 * Analytics failures never break the public project response.
 */
export async function recordPublicProjectView(
  slug: string,
  referrer: string | null | undefined,
  userAgent: string | null | undefined,
): Promise<void> {
  if (!validSlug(slug)) return;
  if (userAgent && BOT_OR_PREVIEW_USER_AGENT.test(userAgent.slice(0, 500))) return;

  try {
    const supabase = createAdminClient();
    const rpc = supabase as unknown as RpcClient;
    const result = await rpc.rpc("record_published_lab_project_view", {
      p_slug: slug,
      p_referrer_host: referrerHostname(referrer),
    });
    if (result.error) {
      console.warn("Public project view could not be recorded:", result.error.message);
    }
  } catch (error) {
    // Viewing a published project must continue to work if analytics are unavailable.
    console.warn(
      "Public project analytics are unavailable:",
      error instanceof Error ? error.message : "Unknown analytics error",
    );
  }
}
