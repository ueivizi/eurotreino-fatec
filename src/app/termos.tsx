import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { TERMS_OF_USE } from '@/features/legal/documents';

export default function TermsOfUseScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} />;
}
