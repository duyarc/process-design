import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Dashboard } from './components/Dashboard';
import { ProcessEditor } from './components/ProcessEditor';
import { ProcessReader } from './components/ProcessReader';
import { BPMNGuide } from './components/BPMNGuide';
import FormManager from './components/FormManager';
import FormFiller from './components/FormFiller';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import { BookOpen, Users, LogOut } from 'lucide-react';

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
  const [dashboardViewMode, setDashboardViewMode] = useState<'processes' | 'forms' | 'submissions'>('processes');
  const [initialEditorTab, setInitialEditorTab] = useState<'description' | 'workflow' | 'form' | undefined>(undefined);
  const [initialFormToBuild, setInitialFormToBuild] = useState<string | null>(null);

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
    setPage(prevPage);
    setInitialEditorTab(undefined);
    setInitialFormToBuild(null);
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

          <nav style={{ display: 'flex', gap: '0.5rem' }}>

            <button
              className={`btn btn-sm ${page === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPage('guide')}
              style={{ borderRadius: '20px', padding: '0.35rem 1rem' }}
            >
              Guide
            </button>
            {/* Only visible to users with manage_users permission */}
            {hasPermission('manage_users') && (
              <button
                className={`btn btn-sm ${page === 'user-management' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={navigateToUserManagement}
                style={{ borderRadius: '20px', padding: '0.35rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Users size={14} />
                Nhân sự
              </button>
            )}
          </nav>
        </div>

        {/* Current user info & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: '#f3f4f6', padding: '0.375rem 0.75rem',
            borderRadius: '20px', border: '1px solid var(--neutral-border)',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentUser.full_name}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)',
              background: 'var(--primary-light, #eff6ff)',
              padding: '0.1rem 0.45rem', borderRadius: '10px',
            }}>
              {currentUser.role_id.toUpperCase()}
            </span>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={logout}
            title="Đăng xuất"
            style={{ borderRadius: '20px', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <LogOut size={14} />
          </button>
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
        {page === 'guide' && <BPMNGuide />}

        {/* Route Guard: only render UserManagement if user has manage_users permission */}
        {page === 'user-management' && (
          hasPermission('manage_users')
            ? <UserManagement onBack={() => setPage(prevPage)} />
            : <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Bạn không có quyền truy cập trang này.
              </div>
        )}
      </main>
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
