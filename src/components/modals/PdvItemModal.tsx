import { X } from 'lucide-react';

interface PdvItemOptions {
  montagem: string[];
  pontoCarne: string;
  adicionais: Record<string, number>;
  restricoes: string[];
  observacao: string;
  quantidade: number;
  bebidas?: Record<string, number>;
  tamanho?: string;
}

interface Props {
  produto: any | null;
  onClose: () => void;
  options: PdvItemOptions;
  setOptions: (updater: any) => void;
  onAdicionar: () => void;
  produtos: any[];
}

export default function PdvItemModal({ produto, onClose, options, setOptions, onAdicionar, produtos }: Props) {
  if (!produto) return null;

  const selectedTamanho = (produto.opcoes?.tamanhos || []).find((t: any) => t.nome === options.tamanho);
  const basePrice = selectedTamanho ? Number(selectedTamanho.preco) : (Number(produto.precoVenda) || 0);
  const totalAdicional = Object.entries(options.adicionais).reduce((acc, [id, qtd]: [string, any]) =>
    acc + (Number((produto.opcoes?.adicionais || []).find((a: any) => a.id === id)?.preco) || 0) * qtd, 0
  );
  const precoTotal = (basePrice + totalAdicional) * options.quantidade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
          <h3 className="font-black text-xl text-gray-800">{produto.nome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {produto.opcoes?.tamanhos && produto.opcoes.tamanhos.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Tamanho</h4></div>
              <div className="flex flex-wrap gap-2">
                {produto.opcoes.tamanhos.map((t: any) => (
                  <button key={t.id} onClick={() => setOptions((prev: any) => ({...prev, tamanho: t.nome}))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${options.tamanho === t.nome ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {t.nome} (R$ {Number(t.preco).toFixed(2)})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Tipo de Montagem</h4></div>
            <div className="flex flex-wrap gap-2">
              {(produto.opcoes?.tiposMontagem || []).map((t: any) => (
                <button key={t.id} onClick={() => setOptions((prev: any) => ({ ...prev, montagem: prev.montagem.includes(t.nome) ? [] : [t.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${options.montagem.includes(t.nome) ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t.nome}</button>
              ))}
              {(produto.opcoes?.tiposMontagem || []).length === 0 && <span className="text-xs text-gray-400">Nenhum tipo de montagem configurado.</span>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Ponto da Carne</h4></div>
            <div className="flex flex-wrap gap-2">
              {(produto.opcoes?.pontosCarne || []).map((p: any) => (
                <button key={p.id} onClick={() => setOptions({...options, pontoCarne: options.pontoCarne === p.nome ? '' : p.nome})} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${options.pontoCarne === p.nome ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{p.nome}</button>
              ))}
              {(produto.opcoes?.pontosCarne || []).length === 0 && <span className="text-xs text-gray-400">Nenhum ponto de carne configurado.</span>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Adicionais</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(produto.opcoes?.adicionais || []).map((a: any) => {
                const qtd = options.adicionais[a.id] || 0;
                return (
                  <div key={a.id} className="flex justify-between items-center p-2 border rounded-lg bg-gray-50">
                    <div>
                      <span className="font-medium text-sm text-gray-800">{a.nome}</span>
                      {a.preco > 0 && <span className="block text-xs text-green-600 font-bold">+ R$ {a.preco.toFixed(2)}</span>}
                    </div>
                    <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border shadow-sm">
                      <button onClick={() => setOptions((prev: any) => { const n = {...prev.adicionais}; if (qtd <= 1) delete n[a.id]; else n[a.id] = qtd - 1; return {...prev, adicionais: n}; })} className="text-gray-500 hover:text-red-500 px-2">-</button>
                      <span className="text-sm font-bold w-4 text-center">{qtd}</span>
                      <button onClick={() => setOptions((prev: any) => ({...prev, adicionais: {...prev.adicionais, [a.id]: qtd + 1}}))} className="text-gray-500 hover:text-green-500 px-2">+</button>
                    </div>
                  </div>
                );
              })}
              {(produto.opcoes?.adicionais || []).length === 0 && <span className="text-xs text-gray-400">Nenhum adicional configurado.</span>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Restrições (Sem)</h4></div>
            <div className="flex flex-wrap gap-2">
              {(produto.opcoes?.restricoesLivres || []).map((r: any) => (
                <button key={r.id} onClick={() => setOptions((prev: any) => ({ ...prev, restricoes: prev.restricoes.includes(r.nome) ? prev.restricoes.filter((n: any) => n !== r.nome) : [...prev.restricoes, r.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${options.restricoes.includes(r.nome) ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{r.nome}</button>
              ))}
              {(produto.opcoes?.restricoesLivres || []).length === 0 && <span className="text-xs text-gray-400">Nenhuma restrição configurada.</span>}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Observação Especial</h4>
            <textarea value={options.observacao} onChange={e => setOptions({...options, observacao: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm bg-gray-50 focus:bg-white" rows={2} placeholder="Ex: Embalar separado..."></textarea>
          </div>

          {options.montagem.some((m: string) => m.toLowerCase().includes('levar com pedido')) && (() => {
            const bebidaProdutos = produtos.filter((p: any) => (p.categoria || '').toLowerCase() === 'bebidas');
            if (bebidaProdutos.length === 0) return null;
            return (
              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs flex items-center gap-1.5">Bebidas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bebidaProdutos.map((bev: any) => {
                    const qtd = options.bebidas?.[bev.id] || 0;
                    return (
                      <div key={bev.id} className="flex justify-between items-center p-2 border rounded-lg bg-blue-50 border-blue-200">
                        <div>
                          <span className="font-medium text-sm text-gray-800">{bev.nome}</span>
                          {Number(bev.precoVenda) > 0 && <span className="block text-xs text-green-600 font-bold">+ R$ {Number(bev.precoVenda).toFixed(2)}</span>}
                        </div>
                        <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border shadow-sm">
                          <button onClick={() => setOptions((prev: any) => { const n = {...(prev.bebidas||{})}; if (qtd <= 1) delete n[bev.id]; else n[bev.id] = qtd - 1; return {...prev, bebidas: n}; })} className="text-gray-500 hover:text-red-500 px-2">-</button>
                          <span className="text-sm font-bold w-4 text-center">{qtd}</span>
                          <button onClick={() => setOptions((prev: any) => ({...prev, bebidas: {...(prev.bebidas||{}), [bev.id]: qtd + 1}}))} className="text-gray-500 hover:text-green-500 px-2">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>

        <div className="p-4 border-t bg-gray-100 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-4 bg-white p-2 rounded-lg border shadow-sm w-full sm:w-auto justify-center">
            <button onClick={() => setOptions({...options, quantidade: Math.max(1, options.quantidade - 1)})} className="px-4 py-1 text-gray-500 hover:text-red-500 font-bold text-lg">-</button>
            <span className="font-black text-lg">{options.quantidade}</span>
            <button onClick={() => setOptions({...options, quantidade: options.quantidade + 1})} className="px-4 py-1 text-gray-500 hover:text-green-500 font-bold text-lg">+</button>
          </div>
          <button onClick={onAdicionar} className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center shadow-md text-lg">
            Adicionar <span className="ml-3 bg-green-700 px-2.5 py-1.5 rounded-md text-sm">R$ {precoTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
