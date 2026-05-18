import { useState, useEffect, useCallback } from 'react';
import { Calculator, X } from 'lucide-react';

export default function CalculadoraFlutuante() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);

  const formatDisplay = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (val.endsWith('.')) return val;
    if (val.includes('.') && val.split('.')[1].length > 8) {
      return parseFloat(num.toFixed(8)).toString();
    }
    return val;
  };

  const inputDigit = useCallback((digit: string) => {
    if (justCalculated) {
      setDisplay(digit);
      setExpression('');
      setJustCalculated(false);
      return;
    }
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(d => d === '0' ? digit : d.length >= 12 ? d : d + digit);
    }
  }, [waitingForNewValue, justCalculated]);

  const inputDot = useCallback(() => {
    if (justCalculated) { setDisplay('0.'); setExpression(''); setJustCalculated(false); return; }
    if (waitingForNewValue) { setDisplay('0.'); setWaitingForNewValue(false); return; }
    setDisplay(d => d.includes('.') ? d : d + '.');
  }, [waitingForNewValue, justCalculated]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
    setJustCalculated(false);
  }, []);

  const backspace = useCallback(() => {
    if (waitingForNewValue || justCalculated) { setDisplay('0'); return; }
    setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0');
  }, [waitingForNewValue, justCalculated]);

  const toggleSign = useCallback(() => {
    setDisplay(d => {
      const n = parseFloat(d);
      if (isNaN(n) || n === 0) return d;
      return String(-n);
    });
  }, []);

  const percentage = useCallback(() => {
    setDisplay(d => {
      const n = parseFloat(d);
      if (isNaN(n)) return d;
      return String(n / 100);
    });
  }, []);

  const opSymbol = (op: string) => ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[op] ?? op);

  const performOperation = useCallback((nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue == null) {
      setPrevValue(inputValue);
      setExpression(`${display} ${opSymbol(nextOperator)}`);
    } else if (operator && !waitingForNewValue) {
      let newValue = prevValue;
      if (operator === '+') newValue = prevValue + inputValue;
      else if (operator === '-') newValue = prevValue - inputValue;
      else if (operator === '*') newValue = prevValue * inputValue;
      else if (operator === '/') newValue = inputValue !== 0 ? prevValue / inputValue : 0;

      const result = parseFloat(newValue.toFixed(8));
      setPrevValue(result);
      setDisplay(String(result));
      setExpression(`${result} ${opSymbol(nextOperator)}`);
    } else {
      setExpression(`${display} ${opSymbol(nextOperator)}`);
    }

    setWaitingForNewValue(true);
    setOperator(nextOperator);
    setJustCalculated(false);
  }, [display, prevValue, operator, waitingForNewValue]);

  const calculate = useCallback(() => {
    if (!operator || waitingForNewValue) return;
    const inputValue = parseFloat(display);
    const current = prevValue ?? 0;
    let result = current;

    if (operator === '+') result = current + inputValue;
    else if (operator === '-') result = current - inputValue;
    else if (operator === '*') result = current * inputValue;
    else if (operator === '/') result = inputValue !== 0 ? current / inputValue : 0;

    const rounded = parseFloat(result.toFixed(8));
    setExpression(`${current} ${opSymbol(operator)} ${display} =`);
    setDisplay(String(rounded));
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
    setJustCalculated(true);
  }, [display, prevValue, operator, waitingForNewValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const { key } = e;
      if (/\d/.test(key)) { e.preventDefault(); inputDigit(key); }
      else if (key === '.' || key === ',') { e.preventDefault(); inputDot(); }
      else if (['+', '-', '*', '/'].includes(key)) { e.preventDefault(); performOperation(key); }
      else if (key === 'Enter' || key === '=') { e.preventDefault(); calculate(); }
      else if (key === 'Escape') { e.preventDefault(); clearAll(); }
      else if (key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (key === '%') { e.preventDefault(); percentage(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inputDigit, inputDot, performOperation, calculate, clearAll, backspace, percentage]);

  const Btn = ({
    label, onClick, variant = 'num', wide = false, tall = false
  }: {
    label: React.ReactNode; onClick: () => void;
    variant?: 'num' | 'op' | 'special' | 'eq';
    wide?: boolean; tall?: boolean;
  }) => {
    const base = 'flex items-center justify-center rounded-2xl font-semibold text-xl select-none cursor-pointer transition-all duration-100 active:scale-95 active:brightness-75';
    const colors = {
      num:     'bg-gray-600 hover:bg-gray-500 text-white shadow-md',
      op:      'bg-orange-500 hover:bg-orange-400 text-white shadow-md',
      special: 'bg-gray-400 hover:bg-gray-300 text-gray-900 shadow-md',
      eq:      'bg-orange-500 hover:bg-orange-400 text-white shadow-md',
    };
    return (
      <button
        onClick={onClick}
        className={`${base} ${colors[variant]} ${wide ? 'col-span-2' : ''} ${tall ? 'row-span-2' : ''} h-14`}
      >
        {label}
      </button>
    );
  };

  const displayFontSize = display.length > 10 ? 'text-3xl' : display.length > 7 ? 'text-4xl' : 'text-5xl';

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="w-72 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
          style={{ background: 'rgba(28,28,30,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 pt-4 pb-1">
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
              <Calculator size={12} /> Calculadora
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700"
            >
              <X size={14} />
            </button>
          </div>

          {/* Display */}
          <div className="px-5 pt-2 pb-4 text-right">
            <p className="text-gray-500 text-sm font-mono h-5 truncate">{expression || ' '}</p>
            <p className={`${displayFontSize} font-light text-white font-mono tracking-tight mt-1 truncate`}>
              {formatDisplay(display)}
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-4 gap-2 px-3 pb-4">
            <Btn label={display === '0' && !operator ? 'AC' : 'C'} onClick={clearAll} variant="special" />
            <Btn label="+/−" onClick={toggleSign} variant="special" />
            <Btn label="%" onClick={percentage} variant="special" />
            <Btn label="÷" onClick={() => performOperation('/')} variant={operator === '/' && waitingForNewValue ? 'num' : 'op'} />

            <Btn label="7" onClick={() => inputDigit('7')} />
            <Btn label="8" onClick={() => inputDigit('8')} />
            <Btn label="9" onClick={() => inputDigit('9')} />
            <Btn label="×" onClick={() => performOperation('*')} variant={operator === '*' && waitingForNewValue ? 'num' : 'op'} />

            <Btn label="4" onClick={() => inputDigit('4')} />
            <Btn label="5" onClick={() => inputDigit('5')} />
            <Btn label="6" onClick={() => inputDigit('6')} />
            <Btn label="−" onClick={() => performOperation('-')} variant={operator === '-' && waitingForNewValue ? 'num' : 'op'} />

            <Btn label="1" onClick={() => inputDigit('1')} />
            <Btn label="2" onClick={() => inputDigit('2')} />
            <Btn label="3" onClick={() => inputDigit('3')} />
            <Btn label="+" onClick={() => performOperation('+')} variant={operator === '+' && waitingForNewValue ? 'num' : 'op'} />

            <Btn label="0" onClick={() => inputDigit('0')} wide />
            <Btn label="," onClick={inputDot} />
            <Btn label="=" onClick={calculate} variant="eq" />
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-orange-500 text-white rotate-0'
            : 'bg-gray-900 text-white border border-gray-700 hover:bg-gray-800'
        }`}
        title="Calculadora"
      >
        <Calculator size={22} />
      </button>
    </div>
  );
}
