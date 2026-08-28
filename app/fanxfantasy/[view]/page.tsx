import { notFound } from "next/navigation";
import FanXFantasyApp from "../../../components/FanXFantasyApp";

const views = ["explore","profile","feed","unlock","tiers","messages","marketplace","checkout","success","library","dashboard","character-studio","create","analytics"] as const;
type View = typeof views[number];

export default async function FanXFantasyViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!views.includes(view as View)) notFound();
  return <FanXFantasyApp view={view as View} />;
}
