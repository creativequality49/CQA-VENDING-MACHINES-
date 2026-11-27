import { requireCqaOwner } from "@/lib/cqa-owner-auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const headers = {"Cache-Control":"no-store"};
  try {
    const { business } = await requireCqaOwner(req, new URL(req.url).searchParams.get("businessId") || undefined);
    return Response.json({ businessId: business.id, name: business.name, status: "pending_provisioning", enabled: false }, {headers});
  } catch (error) {
    const status = (error as {status?: number})?.status;
    return Response.json({error:"Owner access unavailable"}, {status: status === 401 || status === 403 ? status : 500, headers});
  }
}
