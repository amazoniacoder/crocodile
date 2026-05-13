import React from 'react';
import ClusterTestRunner from '../../ClusterTestRunner';

interface Props {
  adminToken: string;
}

const ZoneG: React.FC<Props> = ({ adminToken }) => {
  return (
    <div className="zone-g">
      <ClusterTestRunner adminToken={adminToken} />
    </div>
  );
};

export default ZoneG;