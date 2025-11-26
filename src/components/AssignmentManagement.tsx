import { useEffect, useState } from 'react';
import { UserCheck, Plus, X, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Department {
  id: number;
  name: string;
  description: string;
}

interface Machine {
  id: number;
  machine_code: string;
  machine_name: string;
  description: string;
  department_id: number | null;
}

type Role = 'admin' | 'team_leader' | 'operator';

interface Profile {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

interface DepartmentLeader {
  id: number;
  department_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

interface MachineOperator {
  id: number;
  machine_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

interface AssignmentManagementProps {
  type: 'department' | 'machine';
}

export default function AssignmentManagement({ type }: AssignmentManagementProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<(DepartmentLeader | MachineOperator)[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const { profile } = useAuth(); // assigned_by için profile.id kullanacağız

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const loadData = async () => {
    try {
      if (type === 'department') {
        // Bölüm sorumluları ekranı
        const [deptsData, usersData, assignsData] = await Promise.all([
          api.get<Department[]>('/departments'),
          api.get<Profile[]>('/profiles?role=team_leader'),
          api.get<DepartmentLeader[]>('/department-leaders'),
        ]);

        setDepartments(deptsData);
        setUsers(usersData);
        setAssignments(assignsData);
      } else {
        // Makine operatörleri ekranı
        let machinesData: Machine[] = [];

        if (profile?.role === 'team_leader' && profile.id) {
          // Sadece kendi sorumlu olduğu departmanların makineleri
          const myDepts = await api.get<DepartmentLeader[]>(
            `/department-leaders?user_id=${profile.id}`
          );

          const deptIds = myDepts.map((d) => d.department_id);
          if (deptIds.length > 0) {
            machinesData = await api.get<Machine[]>(
              `/machines?department_ids=${deptIds.join(',')}`
            );
          } else {
            machinesData = [];
          }
        } else {
          // admin vb. -> tüm makineler
          machinesData = await api.get<Machine[]>('/machines');
        }

        const [usersData, assignsData] = await Promise.all([
          api.get<Profile[]>('/profiles?role=operator'),
          api.get<MachineOperator[]>('/machine-operators'),
        ]);

        setMachines(machinesData);
        setUsers(usersData);
        setAssignments(assignsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedTarget || !selectedUser) return;
    if (!profile?.id) {
      console.error('Profile id bulunamadı, assigned_by için lazım');
      return;
    }

    try {
      if (type === 'department') {
        // POST /department-leaders
        await api.post('/department-leaders', {
          department_id: Number(selectedTarget),
          user_id: Number(selectedUser),
          assigned_by: profile.id,
        });
      } else {
        // POST /machine-operators
        await api.post('/machine-operators', {
          machine_id: Number(selectedTarget),
          user_id: Number(selectedUser),
          assigned_by: profile.id,
        });
      }

      setSelectedTarget('');
      setSelectedUser('');
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error assigning:', error);
    }
  };

  const handleUnassign = async (id: number) => {
    try {
      const basePath = type === 'department' ? '/department-leaders' : '/machine-operators';
      // DELETE /department-leaders/{id} veya /machine-operators/{id}
      await api.del(`${basePath}/${id}`);
      await loadData();
    } catch (error) {
      console.error('Error unassigning:', error);
    }
  };

  const getAssignmentName = (assignment: DepartmentLeader | MachineOperator) => {
    if (type === 'department') {
      const dept = departments.find(
        (d) => d.id === (assignment as DepartmentLeader).department_id
      );
      const user = users.find((u) => u.id === assignment.user_id);
      return { target: dept?.name || 'Unknown', user: user?.full_name || 'Unknown' };
    } else {
      const machine = machines.find(
        (m) => m.id === (assignment as MachineOperator).machine_id
      );
      const user = users.find((u) => u.id === assignment.user_id);
      return { target: machine?.machine_code || 'Unknown', user: user?.full_name || 'Unknown' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserCheck className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">
            {type === 'department' ? 'Bölüm Sorumluları' : 'Makine Operatörleri'}
          </h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{type === 'department' ? 'Sorumlu' : 'Operatör'} Ata</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                {type === 'department' ? 'Bölüm' : 'Makine'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                {type === 'department' ? 'Bölüm Sorumlusu' : 'Operatör'}
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assignments.map((assignment) => {
              const { target, user } = getAssignmentName(assignment);
              return (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {target}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleUnassign(assignment.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {assignments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Henüz bir atama yok
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {type === 'department' ? 'Bölüm Sorumlusu' : 'Operatör'} Ata
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {type === 'department' ? 'Bölüm' : 'Makine'} Seç
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">Seç...</option>
                  {type === 'department'
                    ? departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))
                    : machines.map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.machine_code} - {machine.machine_name}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {type === 'department' ? 'Bölüm Sorumlusu' : 'Operatör'} Seç
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">Seç...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedTarget || !selectedUser}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ata
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
