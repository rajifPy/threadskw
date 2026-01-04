// utils/loadingHelpers.ts
// ✅ BUAT FILE BARU INI

/**
 * Fungsi helper untuk memastikan loading minimal ditampilkan selama X detik
 * Berguna agar animasi loading tidak terlalu cepat hilang
 */
export const withMinimumDelay = async <T>(
  promise: Promise<T>,
  minimumDelay: number = 3000 // default 3 detik
): Promise<T> => {
  const start = Date.now()
  const result = await promise
  const elapsed = Date.now() - start
  
  // Jika waktu yang sudah berlalu kurang dari minimum delay
  if (elapsed < minimumDelay) {
    // Tunggu sisa waktu
    await new Promise(resolve => setTimeout(resolve, minimumDelay - elapsed))
  }
  
  return result
}

/**
 * Hook custom untuk loading state dengan minimum delay
 */
import { useState, useCallback } from 'react'

export const useLoadingWithDelay = (minimumDelay: number = 3000) => {
  const [loading, setLoading] = useState(true)
  
  const executeWithDelay = useCallback(async <T>(
    fn: () => Promise<T>
  ): Promise<T> => {
    setLoading(true)
    const result = await withMinimumDelay(fn(), minimumDelay)
    setLoading(false)
    return result
  }, [minimumDelay])
  
  return { loading, setLoading, executeWithDelay }
}
