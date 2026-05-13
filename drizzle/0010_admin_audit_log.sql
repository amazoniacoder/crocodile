CREATE TABLE admin_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  admin_token VARCHAR(64) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(50),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for efficient querying
CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_resource ON admin_audit_log(resource);
CREATE INDEX idx_admin_audit_log_admin_token ON admin_audit_log(admin_token);
CREATE INDEX idx_admin_audit_log_success ON admin_audit_log(success);

-- Cleanup old audit logs (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs() RETURNS void AS $$
BEGIN
  DELETE FROM admin_audit_log 
  WHERE timestamp < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;