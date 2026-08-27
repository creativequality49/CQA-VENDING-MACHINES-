import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const SearchSchema = z.object({
  query: z.string().min(2).max(120),
  location: z.string().min(2).max(120),
  limit: z.number().int().min(1).max(20).default(20),
  accessKey: z.string().min(8),
});

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
};

function scoreLead(place: GooglePlace) {
  let score = 30;
  if (place.websiteUri) score += 20;
  if (place.nationalPhoneNumber) score += 15;
  if ((place.rating ?? 0) >= 4) score += 15;
  if ((place.userRatingCount ?? 0) >= 20) score += 10;
  if ((place.userRatingCount ?? 0) >= 100) score += 5;
  if (place.businessStatus === "OPERATIONAL") score += 5;
  return Math.min(100, score);
}

export async function POST(req: Request) {
  try {
    const parsed = SearchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search request", details: parsed.error.flatten() }, { status: 400 });
    }

    const expectedKey = process.env.CQA_LEAD_MACHINE_ACCESS_KEY;
    if (!expectedKey || parsed.data.accessKey !== expectedKey) {
      return NextResponse.json({ error: "Invalid workspace access key" }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Lead provider is not configured yet" }, { status: 503 });
    }

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.websiteUri",
          "places.rating",
          "places.userRatingCount",
          "places.googleMapsUri",
          "places.primaryTypeDisplayName",
          "places.businessStatus",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: `${parsed.data.query} in ${parsed.data.location}`,
        pageSize: parsed.data.limit,
        languageCode: "en",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const providerError = await response.text();
      console.error("Google Places error", response.status, providerError);
      return NextResponse.json({ error: "Lead provider request failed" }, { status: 502 });
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    const seen = new Set<string>();
    const leads = (data.places ?? [])
      .map((place) => ({
        id: place.id ?? crypto.randomUUID(),
        businessName: place.displayName?.text ?? "Unknown business",
        category: place.primaryTypeDisplayName?.text ?? "Business",
        address: place.formattedAddress ?? "",
        phone: place.nationalPhoneNumber ?? "",
        website: place.websiteUri ?? "",
        rating: place.rating ?? null,
        reviews: place.userRatingCount ?? 0,
        mapsUrl: place.googleMapsUri ?? "",
        status: place.businessStatus ?? "UNKNOWN",
        leadScore: scoreLead(place),
      }))
      .filter((lead) => {
        const key = `${lead.businessName.toLowerCase()}|${lead.address.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.leadScore - a.leadScore);

    return NextResponse.json({
      query: parsed.data.query,
      location: parsed.data.location,
      count: leads.length,
      generatedAt: new Date().toISOString(),
      leads,
    });
  } catch (error) {
    console.error("Lead search failed", error);
    return NextResponse.json({ error: "Lead search failed" }, { status: 500 });
  }
}
