export function MachineControlPanel({ status = "Online" }: { status?: string }) {
  return (
    <aside className="machine-control-panel" aria-label="Machine controls">
      <span>Status: {status}</span>
      <ol>
        <li>Select</li>
        <li>Pay</li>
        <li>Unlock</li>
      </ol>
      <div className="control-light" />
    </aside>
  );
}
