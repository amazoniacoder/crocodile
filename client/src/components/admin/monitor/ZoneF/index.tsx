import React from 'react';
import ClusterHealthDashboard from '../../ClusterHealthDashboard';

interface Props {
  adminToken: string;
}

const ZoneF: React.FC<Props> = ({ adminToken }) => {
  return (
    <div className="zone-f">
      <ClusterHealthDashboard adminToken={adminToken} />
    </div>
  );
};

export default ZoneF;