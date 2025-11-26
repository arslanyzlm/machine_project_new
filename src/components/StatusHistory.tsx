import { useEffect, useState } from 'react';
import { History, Clock, User, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

interface StatusHistoryRow {
  id: number;
  machine_id: number;
  status: string;
  previous_status: string | null;
  comment: string | null;
  changed_by: number;
  changed_at: string;
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

interface Profile {
  id: number;
  full_name: string;
}

interface HistoryEntry extends StatusHistoryRow {
  user_name?: string;
}

interface StatusHistoryProps {
  machineId: number;      // artık number
  machineName: string;
}

export default function StatusHistory({ machineId, machineName }: StatusHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!machineId) return;

    const loadAll = async () => {
      setLoading(true);
      try {
        await Promise.all([loadHistory(), loadStatusTypes()]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [machineId]);

  const loadHistory = async () => {
    try {
      // backend: GET /machines/{id}/history?limit=20
      const historyData = await api.get<StatusHistoryRow[]>(
        `/machines/${machineId}/history?limit=20`
      );

      if (!historyData || historyData.length === 0) {
        setHistory([]);
        return;
      }

      const userIds = Array.from(new Set(historyData.map((h) => h.changed_by)));
      let userMap = new Map<number, string>();

      if (userIds.length > 0) {
        // backend: GET /profiles?ids=1,2,3
        const profiles = await api.get<Profile[]>(
          `/profiles?ids=${userIds.join(',')}`
        );
        userMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      }

      const enrichedHistory: HistoryEntry[] = historyData
        .slice()
        .sort(
          (a, b) =>
            new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
        )
        .map((h) => ({
          ...h,
          user_name: userMap.get(h.changed_by) || 'Bilinmeyen Kullanıcı',
        }));

      setHistory(enrichedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadStatusTypes = async () => {
    try {
      // backend: GET /status-types?only_active=true
      const data = await api.get<StatusType[]>(`/status-types?only_active=true`);
      setStatusTypes(data || []);
    } catch (error) {
      console.error('Error loading status types:', error);
    }
  };

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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <History className="w-6 h-6 text-gray-700" />
        <h3 className="text-xl font-bold text-gray-900">Durum Geçmişi</h3>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Makine:{' '}
          <span className="font-semibold text-gray-900">{machineName}</span>
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm">Geçmiş yükleniyor...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz herhangi bir durum değişikliği kaydedilmedi</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => {
            const changeDate = new Date(entry.changed_at);
            return (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                      entry.status
                    )}`}
                  >
                    {entry.status}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>
                      {changeDate.toLocaleDateString()}{' '}
                      {changeDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <User className="w-4 h-4 mr-2" />
                  <span>{entry.user_name}</span>
                </div>

                {entry.comment && (
                  <div className="flex items-start text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <MessageSquare className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{entry.comment}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
