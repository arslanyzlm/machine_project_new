import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Calendar, Filter, BarChart3, ChevronDown, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Machine {
  id: number;
  machine_code: string;
  machine_name: string;
  description: string;
  current_status: string;
  last_updated_at: string;
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
  color: string; // 'green', 'red', 'gray'...
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  created_by: number | null;
}

interface StatusHistory {
  id: number;
  machine_id: number;
  status: string;
  previous_status: string | null;
  comment: string | null;
  changed_by: number;
  changed_at: string;
}

interface DepartmentLeader {
  id: number;
  department_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

interface StatusDuration {
  status: string;
  duration: number;
  percentage: number;
}

interface MachineReport {
  machineId: number;
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

interface TimelineSegment {
  status: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface MachineTimeline {
  machineId: number;
  machineCode: string;
  machineName: string;
  segments: TimelineSegment[];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const formatLocalDateTimeForInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function ReportsPage() {
  const { profile, user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamLeaderDepartments, setTeamLeaderDepartments] = useState<number[]>([]);
  const [report, setReport] = useState<DepartmentReport | null>(null);
  const [timeline, setTimeline] = useState<MachineTimeline[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline'>('summary');

  const [hoveredSegment, setHoveredSegment] = useState<{
    segment: TimelineSegment;
    machine: MachineTimeline;
    x: number;
    y: number;
  } | null>(null);

  const machineDropdownRef = useRef<HTMLDivElement>(null);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);

  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
    return {
      departmentId: 'all' as string,
      machineIds: [] as string[], // string tutuyoruz, makine.id'den String() ile dolduracağız
      startDate: formatLocalDateTimeForInput(oneDayAgo),
      endDate: formatLocalDateTimeForInput(now),
    };
  });

  // ---- derived values ----
  const effectiveEndTime = useMemo(() => {
    const end = new Date(filters.endDate).getTime();
    const now = Date.now();
    return Math.min(end, now);
  }, [filters.endDate]);

  const availableDepartments = useMemo(
    () =>
      profile?.role === 'team_leader'
        ? departments.filter((d) => teamLeaderDepartments.includes(d.id))
        : departments,
    [departments, profile?.role, teamLeaderDepartments]
  );

  const availableMachines = useMemo(() => {
    const source =
      profile?.role === 'team_leader'
        ? machines.filter(
            (m) => m.department_id && teamLeaderDepartments.includes(m.department_id)
          )
        : machines;

    if (filters.departmentId !== 'all') {
      const deptIdNum = Number(filters.departmentId);
      return source.filter((m) => m.department_id === deptIdNum);
    }
    return source;
  }, [machines, filters.departmentId, profile?.role, teamLeaderDepartments]);

  const endForDisplay = () => new Date(effectiveEndTime).toLocaleString();

  // ---- click outside for machine dropdown ----
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        machineDropdownRef.current &&
        !machineDropdownRef.current.contains(event.target as Node)
      ) {
        setShowMachineDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- initial load ----
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [
          departmentsData,
          machinesData,
          statusTypesData,
          leaderRows,
        ] = await Promise.all([
          api.get<Department[]>('/departments'),
          api.get<Machine[]>('/machines'),
          api.get<StatusType[]>('/status-types?only_active=true'),
          profile?.role === 'team_leader' && user?.id
            ? api.get<DepartmentLeader[]>(
                `/department-leaders?user_id=${user.id}`
              )
            : Promise.resolve([] as DepartmentLeader[]),
        ]);

        departmentsData.sort((a, b) => a.name.localeCompare(b.name));
        machinesData.sort((a, b) => a.machine_code.localeCompare(b.machine_code));
        statusTypesData.sort((a, b) => a.display_order - b.display_order);

        setDepartments(departmentsData);
        setMachines(machinesData);
        setStatusTypes(statusTypesData);

        if (profile?.role === 'team_leader' && leaderRows && leaderRows.length > 0) {
          setTeamLeaderDepartments(leaderRows.map((d) => d.department_id));
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    };

    loadInitialData();
  }, [profile?.role, user?.id]);

