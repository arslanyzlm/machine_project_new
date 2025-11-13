import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Machine = Database['public']['Tables']['machines']['Row'];
type StatusType = Database['public']['Tables']['status_types']['Row'];

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

export default function StatusUpdateModal({ machine, onClose, onUpdate }: StatusUpdateModalProps) {
  const { t } = useTranslation();
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(machine.current_status);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    loadStatusTypes();
  }, []);

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
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          current_status: selectedStatus,
          last_updated_at: new Date().toISOString(),
          last_updated_by: user.id,
        })
        .eq('id', machine.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          machine_id: machine.id,
          status: selectedStatus,
          previous_status: machine.current_status,
          comment: comment.trim(),
          changed_by: user.id,
          changed_at: new Date().toISOString(),
        });

      if (historyError) throw historyError;

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update machine status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">{t('status.updateStatus')}</h3>
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
              <p className="font-medium text-gray-900">{machine.machine_code}</p>
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
            <label htmlFor="comment" className="block text-sm font-semibold text-gray-700 mb-2">
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
