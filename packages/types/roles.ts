export type Role = 'admin' | 'coach' | 'athlete' | 'viewer';

export interface RolePermissions {
  canManageUsers: boolean;
  canViewDashboard: boolean;
  canEditProfile: boolean;
  canAccessJobBoard: boolean;
  canManageBilling: boolean;
}

export const rolePermissions: Record<Role, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canViewDashboard: true,
    canEditProfile: true,
    canAccessJobBoard: true,
    canManageBilling: true,
  },
  coach: {
    canManageUsers: false,
    canViewDashboard: true,
    canEditProfile: true,
    canAccessJobBoard: true,
    canManageBilling: false,
  },
  athlete: {
    canManageUsers: false,
    canViewDashboard: true,
    canEditProfile: true,
    canAccessJobBoard: false,
    canManageBilling: false,
  },
  viewer: {
    canManageUsers: false,
    canViewDashboard: true,
    canEditProfile: false,
    canAccessJobBoard: false,
    canManageBilling: false,
  },
};
