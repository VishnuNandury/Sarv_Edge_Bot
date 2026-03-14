import dynamic from 'next/dynamic';

const CustomerDetailContent = dynamic(() => import('./CustomerDetailContent'), { ssr: false });

// Static export requires at least one prerendered path. Real data loads client-side.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return <CustomerDetailContent id={params.id} />;
}
