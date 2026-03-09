import { Star } from "lucide-react";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { useClusterStore } from "@/stores/clusterStore";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/types/k8s";

interface FavoriteButtonProps {
  resourceType: ResourceType;
  resourceName: string;
}

export function FavoriteButton({ resourceType, resourceName }: FavoriteButtonProps) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const favorites = useFavoritesStore((s) => s.favorites);

  if (!activeContext) return null;

  const pinned = isFavorite(resourceType, resourceName, activeContext);
  const favEntry = favorites.find(
    (f) => f.resourceType === resourceType && f.name === resourceName && f.context === activeContext,
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinned && favEntry) {
      removeFavorite(favEntry.id);
    } else {
      addFavorite({
        resourceType,
        name: resourceName,
        namespace: activeNamespace ?? "",
        context: activeContext,
        label: `${resourceType}/${resourceName}`,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "rounded p-1 transition-colors",
        pinned
          ? "text-yellow-400 hover:text-yellow-300"
          : "text-muted-foreground hover:text-foreground",
      )}
      title={pinned ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={cn("h-4 w-4", pinned && "fill-current")} />
    </button>
  );
}
