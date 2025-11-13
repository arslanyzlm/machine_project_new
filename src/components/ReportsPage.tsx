import { useEffect, useState } from 'react';
import { FileText, Calendar, Filter, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Machine = Database['public']['Tables']['machines']['Row'];
type Department = Database['public']['Tables']['departments']['Row'];
type StatusType = Database['public']['Tables']['status_types']['Row'];
type StatusHistory = Database['public']['Tables']['status_history']['Row'];

interface StatusDuration {
  status: string;
  duration: number;
  percentage: number;
}

interface MachineReport {
  machineId: string;
  machineCode: string;
  machineName: string;
  statusDurations: StatusDuration[];
  totalTime: number;
}

interface DepartmentReport {
  statusDurations: StatusDuration[];
  totalTime: number;
  machineReports: MachineReport[];
}

export default function ReportsPage() {
  const { profile, user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamLeaderDepartments, setTeamLeaderDepartments] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    departmentId: 'all',
    machineId: 'all',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endDate: new Date().toISOString().slice(0, 16),
  });

  const [report, setReport] = useState<DepartmentReport | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [profile?.role, user?.id]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadDepartments(),
        loadMachines(),
        loadStatusTypes(),
        loadTeamLeaderDepartments(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadTeamLeaderDepartments = async () => {
    if (profile?.role !== 'team_leader' || !user?.id) return;

    try {
      const { data } = await supabase
        .from('department_leaders')
        .select('department_id')
        .eq('user_id', user.id);

      setTeamLeaderDepartments(data?.map(d => d.department_id) || []);
    } catch (error) {
      console.error('Error loading team leader departments:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error loading machines:', error);
    }
  };

  const loadStatusTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('status_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setStatusTypes(data || []);
    } catch (error) {
      console.error('Error loading status types:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const startTime = new Date(filters.startDate).getTime();
      const endTime = new Date(filters.endDate).getTime();
    //   const totalRangeTime = endTime - startTime;
        const now = Date.now();
        const effectiveEndTime = Math.min(endTime, now);
      let targetMachines: Machine[] = [];

      if (filters.machineId !== 'all') {
        const machine = machines.find(m => m.id === filters.machineId);
        if (machine) targetMachines = [machine];
      } else if (filters.departmentId !== 'all') {
        targetMachines = machines.filter(m => m.department_id === filters.departmentId);
      } else {
        targetMachines = machines;
      }

      if (profile?.role === 'team_leader') {
        targetMachines = targetMachines.filter(m =>
          m.department_id && teamLeaderDepartments.includes(m.department_id)
        );
      }

      const machineReports: MachineReport[] = [];
      const departmentStatusTotals: Record<string, number> = {};

      for (const machine of targetMachines) {
        const machineCreatedAt = new Date(machine.created_at).getTime();

        const { data: historyData, error } = await supabase
          .from('status_history')
          .select('*')
          .eq('machine_id', machine.id)
          .order('changed_at', { ascending: true });

        if (error) throw error;

        const statusDurations: Record<string, number> = {};
        const history = (historyData || []).filter(h =>
          new Date(h.changed_at).getTime() >= machineCreatedAt
        );

        const reportStartTime = Math.max(startTime, machineCreatedAt);

        if (reportStartTime >= effectiveEndTime) { //endTime) {
          machineReports.push({
            machineId: machine.id,
            machineCode: machine.machine_code,
            machineName: machine.machine_name,
            statusDurations: [],
            totalTime: 0,
          });
          continue;
        }

        if (history.length === 0) {
          continue;
        }

        const relevantHistory = history.filter(h => {
          const changeTime = new Date(h.changed_at).getTime();
          return changeTime < effectiveEndTime; //endTime;
        });

        if (relevantHistory.length === 0) {
          continue;
        }

        let currentPeriodStart = reportStartTime;
        let currentStatus: string | null = null;

        const firstChangeTime = new Date(relevantHistory[0].changed_at).getTime();
        if (firstChangeTime > reportStartTime) {
          const beforeFirstChange = history.find(h =>
            new Date(h.changed_at).getTime() <= reportStartTime
          );

          if (beforeFirstChange) {
            currentStatus = beforeFirstChange.status; //new_status;
          }
        }

        for (let i = 0; i < relevantHistory.length; i++) {
          const current = relevantHistory[i];
          const changeTime = new Date(current.changed_at).getTime();

          if (currentStatus && changeTime > currentPeriodStart) {
            const periodEnd = Math.min(changeTime, effectiveEndTime); // endTime);
            const duration = periodEnd - currentPeriodStart;

            if (duration > 0) {
              statusDurations[currentStatus] = (statusDurations[currentStatus] || 0) + duration;
              departmentStatusTotals[currentStatus] = (departmentStatusTotals[currentStatus] || 0) + duration;
            }
          }

          currentStatus = current.status; //new_status;
          currentPeriodStart = Math.max(changeTime, reportStartTime);
        }

        if (currentStatus && currentPeriodStart < effectiveEndTime) { //endTime) {
          const duration = effectiveEndTime - currentPeriodStart; //endTime - currentPeriodStart;
          if (duration > 0) {
            statusDurations[currentStatus] = (statusDurations[currentStatus] || 0) + duration;
            departmentStatusTotals[currentStatus] = (departmentStatusTotals[currentStatus] || 0) + duration;
          }
        }

        const machineTotal = Object.values(statusDurations).reduce((sum, dur) => sum + dur, 0);
        const statusDurationArray: StatusDuration[] = Object.entries(statusDurations)
          .map(([status, duration]) => ({
            status,
            duration,
            percentage: machineTotal > 0 ? (duration / machineTotal) * 100 : 0,
          }))
          .sort((a, b) => b.duration - a.duration);

        machineReports.push({
          machineId: machine.id,
          machineCode: machine.machine_code,
          machineName: machine.machine_name,
          statusDurations: statusDurationArray,
          totalTime: machineTotal,
        });
      }

      const departmentTotal = Object.values(departmentStatusTotals).reduce((sum, dur) => sum + dur, 0);
      const departmentStatusArray: StatusDuration[] = Object.entries(departmentStatusTotals)
        .map(([status, duration]) => ({
          status,
          duration,
          percentage: departmentTotal > 0 ? (duration / departmentTotal) * 100 : 0,
        }))
        .sort((a, b) => b.duration - a.duration);

      setReport({
        statusDurations: departmentStatusArray,
        totalTime: departmentTotal,
        machineReports,
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (statusName: string) => {
    const statusType = statusTypes.find(st => st.name === statusName);
    if (!statusType) return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };

    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
      red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
      gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
    };

    return colorMap[statusType.color] || colorMap.gray;
  };

  const availableDepartments = profile?.role === 'team_leader'
    ? departments.filter(d => teamLeaderDepartments.includes(d.id))
    : departments;

  const availableMachines = filters.departmentId !== 'all'
    ? machines.filter(m => m.department_id === filters.departmentId)
    : profile?.role === 'team_leader'
    ? machines.filter(m => m.department_id && teamLeaderDepartments.includes(m.department_id))
    : machines;

  const endForDisplay = () => {
    const end = new Date(filters.endDate).getTime();
    const now = Date.now();
    return new Date(Math.min(end, now)).toLocaleString();
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Durum Raporları</h2>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Filtreler</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bölüm
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => setFilters({ ...filters, departmentId: e.target.value, machineId: 'all' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">Tüm Bölümler</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Makine
            </label>
            <select
              value={filters.machineId}
              onChange={(e) => setFilters({ ...filters, machineId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">Tüm Makineler</option>
              {availableMachines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.machine_code} - {machine.machine_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Başlangıç Tarihi ve Saati
            </label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bitiş Tarihi ve Saati
            </label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <Calendar className="w-4 h-4" />
            <span>{loading ? 'Oluşturuluyor...' : 'Raporu Oluştur'}</span>
          </button>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {filters.machineId !== 'all'
                ? `Makine Raporu: ${machines.find(m => m.id === filters.machineId)?.machine_code}`
                : filters.departmentId !== 'all'
                ? `Bölüm Raporu: ${departments.find(d => d.id === filters.departmentId)?.name}`
                : 'Genel Rapor'}
            </h3>

            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Report Period: {new Date(filters.startDate).toLocaleString()} - {endForDisplay()}
                {/* Rapor Dönemi: {new Date(filters.startDate).toLocaleString()} - {new Date(filters.endDate).toLocaleString()} */}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Toplam Takip Edilen Süre: {formatDuration(report.totalTime)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Süre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Yüzde
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report.statusDurations.map((sd) => {
                    const colors = getStatusColor(sd.status);
                    return (
                      <tr key={sd.status} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {sd.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {formatDuration(sd.duration)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${colors.bg.replace('100', '500')}`}
                                style={{ width: `${sd.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-900 font-medium w-12">
                              {sd.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filters.machineId === 'all' && report.machineReports.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Makine Bazında Dağılım
              </h3>

              <div className="space-y-6">
                {report.machineReports.map((machineReport) => (
                  <div key={machineReport.machineId} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900">
                        {machineReport.machineCode} - {machineReport.machineName}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Toplam Süre: {formatDuration(machineReport.totalTime)}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                              Durum
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                              Süre
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                              Yüzde
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {machineReport.statusDurations.map((sd) => {
                            const colors = getStatusColor(sd.status);
                            return (
                              <tr key={sd.status}>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}>
                                    {sd.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {formatDuration(sd.duration)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {sd.percentage.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Makine durumu analizlerini görüntülemek için filtrelerinizi seçin ve "Raporu Oluştur" butonuna tıklayın
          </p>
        </div>
      )}
    </div>
  );
}
