import { Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

interface MachineCardProps {
  machine: Machine;
  onClick: () => void;
  canUpdate: boolean;
  statusColor: string;
  maxLines?: number;
}

const colorMap: Record<string, { color: string; textColor: string; bgColor: string; borderColor: string }> = {
  green: {
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  yellow: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  red: {
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  blue: {
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  purple: {
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  orange: {
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  pink: {
    color: 'bg-pink-500',
    textColor: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
  },
  gray: {
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

export default function MachineCard({ machine, onClick, canUpdate, statusColor, maxLines = 2 }: MachineCardProps) {
  const { t } = useTranslation();
  const config = colorMap[statusColor] || colorMap.gray;
  const lastUpdate = machine.last_updated_at ? new Date(machine.last_updated_at) : null;

  const clampStyle: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  return (
    <div
      className={`border-2 ${config.borderColor} ${config.bgColor} rounded-lg p-5 transition-all duration-200 hover:shadow-lg ${
        canUpdate ? 'cursor-pointer hover:scale-105' : ''
      }`}
      onClick={canUpdate ? onClick : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{machine.machine_code}</h3>
          <p className="text-sm text-gray-600 mt-1">{machine.machine_name}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${config.color} animate-pulse`}></div>
      </div>

      {machine.description && (
        <p className="text-xs text-gray-500 mb-3" style={clampStyle}>
          {machine.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${config.textColor} ${config.bgColor} border ${config.borderColor}`}>
          {machine.current_status}
        </div>
      </div>

      {lastUpdate && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center text-xs text-gray-500">
          <Clock className="w-3 h-3 mr-1" />
          <span>
            {t('machines.updatedAt', {
              date: lastUpdate.toLocaleDateString(),
              time: lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })}
          </span>
        </div>
      )}

      {statusColor === 'red' && (
        <div className="mt-2 flex items-center text-xs text-red-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          <span>{t('machines.attentionRequired')}</span>
        </div>
      )}
    </div>
  );
}
