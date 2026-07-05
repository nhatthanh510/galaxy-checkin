// Simulate a small network latency so loading states are exercised while running
// on mock data. Kept tiny to keep the kiosk feeling instant.
export function mockDelay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}
