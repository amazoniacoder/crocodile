import React, { useState, useEffect } from 'react';
import { Card } from '../../ui-system/components/card';
import { Button } from '../../ui-system/components/button';
import { Badge } from '../../ui-system/components/feedback';
import { Icon } from '../../ui-system/icons/components';
import './TokenManager.css';

interface Token {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  createdBy: string;
  permissions: string[];
  isExpiringSoon: boolean;
}

interface TokenStats {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  expiringSoon: number;
  lastRotation?: string;
  oldestToken?: string;
}

interface Props {
  adminToken: string;
}

export const TokenManager: React.FC<Props> = ({ adminToken }) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tokens' | 'generate' | 'rotate'>('tokens');
  
  // Form states
  const [generateForm, setGenerateForm] = useState({
    name: '',
    expiresInDays: 30,
    loading: false
  });
  
  const [rotateForm, setRotateForm] = useState({
    name: '',
    expiresInDays: 30,
    loading: false
  });
  
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };
      
      const [tokensRes, statsRes] = await Promise.all([
        fetch('/api/admin/tokens', { headers }),
        fetch('/api/admin/tokens/stats', { headers })
      ]);

      if (tokensRes.ok && statsRes.ok) {
        const tokensData = await tokensRes.json();
        const statsData = await statsRes.json();
        
        setTokens(tokensData.tokens);
        setStats(statsData.stats);
        setError(null);
      } else {
        setError('Failed to fetch token data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    if (!generateForm.name.trim()) {
      alert('Token name is required');
      return;
    }

    setGenerateForm(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/admin/tokens/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: generateForm.name,
          expiresInDays: generateForm.expiresInDays
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setNewToken(result.data.token);
        setGenerateForm({ name: '', expiresInDays: 30, loading: false });
        fetchData(); // Refresh data
      } else {
        alert(`Failed to generate token: ${result.error}`);
      }
    } catch (error) {
      alert('Network error during token generation');
    } finally {
      setGenerateForm(prev => ({ ...prev, loading: false }));
    }
  };

  const rotateToken = async () => {
    setRotateForm(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/admin/tokens/rotate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: rotateForm.name || undefined,
          expiresInDays: rotateForm.expiresInDays
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setNewToken(result.data.newToken);
        setRotateForm({ name: '', expiresInDays: 30, loading: false });
        fetchData(); // Refresh data
        
        // Show important notice about token change
        alert(`Token rotated successfully! Your old token will work for 24 more hours. Please update your configuration with the new token.`);
      } else {
        alert(`Failed to rotate token: ${result.error}`);
      }
    } catch (error) {
      alert('Network error during token rotation');
    } finally {
      setRotateForm(prev => ({ ...prev, loading: false }));
    }
  };

  const revokeToken = async (tokenId: string, tokenName: string) => {
    if (!confirm(`Are you sure you want to revoke token "${tokenName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        fetchData(); // Refresh data
      } else {
        alert(`Failed to revoke token: ${result.error}`);
      }
    } catch (error) {
      alert('Network error during token revocation');
    }
  };

  const autoRotate = async () => {
    try {
      const response = await fetch('/api/admin/tokens/auto-rotate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Auto-rotation completed successfully');
        fetchData(); // Refresh data
      } else {
        alert(`Auto-rotation failed: ${result.error}`);
      }
    } catch (error) {
      alert('Network error during auto-rotation');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Token copied to clipboard!');
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [adminToken]);

  if (loading) {
    return <div className="token-manager__loading">Loading token management...</div>;
  }

  if (error) {
    return (
      <div className="token-manager__error">
        <p>Error: {error}</p>
        <Button onClick={fetchData} variant="secondary">Retry</Button>
      </div>
    );
  }

  return (
    <div className="token-manager">
      <div className="token-manager__header">
        <div className="token-manager__actions">
          <Button onClick={autoRotate} variant="secondary" size="sm">
            <Icon name="refresh" size={14} /> Auto-Rotate Expiring
          </Button>
          <Button onClick={fetchData} variant="secondary" size="sm">
            <Icon name="refresh" size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="token-stats">
          <div className="stat-card">
            <div className="stat-card__title">Total Tokens</div>
            <div className="stat-card__value">{stats.totalTokens}</div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-card__title">Active</div>
            <div className="stat-card__value">{stats.activeTokens}</div>
          </div>
          <div className="stat-card stat-card--warning">
            <div className="stat-card__title">Expiring Soon</div>
            <div className="stat-card__value">{stats.expiringSoon}</div>
          </div>
          <div className="stat-card stat-card--error">
            <div className="stat-card__title">Expired</div>
            <div className="stat-card__value">{stats.expiredTokens}</div>
          </div>
        </div>
      )}

      {/* New Token Display */}
      {newToken && (
        <Card className="token-manager__new-token">
          <h3><Icon name="check" size={18} /> New Token Generated</h3>
          <div className="token-display">
            <code className="token-display__value">{newToken}</code>
            <Button 
              onClick={() => copyToClipboard(newToken)} 
              variant="secondary" 
              size="sm"
            >
              <Icon name="file" size={14} /> Copy
            </Button>
          </div>
          <p className="token-display__warning">
            <Icon name="warning" size={14} /> Save this token securely! It won't be shown again.
          </p>
          <Button 
            onClick={() => setNewToken(null)} 
            variant="primary" 
            size="sm"
          >
            I've Saved It
          </Button>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="token-tabs">
        <button
          className={`token-tab ${activeTab === 'tokens' ? 'token-tab--active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          Active Tokens ({tokens.length})
        </button>
        <button
          className={`token-tab ${activeTab === 'generate' ? 'token-tab--active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate New
        </button>
        <button
          className={`token-tab ${activeTab === 'rotate' ? 'token-tab--active' : ''}`}
          onClick={() => setActiveTab('rotate')}
        >
          Rotate Current
        </button>
      </div>

      {/* Tab Content */}
      <div className="token-content">
        {activeTab === 'tokens' && (
          <div className="token-list">
            {tokens.length === 0 ? (
              <Card>
                <p>No active tokens found.</p>
              </Card>
            ) : (
              tokens.map((token) => (
                <Card key={token.id} className="token-item">
                  <div className="token-item__header">
                    <div className="token-item__info">
                      <h4 className="token-item__name">{token.name}</h4>
                      <span className="token-item__id">ID: {token.id}</span>
                    </div>
                    <div className="token-item__badges">
                      {token.isExpiringSoon && (
                        <Badge variant="warning">Expiring Soon</Badge>
                      )}
                      <Badge variant="secondary">
                        {getDaysUntilExpiry(token.expiresAt)} days left
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="token-item__details">
                    <div className="token-detail">
                      <span className="token-detail__label">Created:</span>
                      <span className="token-detail__value">{formatDate(token.createdAt)}</span>
                    </div>
                    <div className="token-detail">
                      <span className="token-detail__label">Expires:</span>
                      <span className="token-detail__value">{formatDate(token.expiresAt)}</span>
                    </div>
                    <div className="token-detail">
                      <span className="token-detail__label">Last Used:</span>
                      <span className="token-detail__value">
                        {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never'}
                      </span>
                    </div>
                    <div className="token-detail">
                      <span className="token-detail__label">Created By:</span>
                      <span className="token-detail__value">{token.createdBy}</span>
                    </div>
                  </div>
                  
                  <div className="token-item__actions">
                    <Button
                      onClick={() => revokeToken(token.id, token.name)}
                      variant="danger"
                      size="sm"
                    >
                    <Icon name="delete" size={14} /> Revoke
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <Card className="token-form">
            <h3>Generate New Token</h3>
            <div className="form-group">
              <label>Token Name</label>
              <input
                type="text"
                value={generateForm.name}
                onChange={(e) => setGenerateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Production API Token"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Expires In (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={generateForm.expiresInDays}
                onChange={(e) => setGenerateForm(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                className="form-input"
              />
            </div>
            <Button
              onClick={generateToken}
              disabled={generateForm.loading || !generateForm.name.trim()}
              variant="primary"
            >
              {generateForm.loading ? <><Icon name="loader" size={14} /> Generating...</> : <><Icon name="key" size={14} /> Generate Token</>}
            </Button>
          </Card>
        )}

        {activeTab === 'rotate' && (
          <Card className="token-form">
            <h3>Rotate Current Token</h3>
            <p className="form-description">
              This will create a new token and give you 24 hours to update your configuration.
              The old token will continue to work during this grace period.
            </p>
            <div className="form-group">
              <label>New Token Name (Optional)</label>
              <input
                type="text"
                value={rotateForm.name}
                onChange={(e) => setRotateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Leave empty to auto-generate name"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Expires In (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={rotateForm.expiresInDays}
                onChange={(e) => setRotateForm(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                className="form-input"
              />
            </div>
            <Button
              onClick={rotateToken}
              disabled={rotateForm.loading}
              variant="outline"
            >
              {rotateForm.loading ? <><Icon name="loader" size={14} /> Rotating...</> : <><Icon name="refresh" size={14} /> Rotate Token</>}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};