/**
 * posMachine.ts
 * ---------------------------------------------------------------------------
 * State machine untuk EduConnect POS Terminal (NFC KTA Tap-to-Pay).
 *
 * Alur state:
 *   idle -> building -> locked_waiting_tap -> processing
 *        -> success -> (auto-reset) idle
 *        -> error_insufficient_balance | error_daily_limit | error_card_blocked
 *           -> (retry) locked_waiting_tap  |  (batal) building
 *
 * Desain ini sengaja dipisah dari komponen React (posMachine.ts murni logic)
 * agar reducer bisa di-unit-test tanpa render UI, dan mudah dipakai ulang
 * di komponen kasir lain (mis. varian tablet / varian kios swalayan siswa).
 * ---------------------------------------------------------------------------
 */

// ============================================================================
// 1. DOMAIN TYPES
// ============================================================================

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface StudentCardInfo {
  studentId: string;
  studentName: string;
  /** Saldo tabungan/e-wallet siswa saat ini (setelah transaksi jika sudah sukses) */
  balance: number;
  /** Batas pagu jajan harian yang ditetapkan orang tua/institusi */
  dailyLimit: number;
  /** Total yang sudah terpakai dari pagu harian, sebelum transaksi ini */
  dailySpent: number;
}

/** Kode error yang dikembalikan backend saat validasi kartu / saldo gagal */
export type PosErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "DAILY_LIMIT_EXCEEDED"
  | "CARD_BLOCKED"
  | "CARD_NOT_RECOGNIZED"
  | "READER_TIMEOUT";

export interface PosErrorInfo {
  code: PosErrorCode;
  message: string;
  /** Nominal kekurangan, hanya relevan untuk INSUFFICIENT_BALANCE */
  amountShortfall?: number;
  /** Sisa pagu harian, hanya relevan untuk DAILY_LIMIT_EXCEEDED */
  dailyLimitRemaining?: number;
}

// ============================================================================
// 2. STATE SHAPE
// ============================================================================

export type PosStatus =
  | "idle"
  | "building"
  | "locked_waiting_tap"
  | "processing"
  | "success"
  | "error_insufficient_balance"
  | "error_daily_limit"
  | "error_card_blocked";

export interface PosMachineState {
  status: PosStatus;
  cart: CartItem[];
  /** Total berjalan, dihitung ulang setiap ADD/REMOVE/UPDATE_QTY selama status = building */
  subtotal: number;
  /** Total yang dikunci begitu kasir menekan "Kunci & Terima Pembayaran". Tidak berubah walau cart berubah. */
  lockedTotal: number | null;
  /** Data siswa hanya terisi setelah kartu berhasil dibaca (processing/success/error) */
  student: StudentCardInfo | null;
  error: PosErrorInfo | null;
  /** Epoch ms deadline untuk auto-timeout di locked_waiting_tap (dipakai oleh hook, bukan reducer) */
  waitTapDeadline: number | null;
  /** Epoch ms deadline untuk auto-reset di success (dipakai oleh hook) */
  successDeadline: number | null;
  transactionId: string | null;
}

export const WAIT_TAP_TIMEOUT_MS = 20_000; // 20 detik
export const SUCCESS_AUTO_RESET_MS = 3_000; // 3 detik

export const initialPosMachineState: PosMachineState = {
  status: "idle",
  cart: [],
  subtotal: 0,
  lockedTotal: null,
  student: null,
  error: null,
  waitTapDeadline: null,
  successDeadline: null,
  transactionId: null,
};

// ============================================================================
// 3. ACTIONS
// ============================================================================

export type PosAction =
  | { type: "ADD_ITEM"; item: MenuItem }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "UPDATE_QTY"; itemId: string; qty: number }
  | { type: "LOCK_ORDER" }
  | { type: "UNLOCK_ORDER" }
  | { type: "TAP_CARD" }
  | {
      type: "TRANSACTION_SUCCESS";
      transactionId: string;
      student: StudentCardInfo;
    }
  | { type: "TRANSACTION_FAIL"; error: PosErrorInfo }
  | { type: "RESET_TO_IDLE" }
  // Internal actions, di-dispatch oleh timer effect di hook, bukan oleh UI langsung
  | { type: "WAIT_TAP_TIMEOUT" }
  | { type: "SUCCESS_TIMEOUT" };

// ============================================================================
// 4. HELPERS
// ============================================================================

function computeSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function upsertCartItem(cart: CartItem[], menuItem: MenuItem): CartItem[] {
  const existing = cart.find((c) => c.id === menuItem.id);
  if (existing) {
    return cart.map((c) =>
      c.id === menuItem.id ? { ...c, qty: c.qty + 1 } : c
    );
  }
  return [
    ...cart,
    { id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 },
  ];
}

