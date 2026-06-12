import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './components/Dashboard';
import { ProcessEditor } from './components/ProcessEditor';
import { ProcessReader } from './components/ProcessReader';
import { BPMNGuide } from './components/BPMNGuide';
import { BookOpen, UserCheck } from 'lucide-react';

const MainApp: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'editor' | 'reader' | 'guide'>('dashboard');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  
  const { currentUser, setCurrentUser } = useAuth();

  const handleSelectProcess = (id: string) => {
    setSelectedProcessId(id);
    setPage('reader');
  };

  const handleEditProcess = (id: string | null) => {
    setSelectedProcessId(id);
    setPage('editor');
  };

  const handleSaveSuccess = (id: string) => {
    setSelectedProcessId(id);
  };

  return (
    <div className="app-container">
      {/* Navbar Panel */}
      <header className="app-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => { setPage('dashboard'); setSelectedProcessId(null); }}>
            <BookOpen size={24} style={{ color: 'var(--primary)' }} />
            <span className="logo-text">Process Design</span>
          </div>
          
          <nav style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`btn btn-sm ${page === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPage('guide')}
              style={{ borderRadius: '20px', padding: '0.35rem 1rem' }}
            >
              Guide
            </button>
          </nav>
        </div>

        {/* Future Role Selection Toggle (demonstrating module readiness) */}
        <div className="role-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f3f4f6', padding: '0.375rem 0.75rem', borderRadius: '20px', border: '1px solid var(--neutral-border)' }}>
          <UserCheck size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role:</span>
          <select 
            value={currentUser.role} 
            onChange={(e) => setCurrentUser({
              ...currentUser, 
              role: e.target.value as 'admin' | 'editor' | 'viewer',
              name: e.target.value === 'admin' ? 'Process Leader' : e.target.value === 'editor' ? 'Process Writer' : 'Process Viewer'
            })}
            style={{ 
              border: 'none', 
              background: 'transparent', 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              color: 'var(--text-primary)', 
              cursor: 'pointer',
              padding: 0,
              width: 'auto',
              boxShadow: 'none'
            }}
          >
            <option value="admin">Administrator</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer Only</option>
          </select>
        </div>
      </header>

      {/* Main Page Render */}
      <main className="main-content">
        {page === 'dashboard' && (
          <Dashboard 
            onSelectProcess={handleSelectProcess} 
            onEditProcess={handleEditProcess} 
          />
        )}
        {page === 'editor' && (
          <ProcessEditor 
            processId={selectedProcessId} 
            onCancel={() => setPage('dashboard')} 
            onSaveSuccess={handleSaveSuccess} 
          />
        )}
        {page === 'reader' && (
          <ProcessReader 
            processId={selectedProcessId!} 
            onBack={() => setPage('dashboard')} 
            onEdit={handleEditProcess} 
          />
        )}
        {page === 'guide' && (
          <BPMNGuide />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
