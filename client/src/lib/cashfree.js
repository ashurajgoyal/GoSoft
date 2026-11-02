/** Loads Cashfree's official checkout SDK (v3) on demand and opens the hosted checkout. */
let loading = null;
function loadSdk() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve(window.Cashfree);
    s.onerror = () => { loading = null; reject(new Error('Could not load Cashfree checkout. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}

export async function openCashfreeCheckout({ paymentSessionId, mode }) {
  const Cashfree = await loadSdk();
  const cf = Cashfree({ mode: mode === 'production' ? 'production' : 'sandbox' });
  return cf.checkout({ paymentSessionId, redirectTarget: '_self' });
}
