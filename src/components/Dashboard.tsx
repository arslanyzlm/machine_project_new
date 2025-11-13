import { useState } from 'react';
import { LogOut, User, Shield, Settings as SettingsIcon, History as HistoryIcon, LogIn, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import MachineOverview from './MachineOverview';
import StatusUpdateModal from './StatusUpdateModal';
import StatusHistory from './StatusHistory';
import DepartmentManagement from './DepartmentManagement';
import UserManagement from './UserManagement';
import AssignmentManagement from './AssignmentManagement';
import MachineManagement from './MachineManagement';
import StatusTypeManagement from './StatusTypeManagement';
import HistoryPage from './HistoryPage';
import ReportsPage from './ReportsPage';
import AuthForm from './AuthForm';
import LanguageSwitcher from './LanguageSwitcher';
import { Database } from '../lib/database.types';

type Machine = Database['public']['Tables']['machines']['Row'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'reports' | 'management'>('overview');
  // const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'management'>('overview');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isAuthenticated = !!user;
  const canUpdate = isAuthenticated && (profile?.role === 'admin' || profile?.role === 'team_leader' || profile?.role === 'operator');
  const isAdmin = profile?.role === 'admin';
  const isTeamLeader = profile?.role === 'team_leader';
  const canAccessReports = !user || profile?.role === 'admin' || profile?.role === 'team_leader';

  const handleMachineSelect = (machine: Machine) => {
    if (canUpdate) {
      setSelectedMachine(machine);
      setShowHistory(false);
    } else {
      setSelectedMachine(machine);
      setShowHistory(true);
    }
  };

  const handleStatusUpdate = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedMachine(null);
    setShowHistory(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'team_leader':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'operator':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatRole = (role: string) => {
    return t(`roles.${role}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{t('dashboard.title')}</h1>
                  <p className="text-xs text-gray-500">{t('dashboard.subtitle')}</p>
                </div>
              </div>

              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t('dashboard.overview')}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'history'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <HistoryIcon className="w-4 h-4" />
                  <span>{t('dashboard.history')}</span>
                </button>
                {canAccessReports && (
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                      activeTab === 'reports'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Raporlar</span>
                  </button>
                )}
                {(isAdmin || isTeamLeader) && (
                  <button
                    onClick={() => setActiveTab('management')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                      activeTab === 'management'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>{t('dashboard.management')}</span>
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              {isAuthenticated ? (
                <>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                    </div>
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeColor(profile?.role || 'operator')}`}>
                      {formatRole(profile?.role || 'operator')}
                    </div>
                  </div>
                  <button
                    onClick={signOut}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('common.signOut')}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                    {t('common.viewOnly')}
                  </div>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('common.signIn')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <MachineOverview key={refreshKey} onMachineSelect={handleMachineSelect} />

            {showHistory && selectedMachine && (
              <StatusHistory
                machineId={selectedMachine.id}
                machineName={`${selectedMachine.machine_code} - ${selectedMachine.machine_name}`}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && <HistoryPage />}

        {activeTab === 'reports' && canAccessReports && <ReportsPage />}

        {activeTab === 'management' && (
          <div className="space-y-8">
            {isAdmin && (
              <>
                <DepartmentManagement />
                <UserManagement />
                <MachineManagement />
                <StatusTypeManagement />
                <AssignmentManagement type="department" />
              </>
            )}
            {(isAdmin || isTeamLeader) && (
              <>
                <UserManagement />
                <MachineManagement />
                <AssignmentManagement type="machine" />
              </>
            )}
            {/* {(isAdmin || isTeamLeader) && <AssignmentManagement type="machine" />} */}
          </div>
        )}
      </main>

      {selectedMachine && canUpdate && !showHistory && (
        <StatusUpdateModal
          machine={selectedMachine}
          onClose={() => setSelectedMachine(null)}
          onUpdate={handleStatusUpdate}
        />
      )}

      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <LogOut className="w-6 h-6 rotate-180" />
            </button>
            <AuthForm onSuccess={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}