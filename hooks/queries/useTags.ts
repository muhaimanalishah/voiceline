import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TagWithCount } from "@/lib/recordings/types";
import { queryKeys } from "@/hooks/queries/keys";

export interface TagsResponse {
  tags: TagWithCount[];
  unclassifiedCount: number;
}

export function useTagsQuery() {
  return useQuery<TagsResponse>({
    queryKey: queryKeys.tags.list(),
    queryFn: async () => {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch tags.");
      }
      return {
        tags: data.tags || [],
        unclassifiedCount: data.unclassifiedCount || 0,
      };
    },
  });
}

export interface CreateTagInput {
  name: string;
  description: string;
  color?: string | null;
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create tag.");
      }
      return data.tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

export interface UpdateTagInput {
  id: string;
  name: string;
  description: string;
  color?: string | null;
}

export function useUpdateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTagInput) => {
      const res = await fetch(`/api/tags/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update tag.");
      }
      return data.tag;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.byTag(variables.id),
      });
    },
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tags/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete tag.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}
