import { useState, useEffect } from 'react'

/**
 * Debounces a value - delays updating until user stops typing
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {any} - Debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // Set timeout to update debounced value after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cleanup: clear timeout if value changes before delay completes
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