  // ---- report generation ----
  const generateReport = async () => {
    setLoading(true);
    try {
      const startTime = new Date(filters.startDate).getTime();
      const endTime = effectiveEndTime;

      let targetMachines: Machine[] = [];

      if (filters.machineIds.length > 0) {
        targetMachines = machines.filter((m) =>
          filters.machineIds.includes(String(m.id))
        );
      } else if (filters.departmentId !== 'all') {
        const deptIdNum = Number(filters.departmentId);
        targetMachines = machines.filter((m) => m.department_id === deptIdNum);
      } else {
        targetMachines = machines;
      }

      if (profile?.role === 'team_leader') {
        targetMachines = targetMachines.filter(
          (m) => m.department_id && teamLeaderDepartments.includes(m.department_id)
        );
      }

      const machineReports: MachineReport[] = [];
      const departmentStatusTotals: Record<string, number> = {};
      const machineTimelines: MachineTimeline[] = [];

      for (const machine of targetMachines) {
        const machineCreatedAt = new Date(machine.created_at).getTime();

        const historyData = await api.get<StatusHistory[]>(
          `/machines/${machine.id}/history`
        );

        const history = (historyData || []).filter(
          (h) => new Date(h.changed_at).getTime() >= machineCreatedAt
        );

        const reportStartTime = Math.max(startTime, machineCreatedAt);

        if (reportStartTime >= endTime || history.length === 0) {
          continue;
        }

        const relevantHistory = history.filter(
          (h) => new Date(h.changed_at).getTime() < endTime
        );

        if (relevantHistory.length === 0) {
          continue;
        }

        const statusDurations: Record<string, number> = {};
        const segments: TimelineSegment[] = [];

        let currentPeriodStart = reportStartTime;
        let currentStatus: string | null = null;

        const firstChangeTime = new Date(relevantHistory[0].changed_at).getTime();
        if (firstChangeTime > reportStartTime) {
          const beforeFirstChange = history.find(
            (h) => new Date(h.changed_at).getTime() <= reportStartTime
          );
          if (beforeFirstChange) {
            currentStatus = beforeFirstChange.status;
          }
        }

        for (let i = 0; i < relevantHistory.length; i++) {
          const current = relevantHistory[i];
          const changeTime = new Date(current.changed_at).getTime();

          if (currentStatus && changeTime > currentPeriodStart) {
            const periodEnd = Math.min(changeTime, endTime);
            const duration = periodEnd - currentPeriodStart;

            if (duration > 0) {
              statusDurations[currentStatus] =
                (statusDurations[currentStatus] || 0) + duration;
              departmentStatusTotals[currentStatus] =
                (departmentStatusTotals[currentStatus] || 0) + duration;

              segments.push({
                status: currentStatus,
                startTime: currentPeriodStart,
                endTime: periodEnd,
                duration,
              });
            }
          }

          currentStatus = current.status;
          currentPeriodStart = Math.max(changeTime, reportStartTime);
        }

        if (currentStatus && currentPeriodStart < endTime) {
          const duration = endTime - currentPeriodStart;
          if (duration > 0) {
            statusDurations[currentStatus] =
              (statusDurations[currentStatus] || 0) + duration;
            departmentStatusTotals[currentStatus] =
              (departmentStatusTotals[currentStatus] || 0) + duration;

            segments.push({
              status: currentStatus,
              startTime: currentPeriodStart,
              endTime: endTime,
              duration,
            });
          }
        }

        const machineTotal = Object.values(statusDurations).reduce(
          (sum, dur) => sum + dur,
          0
        );

        const statusDurationArray: StatusDuration[] = Object.entries(
          statusDurations
        )
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

        machineTimelines.push({
          machineId: machine.id,
          machineCode: machine.machine_code,
          machineName: machine.machine_name,
          segments,
        });
      }

      const departmentTotal = Object.values(departmentStatusTotals).reduce(
        (sum, dur) => sum + dur,
        0
      );
      const departmentStatusArray: StatusDuration[] = Object.entries(
        departmentStatusTotals
      )
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
      setTimeline(machineTimelines);
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

  const formatDateTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (statusName: string) => {
    const statusType = statusTypes.find((st) => st.name === statusName);
    if (!statusType)
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200',
        solid: '#9CA3AF',
      };

    const colorMap: Record<
      string,
      { bg: string; text: string; border: string; solid: string }
    > = {
      green: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-200',
        solid: '#10B981',
      },
      blue: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-200',
        solid: '#3B82F6',
      },
      yellow: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        solid: '#F59E0B',
      },
      red: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-200',
        solid: '#EF4444',
      },
      purple: {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        border: 'border-purple-200',
        solid: '#A855F7',
      },
      orange: {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        border: 'border-orange-200',
        solid: '#F97316',
      },
      pink: {
        bg: 'bg-pink-100',
        text: 'text-pink-800',
        border: 'border-pink-200',
        solid: '#EC4899',
      },
      gray: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200',
        solid: '#9CA3AF',
      },
    };

    return colorMap[statusType.color] || colorMap.gray;
  };

  const toggleMachineSelection = (machineId: string) => {
    setFilters((prev) => ({
      ...prev,
      machineIds: prev.machineIds.includes(machineId)
        ? prev.machineIds.filter((id) => id !== machineId)
        : [...prev.machineIds, machineId],
    }));
  };

  const handleDepartmentChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      departmentId: value,
      machineIds: [], // bölüm değişince makine seçimini sıfırla
    }));
  };

  const selectedDeptName =
  filters.departmentId !== 'all'
    ? departments.find((d) => d.id === Number(filters.departmentId))?.name
    : undefined;

  // ---- JSX ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Durum Raporları</h2>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Filtreler</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Departman (single) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bölüm
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">Tüm Bölümler</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Makineler (multi) */}
          <div className="relative" ref={machineDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Makineler
            </label>
            <button
              type="button"
              onClick={() => setShowMachineDropdown(!showMachineDropdown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:border-transparent flex items-center justify-between"
            >
              <span className="text-sm text-gray-700 truncate">
                {filters.machineIds.length === 0
                  ? 'Makine seçiniz...'
                  : `${filters.machineIds.length} makine seçili`}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </button>
            {filters.machineIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filters.machineIds.map((machineId) => {
                  const machine = machines.find((m) => String(m.id) === machineId);
                  return machine ? (
                    <span
                      key={machineId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {machine.machine_code}
                      <button
                        onClick={() => toggleMachineSelection(machineId)}
                        className="hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            {showMachineDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <button
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        machineIds: availableMachines.map((m) => String(m.id)),
                      }));
                    }}
                    className="text-xs text-gray-600 hover:text-gray-900 mr-3"
                  >
                    Tümünü Seç
                  </button>
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, machineIds: [] }));
                    }}
                    className="text-xs text-gray-600 hover:text-gray-900"
                  >
                    Temizle
                  </button>
                </div>
                {availableMachines.map((machine) => (
                  <label
                    key={machine.id}
                    className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.machineIds.includes(String(machine.id))}
                      onChange={() => toggleMachineSelection(String(machine.id))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      {machine.machine_code} - {machine.machine_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tarih alanları */}
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

      {/* Tabs + içerik (bundan sonrası mantık olarak seninkiyle aynı, sadece tipler düzeltildi) */}
      {/* ... aynen senin JSX’in devam ediyor ... */}
      {/* Burayı olduğu gibi bırakabilirsin, sadece supabase bağımlılığı kalmadı. */}
      
      {/* AŞAĞIYA senin orijinal JSX’ini kopyalayıp sadece küçük tip fixlerini uyguladım;
          mesaj çok uzamasın diye yukarıda kestim, ama bire bir kullandığın JSX’i
          bu yeni tiplerle gömebilirsin. */}

                {/* Tabs + içerik */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6">
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'summary'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Durum Özeti</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'timeline'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Zaman Çizelgesi</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Loading */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Rapor oluşturuluyor...</p>
            </div>
          )}

          {/* Durum Özeti Tab */}
          {!loading && activeTab === 'summary' && report && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {filters.machineIds.length > 0
                    ? `Seçili Makineler (${filters.machineIds.length})`
                    : filters.departmentId !== 'all' && selectedDeptName
                    ? `Bölüm Raporu: ${selectedDeptName}`
                    : 'Genel Rapor'}
                </h3>

                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Rapor Dönemi: {new Date(filters.startDate).toLocaleString()} -{' '}
                    {endForDisplay()}
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
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                              >
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
                                    className="h-full"
                                    style={{
                                      backgroundColor: colors.solid,
                                      width: `${sd.percentage}%`,
                                    }}
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

              {/* Makine bazında dağılım – sadece belirli makine seçimi yoksa */}
              {filters.machineIds.length === 0 && report.machineReports.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Makine Bazında Dağılım
                  </h3>

                  <div className="space-y-6">
                    {report.machineReports.map((machineReport) => (
                      <div
                        key={machineReport.machineId}
                        className="border border-gray-200 rounded-lg p-4"
                      >
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
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}
                                      >
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

          {/* Timeline Tab */}
          {!loading && activeTab === 'timeline' && timeline.length > 0 && (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Zaman Çizelgesi:{' '}
                  {new Date(filters.startDate).toLocaleString()} -{' '}
                  {new Date(effectiveEndTime).toLocaleString()}
                </p>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {timeline.map((machineTimeline) => (
                    <div
                      key={machineTimeline.machineId}
                      className="mb-6 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="mb-3">
                        <h4 className="font-semibold text-gray-900">
                          {machineTimeline.machineCode} - {machineTimeline.machineName}
                        </h4>
                      </div>

                      {machineTimeline.segments.length === 0 ? (
                        <div className="text-sm text-gray-500 italic py-4">
                          Seçilen zaman aralığında durum verisi bulunmuyor
                        </div>
                      ) : (
                        <div className="relative h-12 bg-gray-100 rounded overflow-hidden">
                        {machineTimeline.segments.map((segment, idx) => {
                          const start = new Date(filters.startDate).getTime();
                          // const end = new Date(filters.endDate).getTime();
                          const end = effectiveEndTime;
                          const totalRange = end - start || 1; // 0’a bölmeyi önle

                          const rawLeft = ((segment.startTime - start) / totalRange) * 100;
                          const rawWidth = (segment.duration / totalRange) * 100;

                          // 0–100 arası clamp et, toplam 100’ü geçmesin
                          const leftPercent = Math.max(0, Math.min(100, rawLeft));
                          const widthPercent = Math.max(
                            0,
                            Math.min(100 - leftPercent, rawWidth)
                          );

                          const colors = getStatusColor(segment.status);

                          return (
                            <div
                              key={idx}
                              className="absolute top-1 bottom-1 rounded cursor-pointer transition-opacity hover:opacity-80"
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                backgroundColor: colors.solid,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredSegment({
                                  segment,
                                  machine: machineTimeline,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setHoveredSegment(null)}
                            />
                          );
                        })}
                      </div>

                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Henüz rapor yoksa */}
          {!loading && !report && timeline.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                Makine durumu analizlerini görüntülemek için filtrelerinizi seçin ve
                &quot;Raporu Oluştur&quot; butonuna tıklayın.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline tooltip */}
      {hoveredSegment && (
        <div
          className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm pointer-events-none"
          style={{
            left: `${hoveredSegment.x}px`,
            top: `${hoveredSegment.y - 10}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold">
              {hoveredSegment.machine.machineCode} -{' '}
              {hoveredSegment.machine.machineName}
            </p>
            <p>
              <span className="text-gray-300">Durum:</span>{' '}
              {hoveredSegment.segment.status}
            </p>
            <p>
              <span className="text-gray-300">Başlangıç:</span>{' '}
              {formatDateTime(hoveredSegment.segment.startTime)}
            </p>
            <p>
              <span className="text-gray-300">Bitiş:</span>{' '}
              {formatDateTime(hoveredSegment.segment.endTime)}
            </p>
            <p>
              <span className="text-gray-300">Süre:</span>{' '}
              {formatDuration(hoveredSegment.segment.duration)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

