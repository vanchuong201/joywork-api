/**
 * Cache TTL trong tiến trình (không cần Redis) cho các response đọc công khai.
 *
 * Mục đích: tránh re-compute các truy vấn nặng lặp lại (vd danh sách jobs trong
 * campaign traffic — nhiều người xem cùng bộ lọc phổ biến). Mỗi worker giữ cache
 * riêng (an toàn với cluster); TTL ngắn nên độ trễ dữ liệu ở mức chấp nhận được.
 *
 * KISS: Map + thời điểm hết hạn + giới hạn số entry (evict cũ nhất khi đầy).
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private store = new Map<string, Entry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.ttlMs <= 0) return; // cache tắt
    // Evict entry cũ nhất (insertion order của Map) khi đầy.
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
