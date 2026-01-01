import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

export const getRelativeTime = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { 
    addSuffix: true,
    locale: id 
  })
}

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const generateAvatarUrl = (username: string): string => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
}