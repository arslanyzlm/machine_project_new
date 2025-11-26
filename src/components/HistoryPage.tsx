import { useEffect, useState } from 'react';
import {
  History,
  Filter,
  ArrowRight,
  Calendar,
  User as UserIcon,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

// ---- API tipleri ----
interface StatusHistory {
  id: number;
  machine_id: number;
  status: string;
  previous_status: string | null;
  comment: string | null;
  changed_by: number;
  changed_at: string;
}

interface Machine {
  id: number;
  machine_code: string;
  machine_name: string;
  description: string;
  current_status: string;
  last_updated_at: string | null;
  last_updated_by: number | null;
  created_at: string;
  department_id: number | null;
}

interface Department {
  id: number;
  name: string;
  description: string;
  created_at: string;
  created_by: number | null;
}

interface StatusType {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  created_by: number | null;
}

interface Profile {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'team_leader' | 'operator';
  created_at: string;
  updated_at: string;
}

interface MachineOperator {
  id: number;
  machine_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

interface DepartmentLeader {
  id: number;
  department_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

interface HistoryEntry extends StatusHistory {
  machine?: Machine;
  user_name?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [loading, setLoading] = useState(true);

  // filtreler select'ten string geliyor, biz sonra number'a çeviriyoruz
  const [machineFilter, setMachineFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');

  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, profile?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      await Promise.all([
        loadMachines(),
        loadDepartments(),
        loadStatusTypes(),
        loadHistory(),
      ]);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMachines = async () => {
    try {
      const data = await api.get<Machine[]>('/machines');
      setMachines(
        (data || []).slice().sort((a, b) => a.machine_code.localeCompare(b.machine_code))
      );
    } catch (error) {
      console.error('Error loading machines:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await api.get<Department[]>('/departments');
      setDepartments(
        (data || []).slice().sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadStatusTypes = async () => {
    try {
      const data = await api.get<StatusType[]>('/status-types?only_active=true');
      setStatusTypes(
        (data || [])
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
      );
    } catch (error) {
      console.error('Error loading status types:', error);
    }
  };

  const loadHistory = async () => {
    try {
      // 1) tüm history'yi çek
      let historyData = await api.get<StatusHistory[]>('/status-history');

      // 2) rol bazlı filtreler (profile.id -> profiles tablosundaki id)
      if (profile?.role === 'operator') {
        const userId = profile.id;

        const assignments = await api.get<MachineOperator[]>(
          `/machine-operators?user_id=${userId}`
        );
        const machineIds = (assignments || []).map((a) => a.machine_id);

        if (machineIds.length > 0) {
          historyData = historyData.filter((h) => machineIds.includes(h.machine_id));
        } else {
          historyData = [];
        }
      } else if (profile?.role === 'team_leader') {
        const userId = profile.id;

        const deptLeaders = await api.get<DepartmentLeader[]>(
          `/department-leaders?user_id=${userId}`
        );
        const deptIds = (deptLeaders || []).map((d) => d.department_id);

        if (deptIds.length > 0) {
          const allMachines = await api.get<Machine[]>('/machines');
          const allowedMachineIds = (allMachines || [])
            .filter((m) => m.department_id && deptIds.includes(m.department_id))
            .map((m) => m.id);

          if (allowedMachineIds.length > 0) {
            historyData = historyData.filter((h) =>
              allowedMachineIds.includes(h.machine_id)
            );
          } else {
            historyData = [];
          }
        } else {
          historyData = [];
        }
      }
      // admin veya login olmayanlar için -> hiçbir ek filtre yok

      // 3) ilgili machine ve user bilgilerini enrich etmek
      const machineIds = Array.from(
        new Set((historyData || []).map((h) => h.machine_id))
      );
      const userIds = Array.from(
        new Set((historyData || []).map((h) => h.changed_by))
      );

      const [allMachines, profiles] = await Promise.all([
        api.get<Machine[]>('/machines'),
        api.get<Profile[]>('/profiles'),
      ]);

      const machineMap = new Map<number, Machine>(
        (allMachines || [])
          .filter((m) => machineIds.includes(m.id))
          .map((m) => [m.id, m])
      );

      const userMap = new Map<number, string>(
        (profiles || [])
          .filter((p) => userIds.includes(p.id))
          .map((p) => [p.id, p.full_name])
      );

      const enrichedHistory: HistoryEntry[] = (historyData || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.changed_at).getTime() -
            new Date(a.changed_at).getTime()
        )
        .map((h) => ({
          ...h,
          machine: machineMap.get(h.machine_id),
          user_name: userMap.get(h.changed_by) || 'Bilinmeyen Kullanıcı',
        }));

      setHistory(enrichedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  // ---- filtreler ----
  let filteredHistory = history;

  if (departmentFilter !== 'All') {
    const deptId = Number(departmentFilter);
    const deptMachines = machines.filter((m) => m.department_id === deptId);
    const deptMachineIds = deptMachines.map((m) => m.id);
    filteredHistory = filteredHistory.filter((h) =>
      deptMachineIds.includes(h.machine_id)
    );
  }

  if (machineFilter !== 'All') {
    const machineId = Number(machineFilter);
    filteredHistory = filteredHistory.filter(
      (h) => h.machine_id === machineId
    );
  }

  const getStatusColor = (status: string) => {
    const statusType = statusTypes.find((st) => st.name === status);
    if (!statusType) return 'bg-gray-100 text-gray-800 border-gray-200';

    const colorMap: Record<string, string> = {
      green: 'bg-green-100 text-green-800 border-green-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      pink: 'bg-pink-100 text-pink-800 border-pink-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return colorMap[statusType.color] || colorMap.gray;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Geçmiş yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <History className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">
            Durum Değişikliği Geçmişi
          </h2>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Filtreler</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bölüm
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="All">Tüm Bölümler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Makine
            </label>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="All">Tüm Makineler</option>
              {machines.map((machine) => (
                <option key={machine.id} value={String(machine.id)}>
                  {machine.machine_code} - {machine.machine_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">Geçmiş kaydı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((entry) => {
            const lastUpdate = new Date(entry.changed_at);
            return (
              <div
                key={entry.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {entry.machine?.machine_code || 'Bilinmeyen Makine'}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {entry.machine?.machine_name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {t('machines.updatedAt', {
                        date: lastUpdate.toLocaleDateString(),
                        time: lastUpdate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-4">
                  {entry.previous_status && (
                    <>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                          entry.previous_status
                        )}`}
                      >
                        {entry.previous_status}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </>
                  )}
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                      entry.status
                    )}`}
                  >
                    {entry.status}
                  </div>
                </div>

                <div className="flex items-center space-x-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center text-sm text-gray-600">
                    <UserIcon className="w-4 h-4 mr-2" />
                    <span>{entry.user_name}</span>
                  </div>

                  {entry.comment && (
                    <div className="flex-1 flex items-start text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      <MessageSquare className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{entry.comment}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
