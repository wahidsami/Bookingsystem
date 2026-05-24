'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';
import { Currency } from '@/components/Currency';

type GiftPackage = {
  id: string;
  title_en: string;
  title_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  displayOrder: number;
  priceAmount: number;
  walletCreditAmount: number;
  bonusAmount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
};

type GiftTransaction = {
  id: string;
  status: string;
  purchaseAmount: number;
  totalCreditAmount: number;
  createdAt: string;
  sender?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  recipient?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  package?: { id: string; title_en?: string; title_ar?: string } | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
};

const defaultForm = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  displayOrder: 0,
  priceAmount: 0,
  walletCreditAmount: 0,
  bonusAmount: 0,
  startsAt: '',
  endsAt: '',
  isActive: true
};

export default function GiftCardsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [transactions, setTransactions] = useState<GiftTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'packages' | 'transactions'>('packages');
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const title = useMemo(() => (editingId ? 'Edit Gift Package' : 'Create Gift Package'), [editingId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [packagesRes, txRes] = await Promise.all([
        adminApi.getGiftPackages(),
        adminApi.getGiftTransactions({ limit: 100, ...(statusFilter !== 'all' ? { status: statusFilter } : {}) })
      ]);
      setPackages(packagesRes.packages || []);
      setTransactions(txRes.transactions || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load gift cards data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const startEdit = (item: GiftPackage) => {
    setEditingId(item.id);
    setForm({
      title_en: item.title_en || '',
      title_ar: item.title_ar || '',
      description_en: item.description_en || '',
      description_ar: item.description_ar || '',
      displayOrder: item.displayOrder || 0,
      priceAmount: Number(item.priceAmount || 0),
      walletCreditAmount: Number(item.walletCreditAmount || 0),
      bonusAmount: Number(item.bonusAmount || 0),
      startsAt: item.startsAt ? item.startsAt.slice(0, 16) : '',
      endsAt: item.endsAt ? item.endsAt.slice(0, 16) : '',
      isActive: item.isActive !== false
    });
    setActiveTab('packages');
  };

  const submitPackage = async () => {
    try {
      if (!form.title_en.trim() || !form.title_ar.trim()) {
        setError('English and Arabic titles are required.');
        return;
      }
      setSaving(true);
      setError(null);

      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      };

      if (editingId) {
        await adminApi.updateGiftPackage(editingId, payload);
      } else {
        await adminApi.createGiftPackage(payload);
      }
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save gift package');
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async (id: string) => {
    if (!window.confirm('Delete this gift package?')) return;
    try {
      await adminApi.deleteGiftPackage(id);
      await loadData();
      if (editingId === id) resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete gift package');
    }
  };

  const senderLabel = (tx: GiftTransaction) => {
    const name = `${tx.sender?.firstName || ''} ${tx.sender?.lastName || ''}`.trim();
    return name || tx.sender?.email || 'N/A';
  };

  const recipientLabel = (tx: GiftTransaction) => {
    const name = `${tx.recipient?.firstName || ''} ${tx.recipient?.lastName || ''}`.trim();
    return name || tx.recipient?.email || tx.recipientEmail || tx.recipientPhone || 'N/A';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Gift Cards</h1>
            <p className="text-sm text-dark-300">Manage wallet gift packages and track gift transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-2 rounded-lg text-sm ${activeTab === 'packages' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-100'}`}
              onClick={() => setActiveTab('packages')}
            >
              Packages
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm ${activeTab === 'transactions' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-100'}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dark-700 bg-dark-800 p-10 text-center text-dark-300">Loading...</div>
        ) : activeTab === 'packages' ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 rounded-2xl border border-dark-700 bg-dark-800 p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <input className="input" placeholder="Title (EN)" value={form.title_en} onChange={(e) => setForm((p) => ({ ...p, title_en: e.target.value }))} />
              <input className="input" placeholder="Title (AR)" value={form.title_ar} onChange={(e) => setForm((p) => ({ ...p, title_ar: e.target.value }))} />
              <textarea className="input min-h-20" placeholder="Description (EN)" value={form.description_en} onChange={(e) => setForm((p) => ({ ...p, description_en: e.target.value }))} />
              <textarea className="input min-h-20" placeholder="Description (AR)" value={form.description_ar} onChange={(e) => setForm((p) => ({ ...p, description_ar: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="number" placeholder="Display order" value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value || 0) }))} />
                <label className="flex items-center gap-2 text-sm text-dark-100 px-2">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Active
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input" type="number" step="0.01" placeholder="Price" value={form.priceAmount} onChange={(e) => setForm((p) => ({ ...p, priceAmount: Number(e.target.value || 0) }))} />
                <input className="input" type="number" step="0.01" placeholder="Wallet credit" value={form.walletCreditAmount} onChange={(e) => setForm((p) => ({ ...p, walletCreditAmount: Number(e.target.value || 0) }))} />
                <input className="input" type="number" step="0.01" placeholder="Bonus" value={form.bonusAmount} onChange={(e) => setForm((p) => ({ ...p, bonusAmount: Number(e.target.value || 0) }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
                <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button className="btn btn-primary flex-1" disabled={saving} onClick={submitPackage}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                {editingId && (
                  <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                )}
              </div>
            </div>

            <div className="xl:col-span-2 rounded-2xl border border-dark-700 bg-dark-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-700 text-sm text-dark-200">Packages ({packages.length})</div>
              <div className="divide-y divide-dark-700">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="px-4 py-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold">{pkg.title_en}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${pkg.isActive ? 'bg-success/20 text-success' : 'bg-dark-600 text-dark-200'}`}>
                          {pkg.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-dark-300">{pkg.title_ar}</p>
                      <p className="text-xs text-dark-400">
                        Price: <Currency amount={pkg.priceAmount} /> | Credit: <Currency amount={Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0)} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-secondary" onClick={() => startEdit(pkg)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => deletePackage(pkg.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {packages.length === 0 && <div className="px-4 py-8 text-center text-dark-300">No gift packages yet.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dark-700 bg-dark-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
              <p className="text-sm text-dark-200">Gift transactions ({transactions.length})</p>
              <select
                className="input !w-44 !py-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="purchased">Purchased</option>
                <option value="sent_pending_claim">Pending claim</option>
                <option value="sent_completed">Sent completed</option>
                <option value="redeemed">Redeemed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-dark-700/40 text-dark-200">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Package</th>
                    <th className="text-left px-4 py-3">Sender</th>
                    <th className="text-left px-4 py-3">Recipient</th>
                    <th className="text-left px-4 py-3">Purchase</th>
                    <th className="text-left px-4 py-3">Credit</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-dark-700 text-dark-100">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{tx.package?.title_en || tx.package?.title_ar || 'N/A'}</td>
                      <td className="px-4 py-3">{senderLabel(tx)}</td>
                      <td className="px-4 py-3">{recipientLabel(tx)}</td>
                      <td className="px-4 py-3"><Currency amount={tx.purchaseAmount} /></td>
                      <td className="px-4 py-3"><Currency amount={tx.totalCreditAmount} /></td>
                      <td className="px-4 py-3">{tx.status}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-dark-300">No transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
