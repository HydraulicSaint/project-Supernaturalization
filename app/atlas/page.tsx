import dynamic from 'next/dynamic';
const Atlas = dynamic(() => import('@/components/atlas/Atlas'), { ssr: false });
export default function AtlasPage() { return <Atlas />; }
