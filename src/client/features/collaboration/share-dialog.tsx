import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Share2, Link2, Trash2, Check } from 'lucide-react';
import { getDocumentShares, createDocumentShare, deleteDocumentShare } from '../../actions/actions';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { isTauri } from '../../../core/utils/platform';

interface ShareDialogProps {
    elementId: string;
    elementType: 'document' | 'canvas';
    /** Controlled mode — when provided, no trigger button is rendered */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ShareDialog({ elementId, elementType, open: controlledOpen, onOpenChange: controlledOnOpenChange }: ShareDialogProps) {
    const { t } = useLanguage();
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled
        ? (controlledOnOpenChange ?? setInternalOpen)
        : setInternalOpen;
    const [email, setEmail] = useState('');
    const [permission, setPermission] = useState('view');
    const [shares, setShares] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            fetchShares();
        }
    }, [open, elementId]);

    const fetchShares = async () => {
        try {
            const data = await getDocumentShares(elementId);
            setShares(data);
        } catch (error) {
            console.error('Error fetching shares:', error);
        }
    };

    const handleShare = async () => {
        if (!email) return;
        setLoading(true);
        try {
            await createDocumentShare(elementId, { email, permission: permission as 'view' | 'edit' });
            setEmail('');
            fetchShares();
        } catch (error) {
            console.error('Error sharing:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (shareId: string) => {
        try {
            await deleteDocumentShare(shareId);
            fetchShares();
        } catch (error) {
            console.error('Error removing share:', error);
        }
    };

    const getShareUrl = () => {
        if (typeof window === 'undefined') return '';
        const base = isTauri() ? 'https://nout.vercel.app' : window.location.origin;
        return `${base}/${elementId}`;
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(getShareUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 shrink-0 hidden sm:flex">
                        <Share2 className="h-4 w-4" />
                        {t('share')}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('share')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Share Link Section */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">{t('copyLink')}</p>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={getShareUrl()}
                                className="flex-1 bg-muted/50 font-mono text-xs"
                            />
                            <Button variant="secondary" onClick={handleCopyLink} className="gap-2 shrink-0">
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
                                {copied ? t('linkCopied') : t('copyLink')}
                            </Button>
                        </div>
                    </div>

                    <div className="border-t border-border pt-6">
                        <p className="text-sm font-medium mb-3">{t('documentShares')}</p>
                        <p className="text-sm text-muted-foreground mb-4">{t('documentSharesDesc')}</p>
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder={t('emailPlaceholder') as string}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="flex-1"
                                type="email"
                            />
                            <Select value={permission} onValueChange={setPermission}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="view">{t('permissionView')}</SelectItem>
                                    <SelectItem value="edit">{t('permissionEdit')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleShare} disabled={loading || !email}>{t('share')}</Button>
                        </div>

                        {/* List of active shares */}
                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                            {shares.map(share => (
                                <div key={share.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px]">{share.sharedWithEmail.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium truncate max-w-[150px]">{share.sharedWithEmail}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{share.permission}</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemove(share.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
