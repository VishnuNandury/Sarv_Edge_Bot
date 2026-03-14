import dynamic from 'next/dynamic';

const CampaignDetailContent = dynamic(() => import('./CampaignDetailContent'), { ssr: false });

// Static export requires at least one prerendered path. Real data loads client-side.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return <CampaignDetailContent id={params.id} />;
}
