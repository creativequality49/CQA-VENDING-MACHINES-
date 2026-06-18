import type { CSSProperties } from 'react';
import Link from 'next/link';

const machines=[
{name:'Pink',slug:'pink',color:'#ff008c',price:'$69 AUD'},
{name:'Blue',slug:'blue',color:'#00cfff',price:'$169 AUD'},
{name:'Cyan',slug:'cyan',color:'#00f0ff',price:'$269 AUD'},
{name:'Gold',slug:'gold',color:'#ffcc33',price:'$1690 AUD'},
{name:'Purple',slug:'purple',color:'#7a5cff',price:'$3690 AUD'},
];
export function MachineGrid(){return <div className='machine-grid'>{machines.map(m=><article key={m.slug} className='machine-card' style={{ '--machine': m.color } as CSSProperties}><div className='machine-face'><h3>{m.name} Machine</h3><p>{m.price}</p><p className='small'>AI Agents • Automation • Revenue Systems</p><Link href={`/machine/${m.slug}`} className='cta'>Explore</Link></div><div className='machine-back'><p>Includes premium vault, automations, and downloads.</p></div></article>)}</div>}
