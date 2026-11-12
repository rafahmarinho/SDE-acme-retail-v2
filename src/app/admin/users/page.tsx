import type { Metadata } from "next";
import { setRoleAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, PageHeader, Pagination } from "@/components/ui";
import { date, dateTime } from "@/lib/format";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import { Page } from "@/lib/schemas";
import { can, requirePagePermission } from "@/services/auth";
import { listUsers } from "@/services/users";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const auth = await requirePagePermission("customers:read", "/admin/users");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const page = Page.parse(sp.page);
  const { items, total, pageSize } = await listUsers(q, page);
  const manage = can(auth, "users:manage");
  return (
    <div>
      <PageHeader title="Users" subtitle={manage ? "Role changes require a sign-in within the last 30 minutes and are audit-logged." : `${total} users`} />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} maxLength={60} placeholder="Name or email" className="input max-w-sm" />
        <button className="btn-secondary" type="submit">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th>Role</th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name || "-"}</td>
                <td>{u.email}</td>
                <td>{date(u.created_at)}</td>
                <td>{dateTime(u.last_sign_in_at)}</td>
                <td>
                  {manage && u.id !== auth.user.id ? (
                    <ActionForm action={setRoleAction} className="flex gap-1">
                      <input type="hidden" name="user_id" value={u.id} />
                      <select name="role" defaultValue={u.role} className="input w-48 py-1" aria-label="Role">
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
                    </ActionForm>
                  ) : (
                    <Badge tone={u.role === "customer" ? "gray" : "green"}>{ROLE_LABELS[u.role]}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
