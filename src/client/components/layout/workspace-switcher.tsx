import { Plus, MoreHorizontal, Trash2, Edit2, Layers, Settings as SettingsIcon, LogOut, Folder } from 'lucide-react';
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { WorkspaceRecord } from "../../../core/types/notes";
import { useState, useRef, useEffect } from 'react';
import { cn } from "../../lib/utils/utils";
import { useAuth } from "../../context/AuthContext";

interface WorkspaceSwitcherProps {
    workspaces: WorkspaceRecord[];
    activeWorkspaceId: string;
    onSwitch: (id: string) => void;
    onCreate: (name: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onOpenSettings?: () => void;
}

export function WorkspaceSwitcher({
    workspaces,
    activeWorkspaceId,
    onSwitch,
    onCreate,
    onRename,
    onDelete,
    onOpenSettings
}: WorkspaceSwitcherProps) {
    const { user, logout } = useAuth();
    const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId) || workspaces[0];
    const [editingId, setEditingId] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const editRefs = useRef<Record<string, HTMLSpanElement | null>>({});
    const pendingEditRef = useRef(false);

    // Focus & select content when entering edit mode
    useEffect(() => {
        if (editingId) {
            const el = editRefs.current[editingId];
            if (el) {
                el.focus();
                // select all text
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
            }
        }
    }, [editingId]);

    // After creating, auto-enter edit mode for the new workspace
    useEffect(() => {
        if (pendingEditRef.current) {
            pendingEditRef.current = false;
            setEditingId(activeWorkspaceId);
        }
    }, [activeWorkspaceId]);

    const handleCreateWithEdit = () => {
        const defaultName = `Workspace ${workspaces.length + 1}`;
        pendingEditRef.current = true;
        setOpen(false);
        onCreate(defaultName);
    };

    const commitRename = (id: string) => {
        const el = editRefs.current[id];
        if (!el) return;
        const newName = el.textContent?.trim() || '';
        const original = workspaces.find(ws => ws.id === id)?.name || '';
        if (newName && newName !== original) {
            onRename(id, newName);
        } else if (!newName) {
            // restore original if emptied
            el.textContent = original;
        }
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (workspaces.length <= 1) return;
        onDelete(id);
    };

    return (
        <div className="px-3 py-2 border-t border-border/40 flex items-center gap-1">
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex-1 justify-start gap-2 h-9 px-2 hover:bg-muted/50 group">
                        <div className="h-5 w-5 rounded-md text-primary flex items-center justify-center shrink-0">
                            <Layers className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate flex-1 text-left text-sm font-medium">
                            {activeWorkspace?.name}
                        </span>
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[220px]">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider px-2 py-1.5">
                        Workspaces
                    </DropdownMenuLabel>
                    {workspaces.map((ws) => (
                        <div key={ws.id} className="flex items-center group/item px-1 py-0.5">
                            {/* Colored avatar */}
                            <div
                                className={cn(
                                    "h-4 w-4 rounded flex items-center justify-center shrink-0 text-[10px] uppercase font-bold mr-2",
                                    ws.id === activeWorkspaceId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}
                            >
                                {ws.name[0]}
                            </div>

                            {/* Editable name */}
                            <span
                                ref={el => { editRefs.current[ws.id] = el; }}
                                contentEditable={editingId === ws.id}
                                suppressContentEditableWarning
                                className={cn(
                                    "flex-1 text-sm truncate outline-none cursor-pointer select-none rounded px-0.5",
                                    editingId === ws.id
                                        ? "bg-muted/60 cursor-text select-text ring-1 ring-border"
                                        : ws.id === activeWorkspaceId && "text-accent-foreground font-medium"
                                )}
                                onClick={() => {
                                    if (editingId !== ws.id) {
                                        onSwitch(ws.id);
                                        setOpen(false);
                                    }
                                }}
                                onDoubleClick={() => {
                                    setEditingId(ws.id);
                                }}
                                onBlur={() => commitRename(ws.id)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitRename(ws.id);
                                    }
                                    if (e.key === 'Escape') {
                                        // restore and exit
                                        const el = editRefs.current[ws.id];
                                        if (el) el.textContent = ws.name;
                                        setEditingId(null);
                                    }
                                }}
                            >
                                {ws.name}
                            </span>

                            {/* Rename icon */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 shrink-0 ml-0.5"
                                title="Rename"
                                onClick={e => {
                                    e.stopPropagation();
                                    setEditingId(ws.id);
                                }}
                            >
                                <Edit2 className="h-3 w-3" />
                            </Button>

                            {/* Delete icon */}
                            {workspaces.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 shrink-0 text-destructive hover:text-destructive"
                                    title="Delete"
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleDelete(ws.id);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCreateWithEdit} className="gap-2 px-2 py-1.5 cursor-pointer">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">New Workspace</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                        onClick={() => {
                            window.history.pushState({}, '', '/welcome');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                        }} 
                        className="gap-2 px-2 py-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                    >
                        <Folder className="h-4 w-4" />
                        <span>Abrir pantalla de inicio</span>
                    </DropdownMenuItem>
                    {user && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 flex flex-col gap-1 items-start">
                                <span className="text-xs text-muted-foreground font-medium truncate w-full">{user.name}</span>
                                <span className="text-[10px] text-muted-foreground/70 truncate w-full">{user.email}</span>
                            </div>
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    logout();
                                }}
                                className="gap-2 px-2 py-1.5 cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="text-sm">Log out</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground flex shrink-0"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenSettings?.();
                }}
                title="Settings"
            >
                <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
