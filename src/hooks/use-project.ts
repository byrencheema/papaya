import { useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";

export function useProject() {
  const store = useProjectStore();

  useEffect(() => {
    if (!store.project && !store.loading) {
      store.fetchProject();
    }
  }, [store.project, store.loading]);

  return store;
}
