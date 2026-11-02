import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from './api';

export function useApiQuery(key, path, query, options = {}) {
  return useQuery({ queryKey: [...(Array.isArray(key) ? key : [key]), query], queryFn: () => api(path, { query }), ...options });
}

/** Mutation with toast feedback and cache invalidation. */
export function useApiMutation({ method = 'POST', path, invalidate = [], success, onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, path: override } = {}) => api(override || path, { method, body }),
    onSuccess: (data, vars) => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (name, { type } = {}) => ({
    name,
    value: type === 'checkbox' ? undefined : values[name] ?? '',
    checked: type === 'checkbox' ? !!values[name] : undefined,
    onChange: (e) => setValues((v) => ({ ...v, [name]: type === 'checkbox' ? e.target.checked : e.target.value })),
  });
  return { values, setValues, bind, set: (name, value) => setValues((v) => ({ ...v, [name]: value })) };
}
