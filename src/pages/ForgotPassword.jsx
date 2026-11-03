import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requireSupabase } from '@/api/supabaseClient';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      const { error: authError } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (authError) throw authError;
      setMessage('If this account is registered, a password reset link has been sent.');
    } catch (e) { setError(e.message || 'Unable to send reset email.'); }
    finally { setLoading(false); }
  };
  return <AuthLayout icon={Mail} title="Reset password" subtitle="Enter your administrator email address.">
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      {message && <p className="text-sm text-emerald-600">{message}</p>}{error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
    </form>
    <Link to="/login" className="mt-4 inline-flex text-sm text-primary hover:underline">Back to login</Link>
  </AuthLayout>;
}
