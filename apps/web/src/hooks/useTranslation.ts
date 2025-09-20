import { useMemo } from "react";
import { translations } from "../data/translations";
import useEditorStore from "../state/useEditorStore";

export function useTranslation() {
  const language = useEditorStore((state) => state.language);
  return useMemo(() => translations[language], [language]);
}
