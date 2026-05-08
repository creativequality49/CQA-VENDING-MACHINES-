export type ContentDrop = {
  id: string;
  title: string;
  releaseAt: string;
  machineSlug: string;
  subscriberOnly: boolean;
  assetKey: string;
  released: boolean;
};

const drops: ContentDrop[] = [
  {
    id: "drop-scarlett-1",
    title: "Scarlett Pose Pack Vol. 1",
    releaseAt: new Date(Date.now() - 86400000).toISOString(),
    machineSlug: "scarlett-vault",
    subscriberOnly: true,
    assetKey: "drops/scarlett/pose-pack-1.zip",
    released: false,
  },
  {
    id: "drop-store-1",
    title: "CQA Vending Ad Script Bundle",
    releaseAt: new Date(Date.now() + 86400000).toISOString(),
    machineSlug: "store",
    subscriberOnly: true,
    assetKey: "drops/store/ad-scripts-1.zip",
    released: false,
  },
];

export function getDrops() {
  return drops;
}

export function releaseScheduledDrops(now = new Date()) {
  let released = 0;
  drops.forEach((drop) => {
    if (!drop.released && new Date(drop.releaseAt) <= now) {
      drop.released = true;
      released += 1;
    }
  });
  return released;
}
