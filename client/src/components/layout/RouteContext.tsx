import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface RouteContextType {
  isAdminRoute: boolean;
}

const RouteContext = createContext<RouteContextType>({ isAdminRoute: false });

export const useRouteContext = () => useContext(RouteContext);

export const RouteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location] = useLocation();
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    setIsAdminRoute(location.startsWith('/admin') || location.startsWith('/documentation'));
  }, [location]);

  return (
    <RouteContext.Provider value={{ isAdminRoute }}>
      {children}
    </RouteContext.Provider>
  );
};

export default RouteContext;
