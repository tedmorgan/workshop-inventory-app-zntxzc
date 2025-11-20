import React, { createContext, useContext, useState } from 'react';

type NavigationContextType = {
  returnToSearch: boolean;
  setReturnToSearch: (value: boolean) => void;
  filterBinId: string | null;
  setFilterBinId: (value: string | null) => void;
  editBinId: string | null;
  setEditBinId: (value: string | null) => void;
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [returnToSearch, setReturnToSearch] = useState(false);
  const [filterBinId, setFilterBinId] = useState<string | null>(null);
  const [editBinId, setEditBinId] = useState<string | null>(null);

  return (
    <NavigationContext.Provider
      value={{
        returnToSearch,
        setReturnToSearch,
        filterBinId,
        setFilterBinId,
        editBinId,
        setEditBinId,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

