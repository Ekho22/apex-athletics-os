import { Role } from './roles';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  avatar?: string;
  bio?: string;
  phone?: string;
}

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: Role;
  avatar?: string;
  bio?: string;
  phone?: string;
}
