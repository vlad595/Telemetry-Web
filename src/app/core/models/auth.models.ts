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
  telegramChatId: string;
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

export interface WorkspaceMember {
  userId: string;
  userName: string;
  userRole: number;
}

export interface Workspace {
  id: string;
  workspaceName: string;
  members: WorkspaceMember[] | null;
  ownerId: string;
}

export interface CreateWorkspaceRequest {
  workspaceName: string;
}

export enum WorkspaceRole {
  Admin = 0,
  Manager = 1,
  Reader = 2,
}

export interface CreateWorkspaceInviteRequest {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceInvite {
  workspaceId: string;
  inviteCode: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdById: string;
}

export interface CreateWorkspaceInstanceRequest extends CreateInstanceRequest {
  workspaceId: string;
}
