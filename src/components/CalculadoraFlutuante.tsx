import { useState, useEffect } from 'react';
import { Calculator, X, Delete } from 'lucide-react';

export default function CalculadoraFlutuante() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  
  const inputDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };
  
  const clearEntry = () => {
    setDisplay('0');
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue == null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const currentValue = prevValue || 0;
      let newValue = currentValue;

      if (operator === '+') newValue = currentValue + inputValue;
      else if (operator === '-') newValue = currentValue - inputValue;
      else if (operator === '*') newValue = currentValue * inputValue;
      else if (operator === '/') newValue = currentValue / inputValue;

      setPrevValue(newValue);
      setDisplay(String(newValue));
    }

    setWaitingForNewValue(true);
    setOperator(nextOperator);
  };

  const calculate = () => {
    if (operator && !waitingForNewValue) {
      performOperation('=');
      setOperator(null);
      setPrevValue(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const { key } = e;
      if (/\d/.test(key)) {
        e.preventDefault();
        inputDigit(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        inputDot();
      } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        e.preventDefault();
        performOperation(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
      } else if (key === 'Escape') {
        e.preventDefault();
        clearAll();
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        clearEntry();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, prevValue, operator, waitingForNewValue]);

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col items-end">
      {isOpen ? (
        <div className="bg-gray-800 text-white p-4 rounded-2xl shadow-2xl w-64 mb-4 animate-in slide-in-from-bottom-4 flex flex-col border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-300 text-sm flex items-center"><Calculator size={14} className="mr-1"/> Calculadora</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors bg-gray-700 hover:bg-gray-600 rounded-full p-1"><X size={18}/></button>
          </div>
          <div className="bg-gray-900 p-3 rounded-xl mb-4 text-right overflow-hidden break-all shadow-inner border border-gray-700">
            <span className="text-3xl font-mono tracking-tight">{display}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button onClick={clearAll} className="p-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold transition-colors">C</button>
            <button onClick={clearEntry} className="p-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold flex justify-center items-center transition-colors"><Delete size={18}/></button>
            <button onClick={() => performOperation('/')} className={`p-3 rounded-lg font-bold transition-colors ${operator === '/' ? 'bg-indigo-400 text-gray-900' : 'bg-indigo-600 hover:bg-indigo-500'}`}>÷</button>
            <button onClick={() => performOperation('*')} className={`p-3 rounded-lg font-bold transition-colors ${operator === '*' ? 'bg-indigo-400 text-gray-900' : 'bg-indigo-600 hover:bg-indigo-500'}`}>×</button>

            <button onClick={() => inputDigit('7')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">7</button>
            <button onClick={() => inputDigit('8')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">8</button>
            <button onClick={() => inputDigit('9')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">9</button>
            <button onClick={() => performOperation('-')} className={`p-3 rounded-lg font-bold transition-colors ${operator === '-' ? 'bg-indigo-400 text-gray-900' : 'bg-indigo-600 hover:bg-indigo-500'}`}>-</button>

            <button onClick={() => inputDigit('4')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">4</button>
            <button onClick={() => inputDigit('5')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">5</button>
            <button onClick={() => inputDigit('6')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">6</button>
            <button onClick={() => performOperation('+')} className={`p-3 rounded-lg font-bold transition-colors ${operator === '+' ? 'bg-indigo-400 text-gray-900' : 'bg-indigo-600 hover:bg-indigo-500'}`}>+</button>

            <button onClick={() => inputDigit('1')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">1</button>
            <button onClick={() => inputDigit('2')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">2</button>
            <button onClick={() => inputDigit('3')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">3</button>
            <button onClick={calculate} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold row-span-2 transition-colors">=</button>

            <button onClick={() => inputDigit('0')} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold col-span-2 transition-colors">0</button>
            <button onClick={inputDot} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">.</button>
          </div>
        </div>
      ) : null}

      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center border-2 border-white" title="Abrir Calculadora">
          <Calculator size={24} />
        </button>
      )}
    </div>
  );
}