// src/utils/user-role.ts
// User role management utilities

export type UserRole = 'patient' | 'provider' | 'admin';

export interface UserWithRole {
  user_id: string;
  user_role: UserRole;
  profile_data?: any;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get user role from database
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    const response = await fetch('/api/user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user role');
    }

    const data = await response.json();
    return data.role || 'patient';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

/**
 * Update user role in database
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    const response = await fetch('/api/user-role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, role }),
    });

    if (!response.ok) {
      throw new Error('Failed to update user role');
    }

    return true;
  } catch (error) {
    console.error('Error updating user role:', error);
    return false;
  }
}

/**
 * Check if user is a provider
 */
export function isProvider(role: UserRole | null): boolean {
  return role === 'provider';
}

/**
 * Check if user is a patient
 */
export function isPatient(role: UserRole | null): boolean {
  return role === 'patient';
}

/**
 * Check if user is an admin
 */
export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

/**
 * Get dashboard path based on user role
 */
export function getDashboardPath(role: UserRole | null): string {
  switch (role) {
    case 'provider':
      return '/dashboard/provider';
    case 'admin':
      return '/dashboard/admin';
    case 'patient':
    default:
      return '/dashboard/patient';
  }
}