import { getSupabaseAdminClient } from "@/lib/supabase";

export type ContentDrop = {
  id: string;
  title: string;
  releaseAt: string;
  machineSlug: string;
  subscriberOnly: boolean;
  released: boolean;
};

export async function getDrops(): Promise<ContentDrop[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("content_drops")
    .select("id,title,release_at,machine_slug,subscriber_only,status")
    .order("release_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load content drops: ${error.message}`);
  }

  return (data ?? []).map((drop) => ({
    id: drop.id,
    title: drop.title,
    releaseAt: drop.release_at,
    machineSlug: drop.machine_slug ?? "store",
    subscriberOnly: drop.subscriber_only,
    released: drop.status === "released"
  }));
}

export async function releaseScheduledDrops(now = new Date()): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const releasedAt = now.toISOString();

  const { data, error } = await supabase
    .from("content_drops")
    .update({
      status: "released",
      released_at: releasedAt,
      updated_at: releasedAt
    })
    .eq("status", "scheduled")
    .lte("release_at", releasedAt)
    .select("id");

  if (error) {
    throw new Error(`Unable to release scheduled drops: ${error.message}`);
  }

  return data?.length ?? 0;
}
