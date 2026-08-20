/**
 * usePosMachine.ts
 * ---------------------------------------------------------------------------
 * Hook yang membungkus posMachineReducer dan menangani side-effect yang
 * TIDAK boleh hidup di dalam reducer murni:
 *   - Timer 20 detik auto-timeout saat locked_waiting_tap
 *   - Timer 3 detik auto-reset saat success
 *   - Memanggil backend untuk validasi kartu (async) saat TAP_CARD terjadi
 *
 * Reducer tetap murni (pure) — semua efek samping (setTimeout, fetch) ada di
 * sini, sesuai prinsip pemisahan logic vs. side-effect di React.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialPosMachineState,
  posMachineReducer,
  PosErrorInfo,
  StudentCardInfo,
  WAIT_TAP_TIMEOUT_MS,
  SUCCESS_AUTO_RESET_MS,
} from "./posMachine";

/**
 * Kontrak hasil validasi kartu dari backend / NFC bridge.
 * Sesuaikan dengan payload aktual endpoint mis. POST /api/v1/pos/charge
 */
export interface ChargeCardResult {
  success: boolean;
  transactionId?: string;
  student?: StudentCardInfo;
  error?: PosErrorInfo;
}

export interface UsePosMachineOptions {
  /**
   * Fungsi yang memanggil backend/NFC bridge untuk membebankan `amount`
   * ke kartu yang baru saja di-tap. Dipisah sebagai dependency injection
   * agar mudah di-mock saat testing.
   */
  chargeCard: (amount: number) => Promise<ChargeCardResult>;
  merchantId: string;
}

export function usePosMachine({ chargeCard, merchantId }: UsePosMachineOptions) {
  const [state, dispatch] = useReducer(posMachineReducer, initialPosMachineState);

  // Ref agar timer lama tidak menembak state yang sudah berubah (stale closure).
  const waitTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (waitTapTimerRef.current) clearTimeout(waitTapTimerRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    waitTapTimerRef.current = null;
    successTimerRef.current = null;
  }, []);

  // --- Timer: auto-timeout 20 detik saat menunggu tap kartu -----------------
  useEffect(() => {
    if (state.status === "locked_waiting_tap" && state.waitTapDeadline) {
      const remaining = Math.max(0, state.waitTapDeadline - Date.now());
      waitTapTimerRef.current = setTimeout(() => {
        dispatch({ type: "WAIT_TAP_TIMEOUT" });
      }, remaining || WAIT_TAP_TIMEOUT_MS);

      return () => {
        if (waitTapTimerRef.current) clearTimeout(waitTapTimerRef.current);
      };
    }
  }, [state.status, state.waitTapDeadline]);

  // --- Timer: auto-reset 3 detik setelah transaksi sukses -------------------
  useEffect(() => {
    if (state.status === "success" && state.successDeadline) {
      const remaining = Math.max(0, state.successDeadline - Date.now());
      successTimerRef.current = setTimeout(() => {
        dispatch({ type: "SUCCESS_TIMEOUT" });
      }, remaining || SUCCESS_AUTO_RESET_MS);

      return () => {
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
      };
    }
  }, [state.status, state.successDeadline]);

  // Bersihkan semua timer saat komponen unmount
  useEffect(() => clearTimers, [clearTimers]);

  /**
   * Dipanggil oleh event listener hardware NFC (native bridge / WebHID / WebNFC)
   * begitu chip kartu terdeteksi SAAT status === "locked_waiting_tap".
   * Reader di level hardware sebaiknya tetap disarm di luar state ini
   * (lihat catatan integrasi di PosTerminalClient.example.tsx).
   */
  const onCardTapped = useCallback(async () => {
    if (state.status !== "locked_waiting_tap" || state.lockedTotal === null) {
      return; // reader tidak "armed" -> abaikan tap yang tidak relevan
    }

    dispatch({ type: "TAP_CARD" });

    try {
      const result = await chargeCard(state.lockedTotal);

      if (result.success && result.student && result.transactionId) {
        dispatch({
          type: "TRANSACTION_SUCCESS",
          student: result.student,
          transactionId: result.transactionId,
        });
      } else {
        dispatch({
          type: "TRANSACTION_FAIL",
          error:
            result.error ?? {
              code: "CARD_NOT_RECOGNIZED",
              message: "Kartu tidak dapat diproses. Coba tap ulang.",
            },
        });
      }
    } catch {
      dispatch({
        type: "TRANSACTION_FAIL",
        error: {
          code: "READER_TIMEOUT",
          message: "Gagal terhubung ke server. Periksa koneksi terminal.",
        },
      });
    }
  }, [state.status, state.lockedTotal, chargeCard, merchantId]);

  return {
    state,
    dispatch,
    onCardTapped,
    /** true hanya ketika reader NFC seharusnya "armed"/listening secara software */
    isReaderArmed: state.status === "locked_waiting_tap",
  };
}
