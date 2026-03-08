import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

interface Permission {
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function usePermission(page: string): Permission {
  const { profile, permissions } = useAuth();

  return useMemo(() => {
    if (profile?.role === "admin") {
      return { canRead: true, canEdit: true, canDelete: true };
    }

    const perm = permissions.find((p) => p.page === page);
    if (!perm) {
      return { canRead: false, canEdit: false, canDelete: false };
    }

    return {
      canRead: perm.can_read,
      canEdit: perm.can_edit,
      canDelete: perm.can_delete,
    };
  }, [profile, permissions, page]);
}
