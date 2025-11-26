import { useEffect, useState } from 'react';
import { Settings, Plus, X, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Machine {
  id: number;
  machine_code: string;
  machine_name: string;
  description: string;
  current_status: string;
  department_id: number | null;

  // backend'de var ama burada kullanmıyoruz, tip uyuşsun diye ekliyoruz:
  last_updated_at?: string | null;
  last_updated_by?: number | null;
  created_at?: string;
}

interface Department {
  id: number;
  name: string;
  description?: string | null;
}

interface DepartmentLeader {
  id: number;
  department_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

export default function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    machine_code: '',
    machine_name: '',
    description: '',
    department_id: '', // select string, submit'te number'a çeviriyoruz
  });

  const [teamLeaderDepartments, setTeamLeaderDepartments] = useState<number[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
    // rol veya profil değişince erişim de değişebilir
  }, [profile?.role, profile?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1) tüm bölümler ve makineleri çek
      const [depts, allMachines] = await Promise.all([
        api.get<Department[]>('/departments'),
        api.get<Machine[]>('/machines'),
      ]);

      // bölümleri isme göre sırala
      const sortedDepts = (depts || [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(sortedDepts);

      // 2) team_leader ise sadece kendi sorumlu olduğu bölümlerin makineleri
      if (profile?.role === 'team_leader' && profile.id) {
        const leaders = await api.get<DepartmentLeader[]>('/department-leaders', {
          params: { user_id: profile.id },
        });

        const deptIds = (leaders || []).map((d) => d.department_id);
        setTeamLeaderDepartments(deptIds);

        const filteredMachines = (allMachines || []).filter(
          (m) => m.department_id !== null && deptIds.includes(m.department_id),
        );

        // makineleri koda göre sırala
        setMachines(
          filteredMachines
            .slice()
            .sort((a, b) => a.machine_code.localeCompare(b.machine_code)),
        );
      } else {
        // admin (veya ileride başka rol eklenirse) → tüm makineler
        setMachines(
          (allMachines || [])
            .slice()
            .sort((a, b) => a.machine_code.localeCompare(b.machine_code)),
        );
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Bölüm listesi: admin tümünü görür, team_leader sadece kendi bölümlerini --- //
  const availableDepartments: Department[] =
    profile?.role === 'admin'
      ? departments
      : departments.filter((dept) => teamLeaderDepartments.includes(dept.id));

  // Modal açıldığında ve yalnızca 1 uygun bölüm varsa otomatik seç
  useEffect(() => {
    if (showModal && profile?.role === 'team_leader' && availableDepartments.length === 1) {
      setFormData((prev) => ({
        ...prev,
        department_id: String(availableDepartments[0].id),
      }));
    }
  }, [showModal, profile?.role, availableDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const chosenDeptId = formData.department_id
      ? Number(formData.department_id)
      : null;

    // Ek güvenlik: team_leader sadece kendi departmanlarına makine ekleyebilsin
    if (
      profile?.role === 'team_leader' &&
      chosenDeptId !== null &&
      !teamLeaderDepartments.includes(chosenDeptId)
    ) {
      alert('Bu bölüme makine ekleme yetkiniz yok.');
      return;
    }

    try {
      const payload = {
        machine_code: formData.machine_code,
        machine_name: formData.machine_name,
        description: formData.description,
        current_status: 'Beklemede', // ilk durum
        department_id: chosenDeptId,
      };

      await api.post<Machine>('/machines', payload);

      setFormData({
        machine_code: '',
        machine_name: '',
        description: '',
        department_id: '',
      });
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error adding machine:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu makineyi silmek istediğinizden emin misiniz?')) return;

    try {
      await api.del(`/machines/${id}`);
      await loadData();
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  const getDepartmentName = (deptId: number | null) => {
    if (deptId == null) return 'Atanmamış';
    return departments.find((d) => d.id === deptId)?.name || 'Bilinmiyor';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Makine Yönetimi</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={profile?.role === 'team_leader' && availableDepartments.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Makine Ekle</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Kod
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Ad
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Bölüm
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Durum
              </th>
              {profile?.role === 'admin' && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  İşlemler
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {machines.map((machine) => (
              <tr key={machine.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {machine.machine_code}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {machine.machine_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {getDepartmentName(machine.department_id)}
                </td>
                <td className="px-6 py-4 text-sm">{machine.current_status}</td>
                {profile?.role === 'admin' && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(machine.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Makine Ekle</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Makine Kodu
                </label>
                <input
                  type="text"
                  value={formData.machine_code}
                  onChange={(e) =>
                    setFormData({ ...formData, machine_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g., M006"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Makine Adı
                </label>
                <input
                  type="text"
                  value={formData.machine_name}
                  onChange={(e) =>
                    setFormData({ ...formData, machine_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g., CNC Machine B"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Kısa açıklama"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bölüm
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                >
                  <option value="">Bölüm Seç</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Makine Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
