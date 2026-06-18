import { BrandedMachine } from "./branded-machine";
import type { MachinePreview } from "./types";

export function MachinePreviewGrid({ machines }: { machines: MachinePreview[] }) {
  return <section className="machine-preview-grid">{machines.map((machine) => <BrandedMachine key={machine.slug} machine={machine} href={`/machines/${machine.slug}`} />)}</section>;
}
