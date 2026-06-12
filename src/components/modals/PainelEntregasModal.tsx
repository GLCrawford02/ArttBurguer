import { X, Truck, Store, Package, MapPin, CheckCircle, Flame, Pencil } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  entregasAbertas: Record<string, any>;
  vendasPdv: any[];
  pedidosCozinha: any[];
  onAbrirEntrega: (id: string) => void;
  onReabrirEntrega: (venda: any) => void;
  onFinalizarEntrega: (vendaId: string, isAberta?: boolean) => void;
  getInicioDiaComercial: () => number;
  onVerVenda: (venda: any) => void;
}

export default function PainelEntregasModal({
  show, onClose, entregasAbertas, vendasPdv, pedidosCozinha,
  onAbrirEntrega, onReabrirEntrega, onFinalizarEntrega, getInicioDiaComercial, onVerVenda
}: Props) {
  if (!show) return null;

  const colEditando = Object.entries(entregasAbertas).map(([id, val]: any) => ({ id, ...val, isAberta: true })).filter(e => !e.statusEntrega || e.statusEntrega === 'Pendente');
  const colAguardando = vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Pendente');
  const colEmRota = [
    ...Object.entries(entregasAbertas).map(([id, val]: any) => ({ id, ...val, isAberta: true })).filter(e => e.statusEntrega === 'Em Rota'),
    ...vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Em Rota')
  ];
  const colEntregues = vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Concluída' && v.timestamp >= getInicioDiaComercial());

  return (
    <div className="fixed inset-0 bg-gray-100 z-[100] flex flex-col animate-in slide-in-from-bottom-4 duration-300 p-2 sm:p-4">
      <div className="bg-white p-4 rounded-t-xl border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0">
        <h2 className="text-lg sm:text-xl font-black text-gray-800 flex items-center"><Truck className="mr-2 text-blue-600" size={24}/> Painel Geral de Entregas</h2>
        <button onClick={onClose} className="bg-gray-200 text-gray-600 hover:bg-gray-300 p-2 rounded-full transition-colors"><X size={20}/></button>
      </div>
      <div className="flex-1 bg-gray-100 overflow-y-auto rounded-b-xl pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 h-full p-2 sm:p-4">

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
            <div className="bg-orange-50 p-4 border-b border-orange-100 shrink-0">
              <h3 className="font-bold text-orange-800 flex items-center"><Store className="mr-2" size={18}/> Em Aberto / Editando ({colEditando.length})</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {colEditando.length > 0 ? colEditando.map((entrega: any) => {
                const total = (Object.values(entrega.carrinho || {}) as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) as number;
                return (
                  <button key={entrega.id} onClick={() => { onClose(); onAbrirEntrega(entrega.id); }} className="w-full text-left p-3 rounded-xl border border-orange-200 bg-white hover:bg-orange-50 transition-colors shadow-sm group">
                    <div className="flex justify-between items-start">
                      <div className="overflow-hidden pr-2">
                        <span className="font-bold text-sm text-gray-800 block truncate">
                          #{entrega.numeroDiario || '?'} - {entrega.clienteNome} {entrega.isRetirada && <span className="text-orange-600 ml-1 text-[11px] uppercase">(Retirada)</span>}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-1 block truncate">{entrega.clienteTelefone}</span>
                      </div>
                      <span className="text-sm font-black text-orange-600 shrink-0">R$ {total.toFixed(2)}</span>
                    </div>
                    {entrega.statusEntrega === 'Concluída' && <div className="mt-2 text-left"><span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold inline-block">Entregue (Aguardando Pagamento)</span></div>}
                  </button>
                );
              }) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido em aberto.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
            <div className="bg-blue-50 p-4 border-b border-blue-100 shrink-0">
              <h3 className="font-bold text-blue-800 flex items-center"><Package className="mr-2" size={18}/> Aguardando Despacho ({colAguardando.length})</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {colAguardando.length > 0 ? colAguardando.sort((a: any, b: any) => b.timestamp - a.timestamp).map((v: any) => (
                <div key={v.id} className="p-3 rounded-xl border border-blue-200 bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="overflow-hidden pr-2">
                      <span className="font-bold text-sm text-gray-800 block truncate">
                        #{v.numeroDiario || '?'} - {v.clienteNome} {v.isRetirada && <span className="text-orange-600 ml-1 text-[11px] uppercase">(Retirada)</span>}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-1 block truncate">Finalizado às {new Date(v.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <span className="text-sm font-black text-blue-600 shrink-0">R$ {v.valor.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const pedido = pedidosCozinha.find(p => p.identificador === `Delivery #${v.numeroDiario} - ${v.clienteNome}` && Math.abs(p.timestamp - v.timestamp) < 120000);
                    if (!pedido) return <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold mt-2 inline-block">Sem envio à cozinha</span>;
                    return pedido.status === 'Pendente'
                      ? <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold flex items-center w-fit mt-2"><Flame size={10} className="mr-1"/> Preparando (Cozinha)</span>
                      : <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold flex items-center w-fit mt-2"><CheckCircle size={10} className="mr-1"/> Pronto (Aguardando Motoboy)</span>;
                  })()}
                  <button onClick={() => onReabrirEntrega(v)} className="mt-3 w-full bg-blue-50 text-blue-700 py-1.5 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors border border-blue-200 flex justify-center items-center">
                    <Pencil size={12} className="mr-1" /> Reabrir para Editar
                  </button>
                </div>
              )) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido aguardando despacho.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
            <div className="bg-green-50 p-4 border-b border-green-100 shrink-0">
              <h3 className="font-bold text-green-800 flex items-center"><MapPin className="mr-2" size={18}/> Em Rota de Entrega ({colEmRota.length})</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {colEmRota.length > 0 ? colEmRota.sort((a: any, b: any) => b.timestamp - a.timestamp).map((v: any) => (
                <div key={v.id} className="p-3 rounded-xl border border-green-200 bg-white shadow-sm flex flex-col">
                  <div className="flex justify-between items-start">
                    <div className="overflow-hidden pr-2">
                      <span className="font-bold text-sm text-gray-800 block truncate">#{v.numeroDiario || '?'} - {v.clienteNome}</span>
                      <span className="text-[10px] text-green-600 mt-1 font-bold block truncate">Saiu p/ entrega</span>
                    </div>
                    <span className="text-sm font-black text-green-600 shrink-0">
                      R$ {v.isAberta ? (Object.values(v.carrinho || {}) as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0).toFixed(2) : v.valor.toFixed(2)}
                    </span>
                  </div>
                  {v.isAberta && <div className="mt-2 text-left"><span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold inline-block">Aberto (Não pago)</span></div>}
                  <button onClick={() => onFinalizarEntrega(v.id, v.isAberta)} className="mt-3 w-full bg-green-50 text-green-700 py-1.5 rounded text-[10px] font-bold hover:bg-green-100 transition-colors border border-green-200 flex justify-center items-center">
                    <CheckCircle size={12} className="mr-1" /> Finalizar Entrega
                  </button>
                </div>
              )) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido em rota.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
            <div className="bg-gray-100 p-4 border-b border-gray-200 shrink-0">
              <h3 className="font-bold text-gray-800 flex items-center"><CheckCircle className="mr-2 text-gray-500" size={18}/> Entregues Hoje ({colEntregues.length})</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {colEntregues.sort((a: any, b: any) => b.timestamp - a.timestamp).map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => onVerVenda(v)}
                    className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-200 shadow-sm flex flex-col items-center justify-center transition-colors"
                    title={`Cliente: ${v.clienteNome}\nValor: R$ ${v.valor.toFixed(2)}\nEntregue às: ${new Date(v.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`}
                  >
                    <span className="font-black text-gray-800 text-lg">#{v.numeroDiario || '?'}</span>
                  </button>
                ))}
              </div>
              {colEntregues.length === 0 && <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido entregue hoje.</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
