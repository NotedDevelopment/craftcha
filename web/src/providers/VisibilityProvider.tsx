import React, { Context, createContext, useContext, useState } from "react";
import { useNuiEvent } from "../hooks/useNuiEvent";

interface VisibilityProviderValue {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const VisibilityCtx = createContext<VisibilityProviderValue | null>(null);

export const VisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  // Only react to plain boolean false — open events are handled in App.tsx
  useNuiEvent<boolean>("setVisible", (data) => {
    if (data === false) setVisible(false);
  });

  return (
    <VisibilityCtx.Provider value={{ visible, setVisible }}>
      {children}
    </VisibilityCtx.Provider>
  );
};

export const useVisibility = () =>
  useContext<VisibilityProviderValue>(VisibilityCtx as Context<VisibilityProviderValue>);
