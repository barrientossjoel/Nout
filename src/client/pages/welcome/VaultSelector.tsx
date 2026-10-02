import { FolderOpen } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface VaultSelectorProps {
  path: string;
  onPathChange: (path: string) => void;
  recentPaths: string[];
  onBrowse: () => void;
  title: string;
  desc: string;
  browseLabel: string;
}

export function VaultSelector({
  path,
  onPathChange,
  recentPaths,
  onBrowse,
  title,
  desc,
  browseLabel,
}: VaultSelectorProps) {
  return (
    <div className="py-4 space-y-2.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[#dedcd7]">{title}</h3>
          <p className="text-xs text-[#9e9b94] mt-0.5 leading-relaxed">{desc}</p>
        </div>
        <Button
          id="btn-browse-vault"
          variant="outline"
          size="sm"
          onClick={onBrowse}
          className="rounded-none h-9 px-4 font-medium bg-[#25252b] hover:bg-[#303037] text-[#dedcd7] hover:text-[#f0eee9] border border-[#383840] shrink-0 text-xs flex items-center gap-1.5 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#9e9b94]" />
          {browseLabel}
        </Button>
      </div>

      <Input
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
        placeholder="Ruta a la carpeta del vault..."
        className="font-mono text-xs bg-[#25252b] border-[#383840] text-[#e6e4df] h-9 rounded-none focus-visible:ring-1 focus-visible:ring-[#555560]"
      />

      {recentPaths.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] text-[#85827c] font-mono">Recientes:</span>
          {recentPaths.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPathChange(p)}
              className={`text-[11px] font-mono px-2 py-0.5 rounded-none border transition-colors truncate max-w-[200px] ${
                path === p
                  ? 'bg-[#32323a] border-[#555560] text-[#f0eee9]'
                  : 'bg-[#1e1e22] border-[#2b2b30] text-[#9e9b94] hover:bg-[#28282e] hover:text-[#dedcd7]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
