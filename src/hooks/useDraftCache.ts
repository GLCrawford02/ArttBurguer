export const draftKey = (formName: string, userId?: string) => {
  return `arttburger_draft_${formName}_${userId || 'anon'}`;
};

export const loadDraft = <T,>(formName: string, userId?: string): T | null => {
  try {
    const key = draftKey(formName, userId);
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Erro ao ler rascunho:', error);
    return null;
  }
};

export const saveDraft = (formName: string, userId: string | undefined, data: any) => {
  try {
    const key = draftKey(formName, userId);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Erro ao salvar rascunho:', error);
  }
};

export const clearDraft = (formName: string, userId?: string) => {
  try {
    const key = draftKey(formName, userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao limpar rascunho:', error);
  }
};

export const clearAllDrafts = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arttburger_draft_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Erro ao limpar todos os rascunhos:', error);
  }
};