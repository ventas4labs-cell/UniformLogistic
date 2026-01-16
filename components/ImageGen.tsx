import React, { useState } from 'react';
import { AspectRatio } from '../types';
import { generateUniformConcept } from '../services/geminiService';
import { Wand2, Image as ImageIcon, X } from 'lucide-react';

interface ImageGenProps {
    onClose: () => void;
}

const ImageGen: React.FC<ImageGenProps> = ({ onClose }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [loading, setLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const ratios: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

    const handleGenerate = async () => {
        if (!prompt) return;
        setLoading(true);
        setGeneratedImage(null);
        try {
            const imgData = await generateUniformConcept(prompt + " high quality uniform design concept, professional lighting", aspectRatio);
            setGeneratedImage(imgData);
        } catch (e) {
            alert("Falló la generación. Inténtelo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-900 text-white">
                <div className="flex items-center gap-2">
                    <Wand2 size={20} className="text-orange-400" />
                    <h2 className="text-lg font-bold">Estudio de Diseño</h2>
                </div>
                <button onClick={onClose}><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Describe tu concepto</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ej: Uniforme de guardia futurista, acentos azul neón, chaleco táctico..."
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Relación de Aspecto</label>
                        <div className="grid grid-cols-4 gap-2">
                            {ratios.map(r => (
                                <button
                                    key={r}
                                    onClick={() => setAspectRatio(r)}
                                    className={`py-2 px-1 text-xs rounded-lg border font-medium ${
                                        aspectRatio === r 
                                        ? 'bg-orange-600 text-white border-orange-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !prompt}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                            loading || !prompt 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-600 text-white shadow-lg hover:bg-orange-700'
                        }`}
                    >
                        {loading ? 'Generando...' : <><Wand2 size={18} /> Generar Concepto</>}
                    </button>
                </div>

                <div className="mt-8">
                    {loading && (
                        <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-300">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="h-10 w-10 bg-gray-200 rounded-full mb-2"></div>
                                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    )}
                    
                    {generatedImage && (
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800">Resultado</h3>
                            <img src={generatedImage} alt="Generated Concept" className="w-full rounded-xl shadow-lg border border-gray-100" />
                            <a 
                                href={generatedImage} 
                                download={`uniform-concept-${Date.now()}.png`}
                                className="block text-center py-2 text-orange-600 font-medium hover:text-orange-700"
                            >
                                Descargar Imagen
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageGen;