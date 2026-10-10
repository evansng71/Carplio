'use client';

import { useParams } from 'next/navigation';
import { QuoteFiche } from '@/components/QuoteFiche';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <QuoteFiche quoteId={id} />;
}
