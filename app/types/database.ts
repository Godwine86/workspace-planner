export type Status = 'office' | 'remote' | 'leave' | 'other'
export type Role = 'admin' | 'editor' | 'viewer'

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: Group
        Insert: Omit<Group, 'id'>
        Update: Partial<Omit<Group, 'id'>>
      }
      staff: {
        Row: Staff
        Insert: Omit<Staff, 'id'>
        Update: Partial<Omit<Staff, 'id'>>
      }
      schedule_entries: {
        Row: ScheduleEntry
        Insert: Omit<ScheduleEntry, 'id'>
        Update: Partial<Omit<ScheduleEntry, 'id'>>
      }
      week_plans: {
        Row: WeekPlan
        Insert: Omit<WeekPlan, 'id'>
        Update: Partial<Omit<WeekPlan, 'id'>>
      }
      rotation_debt: {
        Row: RotationDebt
        Insert: Omit<RotationDebt, 'id'>
        Update: Partial<Omit<RotationDebt, 'id'>>
      }
      user_roles: {
        Row: UserRole
        Insert: Omit<UserRole, 'id'>
        Update: Partial<Omit<UserRole, 'id'>>
      }
      app_settings: {
        Row: AppSetting
        Insert: Omit<AppSetting, 'id'>
        Update: Partial<Omit<AppSetting, 'id'>>
      }
      holidays: {
        Row: Holiday
        Insert: Omit<Holiday, 'id'>
        Update: Partial<Omit<Holiday, 'id'>>
      }
    }
  }
}

export interface Group {
  id: string
  name: string
  color: string
}

export interface Staff {
  id: string
  name: string
  role: string | null
  group_id: string | null
  tgt_office: number
  tgt_remote: number
  /** day-of-week keyed pattern: { 0: 'office', 1: 'remote', ... } */
  pattern: Record<string, Status | null> | null
}

export interface ScheduleEntry {
  id: string
  staff_id: string
  entry_date: string // YYYY-MM-DD
  status: Status
  is_locked: boolean
}

export interface WeekPlan {
  id: string
  week_start: string // YYYY-MM-DD (Sunday)
  is_published: boolean
}

export interface RotationDebt {
  id: string
  staff_id: string
  debt: number
}

export interface UserRole {
  id: string
  user_id: string
  role: Role
  staff_id: string | null
}

export interface AppSetting {
  id: string
  key: string
  value: string
}

export interface Holiday {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
}
