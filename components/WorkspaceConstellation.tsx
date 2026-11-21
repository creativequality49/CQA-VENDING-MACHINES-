"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";
import styles from "./WorkspaceConstellation.module.css";

export type WorkspaceConstellationNode = { id: string; label: string; href: string; description?: string };
type Props = { variant?: "ambient" | "navigation"; nodes?: WorkspaceConstellationNode[] };
type Point = { x: number; y: number };

const destinations: WorkspaceConstellationNode[] = [
  { id: "overview", label: "Workspace", href: "/owner/dashboard", description: "Your business overview and account controls." },
  { id: "machine", label: "Your machine", href: "/owner/setup", description: "Build and edit your business storefront." },
  { id: "orders", label: "Orders", href: "/owner/orders", description: "Review customer briefs and prepare deliveries." },
  { id: "files", label: "Digital files", href: "/owner/marketplace-upload", description: "Manage protected product files." },
  { id: "workers", label: "AI workers", href: "/owner/workers", description: "Open your business worker tools." },
  { id: "automations", label: "Automations", href: "/owner/automations", description: "Manage your business workflows." },
  { id: "connections", label: "Connections", href: "/owner/integrations", description: "Review connected business services." },
];
const anchors: Point[] = [
  { x: 50, y: 49 }, { x: 21, y: 29 }, { x: 50, y: 13 }, { x: 79, y: 29 },
  { x: 79, y: 69 }, { x: 50, y: 86 }, { x: 21, y: 69 },
];
const colors = ["#c7e8ff", "#72d3fa", "#aaa5ff", "#f1cc8c", "#73daca", "#b9a8ec", "#91b9de"];

// Fixed geometry is decorative, not customer data. No randomness or time-based
// values are used, so server and browser render the same constellation.
const satellites = Array.from({ length: 168 }, (_, index) => {
  const cluster = index % anchors.length;
  const angle = index * 2.399963229728653 + cluster * 0.53;
  const radius = 3.2 + ((index * 13) % 101) / 9;
  return {
    cluster,
    x: Number((anchors[cluster].x + Math.cos(angle) * radius).toFixed(4)),
    y: Number((anchors[cluster].y + Math.sin(angle) * radius * 0.94).toFixed(4)),
  };
});
const percent = (value: number) => `${value}%`;

function NetworkDrawing() {
  return <svg className={styles.drawing} width="100%" height="100%" aria-hidden="true" focusable="false">
    <g className={styles.mainLinks}>{anchors.slice(1).map((point, index) => <line key={index} x1="50%" y1="49%" x2={percent(point.x)} y2={percent(point.y)} />)}</g>
    <g className={styles.fineLinks}>{satellites.map((point, index) => {
      const hub = anchors[point.cluster];
      const peer = satellites[(index + anchors.length) % satellites.length];
      return <g key={index}>
        <line x1={percent(hub.x)} y1={percent(hub.y)} x2={percent(point.x)} y2={percent(point.y)} />
        <line x1={percent(point.x)} y1={percent(point.y)} x2={percent(peer.x)} y2={percent(peer.y)} />
        {index % 3 === 0 && <line x1={percent(point.x)} y1={percent(point.y)} x2={percent(anchors[(point.cluster + 1) % anchors.length].x)} y2={percent(anchors[(point.cluster + 1) % anchors.length].y)} />}
      </g>;
    })}</g>
    {anchors.map((point, index) => <g key={index}>
      <circle cx={percent(point.x)} cy={percent(point.y)} r={index === 0 ? 28 : 19} fill={colors[index]} opacity="0.035" />
      <circle cx={percent(point.x)} cy={percent(point.y)} r={index === 0 ? 13 : 9} fill="none" stroke={colors[index]} strokeWidth="0.65" opacity="0.36" />
      <circle cx={percent(point.x)} cy={percent(point.y)} r={index === 0 ? 4.5 : 3} fill={colors[index]} />
    </g>)}
    {satellites.map((point, index) => <circle key={index} cx={percent(point.x)} cy={percent(point.y)} r={index % 11 === 0 ? 3.6 : index % 3 === 0 ? 2.3 : 1.6} fill={index % 5 === 0 ? "#a6b3c5" : colors[point.cluster]} opacity={index % 5 === 0 ? 0.5 : 0.9} />)}
  </svg>;
}

export function WorkspaceConstellation({ variant = "navigation", nodes = destinations }: Props) {
  const titleId = useId();
  const [zoom, setZoom] = useState(1);
  if (variant === "ambient") return <div data-theme-art className={`${styles.frame} ${styles.ambient}`} aria-hidden="true"><div className={styles.stage}><NetworkDrawing /></div></div>;
  const links = nodes.filter(node => node.label.trim() && node.href.startsWith("/") && !node.href.startsWith("//") && !/[\\\u0000-\u0020]/.test(node.href));
  const graphLinks = links.slice(0, anchors.length);
  return <section data-theme-art className={styles.frame} aria-labelledby={titleId}>
    <div className={styles.header}><div><span className={styles.kicker}>Connected workspace</span><h2 id={titleId}>Find your next move.</h2><p>Open a destination on the map, or use the list below.</p></div>
      <div className={styles.controls} role="group" aria-label="Map view controls">
        <button type="button" aria-label="Zoom map out" disabled={zoom <= 0.8} onClick={() => setZoom(value => Math.max(0.8, Number((value - 0.2).toFixed(1))))}>−</button>
        <button type="button" className={styles.reset} aria-label="Reset map view" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Zoom map in" disabled={zoom >= 1.4} onClick={() => setZoom(value => Math.min(1.4, Number((value + 0.2).toFixed(1))))}>+</button>
      </div>
    </div>
    <div className={styles.stage}>
      <div className={styles.map} style={{ "--map-zoom": zoom } as CSSProperties}>
        <NetworkDrawing />
        <nav aria-label="Workspace map destinations" className={styles.nodeLayer}>{graphLinks.map((node, index) => <Link key={`${node.id}-${index}`} href={node.href} className={`${styles.node} ${index === 0 ? styles.central : ""}`} style={{ left: percent(anchors[index].x), top: percent(anchors[index].y), "--node-color": colors[index] } as CSSProperties} aria-label={node.description ? `${node.label}. ${node.description}` : node.label} onFocus={() => { if (zoom !== 1) setZoom(1); }}><i aria-hidden="true" /><span>{node.label}</span><span className={styles.arrow} aria-hidden="true">↗</span></Link>)}</nav>
      </div>
      <span className={styles.cornerMark} aria-hidden="true">CQA / WORKSPACE MAP</span>
    </div>
    <details className={styles.directory}><summary>View destinations as a list <span aria-hidden="true">↓</span></summary><nav aria-label="Workspace destination list"><ul>{links.map((node, index) => <li key={`${node.id}-${index}`}><Link href={node.href}><span>{node.label}<i aria-hidden="true">↗</i></span>{node.description && <small>{node.description}</small>}</Link></li>)}</ul></nav></details>
  </section>;
}
