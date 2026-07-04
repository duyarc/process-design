import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './components/Dashboard';
import { ProcessEditor } from './components/ProcessEditor';
import { ProcessReader } from './components/ProcessReader';
import { BPMNGuide } from './components/BPMNGuide';
import SubmissionManager from './components/SubmissionManager';
import FormManager from './components/FormManager';
import FormFiller from './components/FormFiller';
import { BookOpen, UserCheck } from 'lucide-react';

const MainApp: React.FC = () => {
  const [page, setPage] = useState<'dashboard' | 'editor' | 'reader' | 'guide' | 'submissions' | 'form-manager' | 'fill-form'>('dashboard');
  const [prevPage, setPrevPage] = useState<'dashboard' | 'editor' | 'reader' | 'guide' | 'submissions' | 'form-manager' | 'fill-form'>('dashboard');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);
  const [initialFormFilter, setInitialFormFilter] = useState<string | null>(null);
  const [initialPrintFormName, setInitialPrintFormName] = useState<string | null>(null);
  const [dashboardViewMode, setDashboardViewMode] = useState<'processes' | 'forms'>('processes');
  
  const [initialEditorTab, setInitialEditorTab] = useState<'description' | 'workflow' | 'form' | undefined>(undefined);
  const [initialFormToBuild, setInitialFormToBuild] = useState<string | null>(null);
  
  const { currentUser, setCurrentUser } = useAuth();

  // Detect shareable form links in the URL query string
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
    setPrevPage(page);
    setInitialFormFilter(formName);
    setPage('submissions');
  };

  const handlePrintForm = (processId: string, formName: string) => {
    setPrevPage(page);
    setSelectedProcessId(processId);
    setInitialPrintFormName(formName);
    setPage('reader');
  };

  return (
    <div className="app-container">
      {/* Navbar Panel */}
      <header className="app-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => { setPage('dashboard'); setSelectedProcessId(null); setInitialFormFilter(null); }}>
            <BookOpen size={24} style={{ color: 'var(--primary)' }} />
            <span className="logo-text">Process Design</span>
          </div>
          
          <nav style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`btn btn-sm ${page === 'submissions' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setInitialFormFilter(null); setPage('submissions'); }}
              style={{ borderRadius: '20px', padding: '0.35rem 1rem' }}
            >
              Submissions
            </button>
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
            onViewFormSubmissions={handleViewFormSubmissions}
            onPrintForm={handlePrintForm}
            onOpenFormManager={handleOpenFormManager}
            viewMode={dashboardViewMode}
            onViewModeChange={setDashboardViewMode}
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
        {page === 'guide' && (
          <BPMNGuide />
        )}
        {page === 'submissions' && (
          <SubmissionManager onBack={() => setPage(prevPage)} initialFormFilter={initialFormFilter} />
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
