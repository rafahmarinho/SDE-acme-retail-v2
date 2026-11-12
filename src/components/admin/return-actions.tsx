import { issueRefundAction, reviewReturnAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

/** Contextual actions for a return, shown only to roles that may perform them. */
export function ReturnActions({
  ret,
  orderId,
  remaining,
  canManage,
  canRefund,
}: {
  ret: { id: string; status: string; amount_suggested: number };
  orderId: string;
  remaining: number;
  canManage: boolean;
  canRefund: boolean;
}) {
  if (ret.status === "requested" && canManage) {
    return (
      <ActionForm action={reviewReturnAction} className="flex flex-wrap items-center gap-1">
        <input type="hidden" name="return_id" value={ret.id} />
        <input name="note" maxLength={500} placeholder="Note to customer (optional)" className="input w-48 py-1" />
        <SubmitButton className="btn-primary btn-sm" name="decision" value="approve">Approve</SubmitButton>
        <SubmitButton className="btn-danger btn-sm" name="decision" value="reject">Reject</SubmitButton>
      </ActionForm>
    );
  }
  if (ret.status === "approved" && canManage) {
    return (
      <ActionForm action={reviewReturnAction}>
        <input type="hidden" name="return_id" value={ret.id} />
        <SubmitButton className="btn-secondary btn-sm" name="decision" value="receive">Mark received & restock</SubmitButton>
      </ActionForm>
    );
  }
  if (ret.status === "received" && canRefund && remaining > 0) {
    return (
      <ActionForm action={issueRefundAction} className="flex flex-wrap items-center gap-1">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="return_id" value={ret.id} />
        <input type="hidden" name="reason" value="Return received" />
        <input name="amount" type="number" step="0.01" min={0.01} max={remaining} defaultValue={Math.min(ret.amount_suggested, remaining).toFixed(2)} className="input w-28 py-1" aria-label="Refund amount" />
        <SubmitButton className="btn-primary btn-sm">Refund return</SubmitButton>
      </ActionForm>
    );
  }
  return null;
}
