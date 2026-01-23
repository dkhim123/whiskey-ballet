/**
 * Image utility to handle paths in both web and Electron
 */

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron
}

/**
 * Convert image path to work in both web and Electron
 * @param {string} imagePath - Original image path (could be /path.png or base64)
 * @returns {string} - Fixed image path
 */
export const getImageSrc = (imagePath) => {
  if (!imagePath) {
    return "/placeholder.svg" // Default placeholder
  }
  
  // If it's already a data URL (base64), return as-is
  if (imagePath.startsWith('data:')) {
    return imagePath
  }
  
  // If it's a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }
  
  // In Electron, convert relative paths to absolute
  if (isElectron()) {
    // If path starts with /, it's relative to public folder in the built app
    if (imagePath.startsWith('/')) {
      // In Electron production, files are in out/ folder
      return `.${imagePath}` // Convert /image.png to ./image.png
    }
  }
  
  return imagePath
}

/**
 * Validate if file is an image
 */
export const isValidImageFile = (file) => {
  if (!file || !file.type) return false
  return file.type.startsWith('image/')
}

/**
 * Convert image file to base64 data URL
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Compress image if too large
 */
export const compressImage = async (base64String, maxSizeMB = 1) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // Calculate new dimensions (max 800px width/height)
      let width = img.width
      let height = img.height
      const maxDimension = 800
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension
          width = maxDimension
        } else {
          width = (width / height) * maxDimension
          height = maxDimension
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      ctx.drawImage(img, 0, 0, width, height)
      
      // Try different quality levels to meet size requirement
      let quality = 0.9
      let result = canvas.toDataURL('image/jpeg', quality)
      
      // Keep reducing quality until size is acceptable
      while (result.length > maxSizeMB * 1024 * 1024 * 1.37 && quality > 0.1) {
        quality -= 0.1
        result = canvas.toDataURL('image/jpeg', quality)
      }
      
      resolve(result)
    }
    img.src = base64String
  })
}
