import React, { useState, useEffect, useMemo } from 'react';
import { adminUserTokensApi, type UserToken } from '@/services/adminUserTokensApi';
import { Icon } from '@/ui-system/icons/components';
import { SubscriptionsModal } from './SubscriptionsModal';

interface TokensTabProps {
  token: string;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'expired';
type SortCol = 'id' | 'createdAt' | 'expiresAt' | 'lastUsedAt';
type SortDir = 'asc' | 'desc';

export const TokensTab: React.FC<TokensTabProps> = ({ token }) => {
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [showToken, setShowToken] = useState<number | null>(null);
  const [editingToken, setEditingToken] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortCol, setSortCol] = useState<SortCol>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Task 11: массовый выбор
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchTokens = async () => {
    try {
      const { tokens: data } = await adminUserTokensApi.getTokens(token);
      setTokens(data);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTokens(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      await adminUserTokensApi.createToken(token, {
        label: newLabel.trim(),
        expiresAt: newExpiresAt || undefined,
      });
      setNewLabel('');
      setNewExpiresAt('');
      await fetchTokens();
    } catch { } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userToken: UserToken) => {
    try {
      await adminUserTokensApi.updateToken(token, userToken.id, { isActive: !userToken.isActive });
      await fetchTokens();
    } catch { }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить токен? Все подписки будут удалены.')) return;
    try {
      await adminUserTokensApi.deleteToken(token, id);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await fetchTokens();
    } catch { }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortIcon = (col: SortCol) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const now = Date.now();

  const exportCsv = () => {
    const rows = [
      ['ID', 'Метка', 'Активен', 'Создан', 'Истекает', 'Последнее использование', 'Подписок'],
      ...filteredTokens.map(t => [
        t.id,
        t.label ?? '',
        t.isActive ? 'Да' : 'Нет',
        new Date(t.createdAt).toLocaleDateString('ru-RU'),
        t.expiresAt ? new Date(t.expiresAt).toLocaleDateString('ru-RU') : '',
        t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString('ru-RU') : '',
        t.subscriptionsCount ?? 0,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokens_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const filteredTokens = useMemo(() => {
    let list = tokens.filter(t => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(t.label ?? '').toLowerCase().includes(q) && !String(t.id).includes(q)) return false;
      }
      if (statusFilter === 'active') return t.isActive && (!t.expiresAt || new Date(t.expiresAt).getTime() > now);
      if (statusFilter === 'inactive') return !t.isActive;
      if (statusFilter === 'expired') return !!t.expiresAt && new Date(t.expiresAt).getTime() <= now;
      return true;
    });
    return [...list].sort((a, b) => {
      let av: number, bv: number;
      if (sortCol === 'id') { av = a.id; bv = b.id; }
      else if (sortCol === 'createdAt') { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
      else if (sortCol === 'expiresAt') { av = a.expiresAt ? new Date(a.expiresAt).getTime() : 0; bv = b.expiresAt ? new Date(b.expiresAt).getTime() : 0; }
      else { av = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0; bv = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [tokens, search, statusFilter, sortCol, sortDir, now]);

  // Bulk helpers
  const allVisibleIds = filteredTokens.map(t => t.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const someSelected = allVisibleIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); allVisibleIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); allVisibleIds.forEach(id => n.add(id)); return n; });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkDeactivate = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Деактивировать ${selectedIds.size} токен(ов)?`)) return;
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map(id =>
        adminUserTokensApi.updateToken(token, id, { isActive: false })
      ));
      setSelectedIds(new Set());
      await fetchTokens();
    } catch { } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Удалить ${selectedIds.size} токен(ов)? Все подписки будут удалены.`)) return;
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map(id =>
        adminUserTokensApi.deleteToken(token, id)
      ));
      setSelectedIds(new Set());
      await fetchTokens();
    } catch { } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) return <div className="zone-n__loading">Загрузка...</div>;

