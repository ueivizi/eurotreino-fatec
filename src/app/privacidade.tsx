import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { PRIVACY_POLICY } from '@/features/legal/documents';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} />;
}
