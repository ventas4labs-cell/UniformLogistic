import React, { useState, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, Upload, Plus, Minus, X } from 'lucide-react';
import { countItemsInImage, fileToGenerativePart } from '../services/geminiService';
import { AICountResult } from '../types';

interface AICounterProps {
  onClose: () => void;
}

const AICounter: React.FC<AICounterProps> = ({ onClose }) => {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<AICountResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
      
      setStep('analyzing');
      try {
        const base64 = await fileToGenerativePart(file);
        const data = await countItemsInImage(base64, file.type);
        
        setResult({
            id: Date.now().toString(),
            imageUrl: preview,
            totalCount: data.totalCount,
            breakdown: data.breakdown || { shirts: 0, pants: 0, other: 0 },
            confidence: data.confidence,
            notes: data.notes
        });
        setStep('result');
      } catch (err) {
        alert("Error al analizar la imagen. Inténtelo de nuevo.");
        setStep('upload');
        setImagePreview(null);
      }
    }
  };

  const handleCorrection = (category: keyof AICountResult['breakdown'], delta: number) => {
      if (!result) return;
      const newVal = Math.max(0, result.breakdown[category] + delta);
      const diff = newVal - result.breakdown[category];
      
      setResult({
          ...result,
          breakdown: {
              ...result.breakdown,
              [category]: newVal
          },
          totalCount: result.totalCount + diff
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      <div className="p-4 border-b flex justify-between items-center bg-gray-900 text-white">
        <h2 className="text-lg font-bold">Contador Inteligente</h2>
        <button onClick={onClose}><X /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        
        {step === 'upload' && (
            <div className="w-full max-w-md mt-10 space-y-6">
                <div className="text-center space-y-2">
                    <p className="text-gray-600">Toma una foto de un grupo de uniformes. Trata de separarlos un poco para mayor precisión.</p>
                </div>

                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-2xl h-64 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                    <Camera size={48} className="text-orange-500 mb-2" />
                    <span className="font-semibold text-gray-600">Tocar para Capturar</span>
                    <span className="text-xs text-gray-400 mt-1">o subir foto</span>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    capture="environment"
                />
            </div>
        )}

        {step === 'analyzing' && (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
                {imagePreview && (
                    <img src={imagePreview} className="w-32 h-32 object-cover rounded-xl mb-6 opacity-50" />
                )}
                <RefreshCw className="animate-spin text-orange-600 mb-4" size={40} />
                <h3 className="text-xl font-bold text-gray-800">Analizando Foto...</h3>
                <p className="text-gray-500 max-w-xs mt-2">Gemini AI está detectando artículos y calculando totales.</p>
            </div>
        )}

        {step === 'result' && result && (
            <div className="w-full max-w-md pb-10">
                <img src={result.imageUrl} className="w-full h-48 object-cover rounded-xl shadow-md mb-6" />
                
                <div className="bg-orange-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-orange-100">
                    <div>
                        <p className="text-sm text-orange-800 font-medium">Total Detectado</p>
                        <p className="text-3xl font-bold text-orange-900">{result.totalCount}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Confianza</p>
                        <div className="flex items-center gap-1">
                            <div className={`h-2 w-2 rounded-full ${result.confidence > 80 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className="font-bold text-gray-700">{result.confidence}%</span>
                        </div>
                    </div>
                </div>

                <h3 className="font-bold text-gray-800 mb-3">Desglose (Toca para corregir)</h3>
                <div className="space-y-3">
                    {Object.entries(result.breakdown).map(([key, count]) => {
                        const label = key === 'shirts' ? 'Camisas' : key === 'pants' ? 'Pantalones' : 'Otros';
                        return (
                            <div key={key} className="flex items-center justify-between bg-white border p-3 rounded-lg shadow-sm">
                                <span className="capitalize font-medium text-gray-700">{label}</span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => handleCorrection(key as any, -1)}
                                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:bg-gray-200"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-6 text-center font-bold">{count}</span>
                                    <button 
                                        onClick={() => handleCorrection(key as any, 1)}
                                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:bg-gray-200"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-xs text-gray-400 mt-4 italic">"{result.notes}"</p>

                <div className="mt-8 flex gap-3">
                    <button 
                        onClick={() => { setStep('upload'); setImagePreview(null); }}
                        className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-600"
                    >
                        Retomar
                    </button>
                    <button 
                         onClick={onClose}
                         className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg"
                    >
                        Listo
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AICounter;