  const statusButtons: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'active', label: 'Активные' },
    { key: 'inactive', label: 'Неактивные' },
    { key: 'expired', label: 'Истёкшие' },
  ];

  return (
    <div className="zone-n__tokens">
      <form className="zone-n__create-form" onSubmit={handleCreate}>
        <h3 className="zone-n__form-title">Создать токен</h3>
        <div className="zone-n__form-row">
          <input
            type="text"
            className="zone-n__input"
            placeholder="Метка (например, Подписчик Boosty #123)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={creating}
          />
          <input
            type="date"
            className="zone-n__input"
            value={newExpiresAt}
            onChange={(e) => setNewExpiresAt(e.target.value)}
            disabled={creating}
          />
          <button type="submit" className="zone-n__btn zone-n__btn--primary" disabled={creating || !newLabel.trim()}>
            <Icon name="add" size={16} />
            Создать
          </button>
        </div>
      </form>

      {/* Поиск и фильтры */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="zone-n__input"
          placeholder="Поиск по метке или ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <div className="monitor-tabs">
          {statusButtons.map(({ key, label }) => (
            <button
              key={key}
              className={`monitor-tab${statusFilter === key ? ' monitor-tab--active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filteredTokens.length} / {tokens.length}
        </span>
        <button
          className="monitor-btn monitor-btn--icon"
          onClick={exportCsv}
          title="Экспорт CSV"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
        >
          <Icon name="download" size={14} />
          CSV
        </button>
      </div>

      {/* Bulk toolbar — показывается только при выборе */}
      {someSelected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          marginBottom: 'var(--space-sm)',
          background: 'color-mix(in oklab, var(--color-primary) 8%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-primary) 20%, transparent)',
          borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary)' }}>
            Выбрано: {selectedIds.size}
          </span>
          <button
            className="monitor-btn monitor-btn--icon"
            onClick={handleBulkDeactivate}
            disabled={bulkProcessing}
            title="Деактивировать выбранные"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
          >
            <Icon name="eye-off" size={14} />
            Деактивировать
          </button>
          <button
            className="monitor-btn monitor-btn--danger"
            onClick={handleBulkDelete}
            disabled={bulkProcessing}
            title="Удалить выбранные"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
          >
            <Icon name="delete" size={14} />
            Удалить
          </button>
          <button
            className="monitor-btn monitor-btn--icon"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkProcessing}
            style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)' }}
          >
            Снять выбор
          </button>
        </div>
      )}

      <div className="zone-n__table-wrap">
        <table className="zone-n__table">
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  aria-label="Выбрать все"
                />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>ID{sortIcon('id')}</th>
              <th>Метка</th>
              <th>Токен</th>
              <th>Подписки</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>Создан{sortIcon('createdAt')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('expiresAt')}>Истекает{sortIcon('expiresAt')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastUsedAt')}>Последнее использование{sortIcon('lastUsedAt')}</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredTokens.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
                  Нет токенов
                </td>
              </tr>
            )}
            {filteredTokens.map((userToken) => {
              const isExpired = !!userToken.expiresAt && new Date(userToken.expiresAt).getTime() <= now;
              const isSelected = selectedIds.has(userToken.id);
              return (
                <tr key={userToken.id} style={{ background: isSelected ? 'color-mix(in oklab, var(--color-primary) 5%, transparent)' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(userToken.id)}
                      aria-label={`Выбрать токен ${userToken.id}`}
                    />
                  </td>
                  <td>{userToken.id}</td>
                  <td>{userToken.label}</td>
                  <td>
                    <div className="zone-n__token-cell">
                      {showToken === userToken.id ? (
                        <code className="zone-n__token-value">{userToken.token}</code>
                      ) : (
                        <code className="zone-n__token-hidden">••••••••</code>
                      )}
                      <button className="zone-n__token-btn" onClick={() => setShowToken(showToken === userToken.id ? null : userToken.id)} title={showToken === userToken.id ? 'Скрыть' : 'Показать'}>
                        <Icon name={showToken === userToken.id ? 'eye-off' : 'eye'} size={14} />
                      </button>
                      <button className="zone-n__token-btn" onClick={() => copyToClipboard(userToken.token, `token-${userToken.id}`)} title="Копировать токен">
                        <Icon name={copiedKey === `token-${userToken.id}` ? 'check' : 'file'} size={14} />
                      </button>
                      <button className="zone-n__token-btn" onClick={() => copyToClipboard(`${window.location.origin}/my?token=${userToken.token}`, `link-${userToken.id}`)} title="Копировать ссылку">
                        <Icon name={copiedKey === `link-${userToken.id}` ? 'check' : 'share'} size={14} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <button className="zone-n__subs-btn" onClick={() => setEditingToken(userToken.id)}>
                      {userToken.subscriptionsCount ?? 0}
                    </button>
                  </td>
                  <td>{new Date(userToken.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td style={{ color: isExpired ? 'var(--color-error)' : undefined }}>
                    {userToken.expiresAt ? new Date(userToken.expiresAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td>{userToken.lastUsedAt ? new Date(userToken.lastUsedAt).toLocaleString('ru-RU') : '—'}</td>
                  <td>
                    <button className={`zone-n__toggle${userToken.isActive ? ' zone-n__toggle--active' : ''}`} onClick={() => handleToggleActive(userToken)}>
                      {userToken.isActive ? 'Да' : 'Нет'}
                    </button>
                  </td>
                  <td>
                    <button className="zone-n__action-btn zone-n__action-btn--danger" onClick={() => handleDelete(userToken.id)} title="Удалить">
                      <Icon name="delete" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingToken && (
        <SubscriptionsModal
          token={token}
          tokenId={editingToken}
          onClose={() => setEditingToken(null)}
          onUpdate={fetchTokens}
        />
      )}
    </div>
  );
};
