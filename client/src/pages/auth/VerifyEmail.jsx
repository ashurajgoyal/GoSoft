import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, PageLoader } from '../../components/ui';
import { post } from '../../lib/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'loading' });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    post('/auth/verify-email', { token: params.get('token') || '' })
      .then((r) => setState({ status: 'ok', message: r.data.message }))
      .catch((e) => setState({ status: 'error', message: e.message }));
  }, [params]);

  if (state.status === 'loading') return <PageLoader />;
  const ok = state.status === 'ok';
  return (
    <div className="text-center">
      {ok ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /> : <XCircle className="mx-auto h-14 w-14 text-red-500" />}
      <h1 className="mt-5 text-2xl font-extrabold text-navy-900 dark:text-white">{ok ? 'Email verified' : 'Verification failed'}</h1>
      <p className="mt-3 text-slate-500">{state.message}</p>
      <Link to="/login"><Button className="mt-8">Continue to login</Button></Link>
    </div>
  );
}
