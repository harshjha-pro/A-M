// Who sees Workspaces, the Vault, outfits, menu, contacts and the event timeline — the app side
// of api/src/Auth/WorkspaceAccess.php. 1.0.21 (owner: "visible to all for now"): everyone sees
// them; owner, partner and family (edit rights) change them. Set to false for admins only again.
export const WORKSPACE_OPEN_TO_ALL = true;

export function canSeeWorkspace(permissions) {
  return WORKSPACE_OPEN_TO_ALL ? Boolean(permissions) : Boolean(permissions?.admin);
}

export function canEditWorkspace(permissions) {
  return WORKSPACE_OPEN_TO_ALL ? Boolean(permissions?.edit) : Boolean(permissions?.admin);
}