function errorCodeToStatus(code: PosErrorCode): PosStatus {
  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return "error_insufficient_balance";
    case "DAILY_LIMIT_EXCEEDED":
      return "error_daily_limit";
    case "CARD_BLOCKED":
    case "CARD_NOT_RECOGNIZED":
    case "READER_TIMEOUT":
    default:
      return "error_card_blocked";
  }
}

/** Guard: aksi mana yang valid dipanggil dari status apa. Mencegah transisi ilegal
 *  (misal TAP_CARD di-dispatch saat masih status "building"). */
function isTransitionAllowed(from: PosStatus, action: PosAction["type"]): boolean {
  const allowed: Record<PosStatus, PosAction["type"][]> = {
    idle: ["ADD_ITEM"],
    building: [
      "ADD_ITEM",
      "REMOVE_ITEM",
      "UPDATE_QTY",
      "LOCK_ORDER",
    ],
    locked_waiting_tap: ["TAP_CARD", "UNLOCK_ORDER", "WAIT_TAP_TIMEOUT"],
    processing: ["TRANSACTION_SUCCESS", "TRANSACTION_FAIL"],
    success: ["RESET_TO_IDLE", "SUCCESS_TIMEOUT"],
    error_insufficient_balance: ["RESET_TO_IDLE", "UNLOCK_ORDER", "TAP_CARD"],
    error_daily_limit: ["RESET_TO_IDLE", "UNLOCK_ORDER"],
    error_card_blocked: ["RESET_TO_IDLE", "UNLOCK_ORDER", "TAP_CARD"],
  };
  return allowed[from]?.includes(action) ?? false;
}

// ============================================================================
// 5. REDUCER
// ============================================================================

export function posMachineReducer(
  state: PosMachineState,
  action: PosAction
): PosMachineState {
  // Guard transisi ilegal — kembalikan state apa adanya (dev bisa console.warn di sini).
  if (!isTransitionAllowed(state.status, action.type)) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[posMachine] Aksi "${action.type}" tidak valid dari status "${state.status}"`
      );
    }
    return state;
  }

  switch (action.type) {
    case "ADD_ITEM": {
      const cart = upsertCartItem(state.cart, action.item);
      return {
        ...state,
        status: "building",
        cart,
        subtotal: computeSubtotal(cart),
      };
    }

    case "REMOVE_ITEM": {
      const cart = state.cart.filter((c) => c.id !== action.itemId);
      return {
        ...state,
        status: cart.length === 0 ? "idle" : "building",
        cart,
        subtotal: computeSubtotal(cart),
      };
    }

    case "UPDATE_QTY": {
      if (action.qty <= 0) {
        return posMachineReducer(state, {
          type: "REMOVE_ITEM",
          itemId: action.itemId,
        });
      }
      const cart = state.cart.map((c) =>
        c.id === action.itemId ? { ...c, qty: action.qty } : c
      );
      return { ...state, cart, subtotal: computeSubtotal(cart) };
    }

    case "LOCK_ORDER": {
      if (state.cart.length === 0) return state; // tidak boleh lock cart kosong
      return {
        ...state,
        status: "locked_waiting_tap",
        lockedTotal: state.subtotal,
        error: null,
        waitTapDeadline: Date.now() + WAIT_TAP_TIMEOUT_MS,
      };
    }

    case "UNLOCK_ORDER": {
      // Kasir membatalkan kunci pembayaran (mis. siswa mau nambah item lagi)
      return {
        ...state,
        status: state.cart.length > 0 ? "building" : "idle",
        lockedTotal: null,
        student: null,
        error: null,
        waitTapDeadline: null,
      };
    }

    case "TAP_CARD": {
      // Kartu ter-tap -> serahkan ke backend untuk validasi (async, di luar reducer)
      return { ...state, status: "processing", waitTapDeadline: null };
    }

    case "TRANSACTION_SUCCESS": {
      return {
        ...state,
        status: "success",
        student: action.student,
        transactionId: action.transactionId,
        error: null,
        successDeadline: Date.now() + SUCCESS_AUTO_RESET_MS,
      };
    }

    case "TRANSACTION_FAIL": {
      return {
        ...state,
        status: errorCodeToStatus(action.error.code),
        error: action.error,
      };
    }

    case "WAIT_TAP_TIMEOUT": {
      // Tidak ada tap dalam 20 detik -> kembali ke building, reader di-disarm
      return {
        ...state,
        status: "building",
        lockedTotal: null,
        waitTapDeadline: null,
      };
    }

    case "SUCCESS_TIMEOUT":
    case "RESET_TO_IDLE": {
      return { ...initialPosMachineState };
    }

    default:
      return state;
  }
}
