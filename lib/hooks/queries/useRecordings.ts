import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { RecordingItem, PaginatedRecordings } from "@/lib/recordings/types";
import { queryKeys } from "@/lib/query/keys";

const PAGE_SIZE = 10;

export function useRecordingsByTagInfiniteQuery(
  tagId: string | null,
  enabled: boolean = true
) {
  const isUnclassified = tagId === null;
  const tagParam = isUnclassified ? "unclassified" : tagId;

  return useInfiniteQuery<PaginatedRecordings>({
    queryKey: queryKeys.recordings.byTag(tagId),
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `/api/recordings?tagId=${encodeURIComponent(
          tagParam as string
        )}&page=${pageParam}&limit=${PAGE_SIZE}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load recordings.");
      }
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled,
  });
}

export interface UpdateRecordingInput {
  id: string;
  title?: string;
  text?: string;
  tagId?: string | null;
}

export function useUpdateRecordingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateRecordingInput) => {
      const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update recording.");
      }
      return data.recording;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.detail(variables.id),
      });
    },
  });
}

export function useDeleteRecordingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete recording.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

export function useClassifyRecordingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/recordings/${encodeURIComponent(id)}/classify`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.title) {
        throw new Error(data.error || "Failed to classify note.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}
