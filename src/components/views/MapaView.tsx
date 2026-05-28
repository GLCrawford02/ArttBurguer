import { Store, Truck, Map, Plus, Printer } from 'lucide-react';

interface Props {
  isCaixaOrAdmin: boolean;
  canDelivery: boolean;
  entregasAbertas: Record<string, any>;
  mesasAbertas: Record<string, any>;
  qtdMesas: number;
  onAbrirEntrega: (id: string) => void;
  onAbrirMesa: (num: number) => void;
  getMesaIdentificador: (num: number | null, nome?: string | null) => string;
  onReimprimirEntrega: (e: React.MouseEvent, id: string, entrega: any) => void;
  onReimprimirMesa: (e: React.MouseEvent, num: number, mesa: any) => void;
  onAbrirPainelEntregas: () => void;
  onAddMesa: () => void;
  onAbrirBalcao: () => void;
  onAbrirDelivery: () => void;
}

export default function MapaView({
  isCaixaOrAdmin, canDelivery, entregasAbertas, mesasAbertas, qtdMesas,
  onAbrirEntrega, onAbrirMesa, getMesaIdentificador,
  onReimprimirEntrega, onReimprimirMesa,
  onAbrirPainelEntregas, onAddMesa, onAbrirBalcao, onAbrirDelivery
}: Props) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in duration-300 min-h-[600px]">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center"><Store className="mr-2 text-green-600"/> Controle de Mesas e Pedidos</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full xl:w-auto">
          {isCaixaOrAdmin && (
            <button onClick={onAbrirBalcao} className="flex-1 bg-gray-800 text-white px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
              <Store size={18} className="mr-2 shrink-0" /> Venda Balcão
            </button>
          )}
          {canDelivery && (
            <button onClick={onAbrirDelivery} className="flex-1 bg-green-600 text-white px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
              <Truck size={18} className="mr-2 shrink-0" /> Novo Delivery
            </button>
          )}
          {canDelivery && (
            <button onClick={onAbrirPainelEntregas} className="flex-1 bg-blue-100 text-blue-700 px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-blue-200 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
              <Map size={18} className="mr-2 shrink-0" /> Painel de Entregas
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {canDelivery && (
          <div>
            <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Truck className="mr-2 text-orange-500" size={20}/> Entregas em Aberto</h4>
            {Object.keys(entregasAbertas).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Object.entries(entregasAbertas).map(([id, entrega]: any) => {
                  const total = (Object.values(entrega.carrinho || {}) as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) as number;
                  return (
                    <div key={id} className="relative">
                      <button onClick={() => onAbrirEntrega(id)} className="w-full p-3 sm:p-4 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-700 shadow-sm flex flex-col justify-center items-start transition-all hover:bg-orange-100">
                        <span className="font-bold text-sm truncate w-full text-left pr-8">{entrega.clienteNome}</span>
                        <span className="text-[10px] text-orange-600 mt-1">{entrega.clienteTelefone}</span>
                        <span className="text-sm font-black mt-2">R$ {total.toFixed(2)}</span>
                        {entrega.statusEntrega === 'Em Rota' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold mt-2 inline-block">Em Rota</span>}
                        {entrega.statusEntrega === 'Concluída' && <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold mt-2 inline-block">Entregue (Aguardando Pgto)</span>}
                      </button>
                      <button onClick={(e) => onReimprimirEntrega(e, id, entrega)} className="absolute top-1 sm:top-2 right-1 sm:right-2 p-1 sm:p-1.5 bg-orange-200 hover:bg-orange-300 text-orange-800 rounded-md transition-colors shadow-sm" title="Reimprimir Comanda">
                        <Printer size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Nenhum delivery em aberto no momento.</p>
            )}
          </div>
        )}

        <div>
          <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Store className="mr-2 text-green-500" size={20}/> Mesas</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
            {Array.from({length: qtdMesas}).map((_, i) => {
              const num = i + 1;
              const isAberta = mesasAbertas[`mesa_${num}`] || mesasAbertas[num];
              const total = isAberta ? ((Object.values(isAberta.carrinho || {}) as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) as number) : 0;
              return (
                <div key={num} onClick={() => onAbrirMesa(num)} title={isAberta ? getMesaIdentificador(num, isAberta.nomeCliente) : `Mesa ${num}`} className={`relative p-2 sm:p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all h-20 sm:h-24 cursor-pointer ${isAberta ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm hover:bg-orange-100' : 'bg-white border-gray-200 text-gray-400 hover:border-green-500 hover:text-green-600 hover:bg-green-50'}`}>
                  {isAberta ? (
                    <span className="text-xs sm:text-sm font-black leading-tight pointer-events-none text-center line-clamp-2 px-1">
                      {getMesaIdentificador(num, isAberta.nomeCliente)}
                    </span>
                  ) : (
                    <span className="text-xl sm:text-2xl font-black leading-none pointer-events-none">{num}</span>
                  )}
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold mt-0.5 sm:mt-1 pointer-events-none">{isAberta ? `R$ ${total.toFixed(2)}` : 'Livre'}</span>
                  {isAberta && (
                    <button onClick={(e) => onReimprimirMesa(e, num, isAberta)} className="absolute top-1 sm:top-2 right-1 sm:right-2 p-1 sm:p-1.5 bg-orange-200 hover:bg-orange-300 text-orange-800 rounded-md transition-colors shadow-sm" title="Imprimir Pedido Parcial">
                      <Printer size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <button onClick={onAddMesa} className="p-2 sm:p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 hover:bg-gray-50 flex flex-col items-center justify-center transition-all h-20 sm:h-24">
              <Plus size={20} className="sm:w-6 sm:h-6" />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold mt-1 sm:mt-2">Adicionar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
