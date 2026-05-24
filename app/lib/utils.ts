import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const WORKDAYS_PER_WEEK = 5
export const WORK_DOW = [0, 1, 2, 3, 4] // Sun–Thu

export function isWeekend(date: Date): boolean {
  return !WORK_DOW.includes(date.getDay())
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Week starts on Sunday
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDays(weekStart: Date): Date[] {
  return WORK_DOW.map(offset => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + offset)
    return d
  })
}
