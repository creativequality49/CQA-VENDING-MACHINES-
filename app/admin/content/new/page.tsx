import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/content-service";
import { uploadPrivateSupabaseObject } from "@/lib/supabase-storage";

export const dynamic="force-dynamic";

async function createContent(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "");
  const slug = String(formData.get("slug") ?? title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""));
  const file = formData.get("file") as File | null;
  const preview = formData.get("preview") as File | null;
  const filePath = file?.size ? await uploadPrivateSupabaseObject(`content/${slug}/${file.name}`, file) : null;
  const previewImagePath = preview?.size ? await uploadPrivateSupabaseObject(`previews/${slug}/${preview.name}`, preview) : null;
  await prisma.contentItem.create({data:{title,slug,description:String(formData.get("description") ?? ""),contentType:String(formData.get("contentType") ?? "download"),accessType:String(formData.get("accessType") ?? "free"),assignedMachineId:String(formData.get("machineId") || "") || null,assignedProductId:String(formData.get("productId") || "") || null,assignedSubscriptionTier:String(formData.get("subscriptionTier") || "") || null,releaseDate:formData.get("releaseDate") ? new Date(String(formData.get("releaseDate"))) : null,status:String(formData.get("status") ?? "draft"),filePath,previewImagePath}});
  redirect("/admin/content/library");
}

export default async function Page(){const [machines,products]=await Promise.all([safeQuery([],()=>prisma.machine.findMany({where:{status:"active"}})),safeQuery([],()=>prisma.product.findMany({where:{status:"active"}}))]);return <main className="container"><h1>Upload Content</h1><form action={createContent} className="glass-card admin-form"><input name="title" placeholder="Title" required/><input name="slug" placeholder="slug"/><textarea name="description" placeholder="Description"/><select name="contentType"><option value="download">Download</option><option value="video">Video</option><option value="template">Template</option></select><select name="accessType"><option value="free">Free</option><option value="product">Paid Product</option><option value="subscription">Subscription</option><option value="bundle">Bundle</option><option value="admin">Admin Only</option></select><select name="machineId"><option value="">Assign machine</option>{machines.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><select name="productId"><option value="">Assign product</option>{products.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select><input name="subscriptionTier" placeholder="Subscription tier"/><input name="releaseDate" type="datetime-local"/><input name="file" type="file"/><input name="preview" type="file"/><select name="status"><option value="draft">Save draft</option><option value="scheduled">Schedule</option><option value="published">Publish</option></select><button className="cta" type="submit">Save Content</button></form></main>}
