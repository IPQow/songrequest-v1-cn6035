export const formatTimeSince = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  let interval = Math.floor(seconds / 31536000) // years
  if (interval >= 1) {
    return interval === 1 ? '1 year ago' : `${interval} years ago`
  }

  interval = Math.floor(seconds / 2592000) // months
  if (interval >= 1) {
    return interval === 1 ? '1 month ago' : `${interval} months ago`
  }

  interval = Math.floor(seconds / 86400) // days
  if (interval >= 1) {
    return interval === 1 ? '1 day ago' : `${interval} days ago`
  }

  interval = Math.floor(seconds / 3600) // hours
  if (interval >= 1) {
    return interval === 1 ? '1 hour ago' : `${interval} hours ago`
  }

  interval = Math.floor(seconds / 60) // minutes
  if (interval >= 1) {
    return interval === 1 ? '1 minute ago' : `${interval} minutes ago`
  }

  return seconds <= 5 ? 'just now' : `${Math.floor(seconds)} seconds ago`
} 