export const queryKeys = {
  tags: {
    all: ["tags"] as const,
    list: () => [...queryKeys.tags.all, "list"] as const,
    detail: (id: string) => [...queryKeys.tags.all, "detail", id] as const,
  },
  recordings: {
    all: ["recordings"] as const,
    list: () => [...queryKeys.recordings.all, "list"] as const,
    byTag: (tagId: string | null) =>
      [...queryKeys.recordings.all, "byTag", tagId ?? "unclassified"] as const,
    detail: (id: string) => [...queryKeys.recordings.all, "detail", id] as const,
  },
};
