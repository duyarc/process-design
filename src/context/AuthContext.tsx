import React, { createContext, useContext, useState } from 'react';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
}

interface AuthContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  hasPermission: (action: 'edit_process' | 'create_process' | 'delete_process' | 'view_process') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Set default role to 'admin' (can be changed manually or via toggle to test role behaviors)
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user_1',
    name: 'Process Leader',
    role: 'admin', // Future role management check: change to 'editor' or 'viewer' to test
  });

  const hasPermission = (action: 'edit_process' | 'create_process' | 'delete_process' | 'view_process'): boolean => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'editor') {
      return action !== 'delete_process'; // Editors can edit and create, but not delete
    }
    // Viewers can only view
    return action === 'view_process';
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
