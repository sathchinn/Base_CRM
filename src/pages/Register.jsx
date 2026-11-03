import { Link } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import { ShieldCheck } from 'lucide-react';

export default function Register() {
  return (
    <AuthLayout icon={ShieldCheck} title="Access by invitation" subtitle="TTC CRM is restricted to approved administrators.">
      <p className="text-sm text-muted-foreground">Self-service registration is disabled. Ask the TTC owner to authorize your Supabase account.</p>
      <Link to="/login" className="mt-5 inline-flex text-sm font-medium text-primary hover:underline">Back to login</Link>
    </AuthLayout>
  );
}
