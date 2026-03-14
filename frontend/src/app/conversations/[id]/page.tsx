import dynamic from 'next/dynamic';

const ConversationDetailContent = dynamic(() => import('./ConversationDetailContent'), { ssr: false });

// Static export requires at least one prerendered path. Real data loads client-side.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  return <ConversationDetailContent id={params.id} />;
}
