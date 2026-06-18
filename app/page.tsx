import Link from 'next/link';
import { MachineGrid } from '@/components/machines/MachineGrid';

export default function Home(){return <main className='container'><section className='hero glass-card'><h1 className='section-title glow'>CQA DIGITAL VENDING MACHINES</h1><p className='small'>AI Agents • Automation • Revenue Systems</p><div className='hero-cta'><Link href='/signup' className='cta'>Start Building</Link><Link href='/machines' className='cta secondary'>Explore Machines</Link><Link href='/pricing' className='cta secondary'>Join Elite</Link></div></section><MachineGrid/></main>}
