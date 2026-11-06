export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  userName: string;
}

export interface UserContext {
  id: string;
  userName: string;
  email: string;
  subscriptionLevel: number;
}

export interface AuthResponse extends UserContext {
  token: string;
}

export interface Instance {
  id: string;
  name: string;
  ownerId: string;
  workspaceId: string | null;
}

export interface CreateInstanceRequest {
  id: string;
  name: string;
}
