export type Role = "admin" | "team_leader" | "operator";

export interface Profile {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  created_at: string;
  created_by: number | null;
}

export interface DepartmentLeader {
  id: number;
  department_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

export interface Machine {
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

export interface MachineOperator {
  id: number;
  machine_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number | null;
}

export interface StatusType {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  created_by: number | null;
}

export interface StatusHistory {
  id: number;
  machine_id: number;
  status: string;
  previous_status: string | null;
  comment: string | null;
  changed_by: number;
  changed_at: string;
}
