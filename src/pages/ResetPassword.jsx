import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requireSupabase } from '@/api/supabaseClient';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      const { error: authError } = await requireSupabase().auth.updateUser({ password });
      if (authError) throw authError;
      setMessage('Password updated. You can now sign in.');
    } catch (e) { setError(e.message || 'Unable to update password.'); }
    finally { setLoading(false); }
  };
  return <AuthLayout icon={Lock} title="Choose a new password" subtitle="Use a strong password for your administrator account.">
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="password">New password</Label><Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {message && <p className="text-sm text-emerald-600">{message}</p>}{error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</Button>
    </form>
    <Link to="/login" className="mt-4 inline-flex text-sm text-primary hover:underline">Back to login</Link>
  </AuthLayout>;
}
