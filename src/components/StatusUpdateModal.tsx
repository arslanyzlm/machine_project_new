import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

interface StatusUpdateModalProps {
  machine: Machine;
  onClose: () => void;
  onUpdate: () => void;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export default function StatusUpdateModal({
  machine,
  onClose,
  onUpdate,
}: StatusUpdateModalProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(
    machine.current_status
  );
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatusTypes();
  }, []);

  const loadStatusTypes = async () => {
    try {
      // backend: GET /status-types?only_active=true
      const data = await api.get<StatusType[]>('/status-types?only_active=true');
      data.sort((a, b) => a.display_order - b.display_order);
      setStatusTypes(data);
    } catch (err) {
      console.error('Error loading status types:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !profile) {
      setError(t('errors.mustBeLoggedIn'));
      return;
    }

    if (selectedStatus === machine.current_status && !comment.trim()) {
      setError(t('errors.changeStatusOrComment'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // backend: POST /machines/{id}/status
      // Bu endpoint hem makine durumunu güncellesin
      // hem de status_history'ye kayıt atsın.
      await api.post(`/machines/${machine.id}/status`, {
        status: selectedStatus,
        comment: comment.trim() || null,
        changed_by: user.id, // şimdilik buradan gönderiyoruz
      });

      onUpdate(); // parent listeyi/overview’ı refresh etsin
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update machine status'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            {t('status.updateStatus')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('machines.title')}
            </label>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium text-gray-900">
                {machine.machine_code}
              </p>
              <p className="text-sm text-gray-600">{machine.machine_name}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {t('status.currentStatus')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusTypes.map((statusType) => {
                const colors = colorMap[statusType.color] || colorMap.gray;
                return (
                  <button
                    key={statusType.id}
                    type="button"
                    onClick={() => setSelectedStatus(statusType.name)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                      selectedStatus === statusType.name
                        ? 'bg-gray-900 text-white border-gray-900'
                        : `${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`
                    }`}
                  >
                    {statusType.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="comment"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              {t('status.commentOptional')}
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder={t('status.commentPlaceholder')}
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.loading') : t('status.updateButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
