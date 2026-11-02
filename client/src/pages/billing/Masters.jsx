import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import ResourcePage from '../../components/ResourcePage';
import { Badge } from '../../components/ui';
import { inr, date } from '../../lib/format';

const STATES = [['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory']];
export const STATE_OPTIONS = STATES.map(([c, n]) => [c, `${c} – ${n}`]);
export const stateName = (c) => STATES.find((s) => s[0] === c)?.[1] || c;

export function Customers() {
  return <ResourcePage title="Customers" singular="customer" endpoint="/company/billing/customers" perm="billing.customer" csv
    columns={[{ key: 'name', label: 'Name', render: (c) => <><p className="font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.email}</p></> },
      { key: 'gstin', label: 'GSTIN' }, { key: 'phone', label: 'Phone' }, { label: 'State', render: (c) => stateName(c.stateCode) || '—' }]}
    rowActions={(c) => <Link to={`/app/billing/customers/${c._id}/ledger`} className="rounded-lg p-1.5 text-slate-500 hover:bg-soft-100 dark:hover:bg-white/10" title="Ledger"><BookOpen className="h-4 w-4" /></Link>}
    fields={[{ name: 'name', label: 'Business name', required: true }, { name: 'contactPerson', label: 'Contact person' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' },
      { name: 'gstin', label: 'GSTIN', upper: true, maxLength: 15 }, { name: 'stateCode', label: 'State (place of supply)', type: 'select', options: STATE_OPTIONS },
      { section: 'Billing address' }, { name: 'billingAddress.line1', label: 'Address', full: true }, { name: 'billingAddress.city', label: 'City' }, { name: 'billingAddress.pincode', label: 'PIN code' },
      { section: 'Accounts' }, { name: 'openingBalance', label: 'Opening balance (₹)', type: 'number' }, { name: 'creditDays', label: 'Credit days', type: 'number' }, { name: 'notes', label: 'Notes', type: 'textarea' }]} />;
}

export function Vendors() {
  return <ResourcePage title="Vendors" singular="vendor" endpoint="/company/billing/vendors" perm="billing.vendor"
    columns={[{ key: 'name', label: 'Name' }, { key: 'gstin', label: 'GSTIN' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }]}
    fields={[{ name: 'name', label: 'Vendor name', required: true }, { name: 'contactPerson', label: 'Contact person' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' },
      { name: 'gstin', label: 'GSTIN', upper: true, maxLength: 15 }, { name: 'stateCode', label: 'State', type: 'select', options: STATE_OPTIONS }, { name: 'address.line1', label: 'Address', full: true }, { name: 'notes', label: 'Notes', type: 'textarea' }]} />;
}

const RATES = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28];
export function Products() {
  return <ResourcePage title="Products & services" singular="item" endpoint="/company/billing/products" perm="billing.product"
    filters={[{ name: 'type', label: 'Type', options: [['goods', 'Goods'], ['service', 'Services']] }]} defaults={{ type: 'goods', taxRate: 18, unit: 'NOS' }}
    columns={[{ key: 'name', label: 'Name', render: (p) => <><p className="font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.sku}</p></> }, { key: 'type', label: 'Type', render: (p) => <Badge color={p.type === 'service' ? 'violet' : 'blue'}>{p.type}</Badge> },
      { key: 'hsnSac', label: 'HSN/SAC' }, { label: 'Rate', render: (p) => `${inr(p.rate)} / ${p.unit}` }, { label: 'GST', render: (p) => `${p.taxRate}%${p.taxInclusive ? ' (incl.)' : ''}` }]}
    fields={[{ name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', type: 'select', required: true, options: [['goods', 'Goods'], ['service', 'Service']] },
      { name: 'sku', label: 'SKU / code' }, { name: 'hsnSac', label: 'HSN / SAC code' }, { name: 'unit', label: 'Unit', type: 'select', required: true, options: ['NOS', 'PCS', 'KGS', 'LTR', 'MTR', 'BOX', 'PKT', 'HRS', 'DAY', 'MON'] },
      { name: 'rate', label: 'Selling rate (₹)', type: 'number', required: true }, { name: 'taxRate', label: 'GST rate', type: 'select', required: true, options: RATES.map((r) => [r, `${r}%`]) },
      { name: 'taxInclusive', label: 'Rate includes GST', type: 'checkbox' }, { name: 'description', label: 'Description', type: 'textarea' }]}
    transformIn={(b) => ({ ...b, taxRate: Number(b.taxRate) })} />;
}

const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Travel', 'Office supplies', 'Marketing', 'Software', 'Professional fees', 'Repairs', 'Taxes', 'Other'];
export function Expenses() {
  return <ResourcePage title="Expenses" singular="expense" endpoint="/company/billing/expenses" perm="billing.expense" csv
    filters={[{ name: 'category', label: 'Category', options: EXPENSE_CATEGORIES }, { name: 'status', label: 'Status', options: ['pending', 'approved', 'rejected'] }]}
    defaults={{ date: new Date().toISOString().slice(0, 10), paymentMode: 'bank', status: 'approved', category: 'Office supplies' }}
    columns={[{ label: 'Date', render: (e) => date(e.date) }, { key: 'category', label: 'Category' }, { label: 'Vendor', render: (e) => e.vendor?.name || '—' }, { key: 'description', label: 'Description' },
      { label: 'Amount', render: (e) => <span className="font-semibold">{inr(e.amount)}</span> }, { key: 'paymentMode', label: 'Mode' }, { label: 'Status', render: (e) => <Badge color={e.status === 'approved' ? 'green' : e.status === 'rejected' ? 'red' : 'amber'}>{e.status}</Badge> }]}
    fields={[{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'category', label: 'Category', type: 'select', required: true, options: EXPENSE_CATEGORIES },
      { name: 'vendor', label: 'Vendor', type: 'ref', endpoint: '/company/billing/vendors' }, { name: 'amount', label: 'Amount (₹)', type: 'number', required: true }, { name: 'gstAmount', label: 'GST included (₹)', type: 'number' },
      { name: 'paymentMode', label: 'Payment mode', type: 'select', options: ['cash', 'bank', 'upi', 'card', 'cheque', 'other'] }, { name: 'reference', label: 'Reference / bill no.' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected'] }, { name: 'description', label: 'Description', type: 'textarea' }]} />;
}
