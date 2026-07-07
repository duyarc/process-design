import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Dashboard } from './components/Dashboard';
import { ProcessEditor } from './components/ProcessEditor';
import { ProcessReader } from './components/ProcessReader';
import FormManager from './components/FormManager';
import FormFiller from './components/FormFiller';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import { BookOpen, Users, LogOut, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Page type union
// ─────────────────────────────────────────────────────────────
type PageId =
  | 'dashboard'
  | 'editor'
  | 'reader'
  | 'guide'
  | 'submissions'
  | 'form-manager'
  | 'fill-form'
  | 'user-management';

const MainApp: React.FC = () => {
  const [page, setPage] = useState<PageId>('dashboard');
  const [prevPage, setPrevPage] = useState<PageId>('dashboard');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);
  const [initialFormFilter, setInitialFormFilter] = useState<string | null>(null);
  const [initialPrintFormName, setInitialPrintFormName] = useState<string | null>(null);
  const [dashboardViewMode, setDashboardViewMode] = useState<'processes' | 'forms' | 'submissions' | 'guide'>('processes');
  const [initialEditorTab, setInitialEditorTab] = useState<'description' | 'workflow' | 'form' | 'versions' | undefined>(undefined);
  const [initialFormToBuild, setInitialFormToBuild] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const { currentUser, logout, hasPermission } = useAuth();


  // Detect shareable form links in the URL query string (only when logged in)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPage = params.get('page');
    const qProcessId = params.get('processId');
    const qFormName = params.get('formName');

    if (qPage === 'fill' && qProcessId && qFormName) {
      setSelectedProcessId(qProcessId);
      setSelectedFormName(qFormName);
      setPage('fill-form');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProcess = (id: string) => {
    setPrevPage(page);
    setSelectedProcessId(id);
    setPage('reader');
  };

  const handleOpenFormManager = (procId: string, formName: string) => {
    setPrevPage(page);
    setSelectedProcessId(procId);
    setSelectedFormName(formName);
    setPage('form-manager');
  };

  const handleOpenFormFiller = (procId: string, formName: string) => {
    setPrevPage(page);
    setSelectedProcessId(procId);
    setSelectedFormName(formName);
    setPage('fill-form');
  };

  const handleEditProcess = (id: string | null, tab?: 'description' | 'workflow' | 'form', formName?: string) => {
    setPrevPage(page);
    setSelectedProcessId(id);
    setInitialEditorTab(tab);
    setInitialFormToBuild(formName || null);
    setPage('editor');
  };

  const handleSaveSuccess = (id: string) => {
    setSelectedProcessId(id);
    setToastMessage('Process saved successfully!');
  };

  const handleViewFormSubmissions = (formName: string) => {
    setInitialFormFilter(formName);
    setDashboardViewMode('submissions');
    setPage('dashboard');
  };

  const handlePrintForm = (processId: string, formName: string) => {
    setPrevPage(page);
    setSelectedProcessId(processId);
    setInitialPrintFormName(formName);
    setPage('reader');
  };

  const navigateToUserManagement = () => {
    if (!hasPermission('manage_users')) return;
    setPrevPage(page);
    setPage('user-management');
  };

  // If not logged in, render the Login page
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="app-container">
      {/* Navbar Panel */}
      <header className="app-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div
            className="logo-container"
            style={{ cursor: 'pointer' }}
            onClick={() => { setPage('dashboard'); setSelectedProcessId(null); setInitialFormFilter(null); }}
          >
            <BookOpen size={24} style={{ color: 'var(--primary)' }} />
            <span className="logo-text">Process Design</span>
          </div>

        </div>

        {/* Current user info & Dropdown Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#f3f4f6', padding: '0.375rem 0.75rem',
                borderRadius: '20px', border: '1px solid var(--neutral-border)',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {currentUser.full_name}
              </span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)',
                background: 'var(--primary-light, #eff6ff)',
                padding: '0.1rem 0.45rem', borderRadius: '10px',
              }}>
                {currentUser.role_id.toUpperCase()}
              </span>
              <ChevronDown size={12} style={{ color: 'var(--text-secondary)', transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {userMenuOpen && (
              <>
                <div 
                  onClick={() => setUserMenuOpen(false)} 
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                />
                <div style={{
                  position: 'absolute', right: 0, marginTop: '0.5rem',
                  background: 'var(--surface, #fff)', borderRadius: '10px',
                  border: '1px solid var(--neutral-border)',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                  width: '160px', padding: '0.25rem 0', zIndex: 999,
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  {hasPermission('manage_users') && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigateToUserManagement();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        width: '100%', padding: '0.6rem 1rem', border: 'none',
                        background: 'none', textAlign: 'left', cursor: 'pointer',
                        fontSize: '0.85rem', color: 'var(--text-primary)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <Users size={14} />
                      <span>Users</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      width: '100%', padding: '0.6rem 1rem', border: 'none',
                      background: 'none', textAlign: 'left', cursor: 'pointer',
                      fontSize: '0.85rem', color: 'var(--danger, #ef4444)',
                      transition: 'background 0.15s',
                      borderTop: hasPermission('manage_users') ? '1px solid var(--neutral-border)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={14} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Render */}
      <main className="main-content">
        {page === 'dashboard' && (
          <Dashboard
            onSelectProcess={handleSelectProcess}
            onEditProcess={handleEditProcess}
            onViewFormSubmissions={handleViewFormSubmissions}
            onPrintForm={handlePrintForm}
            onOpenFormManager={handleOpenFormManager}
            viewMode={dashboardViewMode}
            onViewModeChange={setDashboardViewMode}
            initialFormFilter={initialFormFilter}
            onClearFormFilter={() => setInitialFormFilter(null)}
          />
        )}
        {page === 'editor' && (
          <ProcessEditor
            processId={selectedProcessId}
            onCancel={() => {
              setPage(prevPage);
              setInitialEditorTab(undefined);
              setInitialFormToBuild(null);
            }}
            onSaveSuccess={handleSaveSuccess}
            onOpenDraft={(id) => {
              // After creating a new draft, open its editor directly
              setSelectedProcessId(id);
              setInitialEditorTab('versions');
              setInitialFormToBuild(null);
              // page stays 'editor', React re-renders with new processId
            }}
            initialTab={initialEditorTab}
            initialFormToBuild={initialFormToBuild}
            onClearInitialEditOpts={() => {
              setInitialEditorTab(undefined);
              setInitialFormToBuild(null);
            }}
          />
        )}
        {page === 'reader' && (
          <ProcessReader
            processId={selectedProcessId!}
            onBack={() => { setPage(prevPage); setInitialPrintFormName(null); }}
            onEdit={handleEditProcess}
            initialPrintFormName={initialPrintFormName}
            onClearPrintForm={() => setInitialPrintFormName(null)}
            onSwitchVersion={(id) => setSelectedProcessId(id)}
          />
        )}
        {page === 'form-manager' && (
          <FormManager
            processId={selectedProcessId!}
            formName={selectedFormName!}
            onOpenFormFiller={handleOpenFormFiller}
            onBack={() => setPage(prevPage)}
          />
        )}
        {page === 'fill-form' && (
          <FormFiller
            processId={selectedProcessId!}
            formName={selectedFormName!}
            onBack={() => setPage('form-manager')}
          />
        )}


        {/* Route Guard: only render UserManagement if user has manage_users permission */}
        {page === 'user-management' && (
          hasPermission('manage_users')
            ? <UserManagement onBack={() => setPage(prevPage)} />
            : <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Bạn không có quyền truy cập trang này.
              </div>
        )}
      </main>

      {/* Floating Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0f4c81',
          color: '#ffffff',
          padding: '0.85rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>✓</span> {toastMessage}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId="244282178050-4mgutp8fhcfiirb82m9sto9f02mkgttj.apps.googleusercontent.com">
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
