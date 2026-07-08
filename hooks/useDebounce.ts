/**
 * useDebounce — trì hoãn cập nhật giá trị đến khi user ngừng nhập.
 *
 * Dạy: useEffect cleanup, closures.
 * Mỗi lần value thay đổi, timer cũ bị xóa (clearTimeout) và
 * timer mới bắt đầu — chỉ sau `delay` ms không thay đổi thì mới update.
 */
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    // cleanup: xóa timer cũ mỗi khi value thay đổi
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
