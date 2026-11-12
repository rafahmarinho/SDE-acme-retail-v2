/**
 * Maps database/service errors to safe, user-facing messages (T2139: no stack traces or SQL).
 * Unknown errors are logged server-side with a reference id; the user only sees the reference.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  REAUTH_REQUIRED: "For your security, please sign in again to confirm this action.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  TOO_MANY_OPEN_CHECKOUTS: "You have too many checkouts in progress. Complete or cancel one first.",
  OUT_OF_STOCK: "Some items in your cart are no longer available in the requested quantity.",
  EMPTY_CART: "Your cart is empty.",
  CART_TOO_LARGE: "Your cart has too many lines.",
  INVALID_QUANTITY: "Please enter a valid quantity.",
  INVALID_COUPON: "That coupon can't be applied to this order.",
  INVALID_ADDRESS: "Please check the shipping address.",
  INVALID_SHIPPING_METHOD: "Please choose a shipping method.",
  INVALID_PROVIDER: "Payment method unavailable.",
  INVALID_SCENARIO: "Please choose a payment option.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_NOT_PAYABLE: "This order can no longer be paid. The reservation may have expired.",
  WRONG_PROVIDER: "This order uses a different payment method.",
  ORDER_NOT_CANCELLABLE: "This order can't be cancelled anymore.",
  ORDER_NOT_SHIPPABLE: "Only paid orders that are being processed can be shipped.",
  ORDER_NOT_DELIVERABLE: "Only shipped orders can be marked as delivered.",
  ORDER_NOT_RETURNABLE: "Only delivered orders can be returned.",
  RETURN_WINDOW_CLOSED: "The 30-day return window for this order has closed.",
  RETURN_QTY_EXCEEDED: "You selected more items than can be returned.",
  INVALID_RETURN_ITEMS: "Please select the items to return.",
  RETURN_NOT_REVIEWABLE: "This return was already reviewed.",
  RETURN_NOT_RECEIVABLE: "Only approved returns can be received.",
  RETURN_NOT_REFUNDABLE: "Only received returns can be refunded.",
  ORDER_NOT_REFUNDABLE: "This order can't be refunded.",
  INVALID_REFUND_AMOUNT: "The refund amount must be greater than zero and no more than the amount left to refund.",
  INVALID_REASON: "Please enter a reason (3-300 characters).",
  INVALID_NOTE: "The note is too long.",
  INVALID_CARRIER: "Please choose a carrier.",
  INVALID_TRACKING_NUMBER: "Tracking numbers have 8-30 letters or digits.",
  INVALID_STOCK_LEVEL: "Stock can't go below the quantity currently reserved by checkouts.",
  UNKNOWN_VARIANT: "Unknown product variant.",
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  USER_NOT_FOUND: "User not found.",
  INVALID_STEPS: "Choose between 1 and 20 steps.",
  SIMULATION_DISABLED: "The simulation area is disabled in this environment.",
  INVALID_FILE: "Upload a JPEG, PNG or WebP image up to 2 MB.",
  "duplicate key": "That value is already in use.",
};

export function errorCode(err: unknown): string | undefined {
  const msg =
    typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  return Object.keys(MESSAGES).find((k) => msg.includes(k));
}

export function userMessage(err: unknown): string {
  const code = errorCode(err);
  if (code) return MESSAGES[code];
  const ref = Math.floor(Date.now() / 1000).toString(36);
  console.error(`[acme] unexpected error ref=${ref}`, err);
  return `Something went wrong. Please try again. (ref ${ref})`;
}

export function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: userMessage(err) };
}

export class AppError extends Error {
  constructor(public code: keyof typeof MESSAGES & string) {
    super(code);
  }
}
