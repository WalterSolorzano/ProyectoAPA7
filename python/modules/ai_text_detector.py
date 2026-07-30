import re
import math
from typing import List, Dict, Any

class AITextDetector:
    def __init__(self, strictness_threshold: int = 40):
        self.strictness_threshold = strictness_threshold
        
        # Conectores y transiciones formales (Ingeniería Inversa)
        self.phrases_start = [
            "en conclusión", "en resumen", "para concluir", "como hemos visto",
            "cabe destacar que", "es importante señalar", "resulta fundamental",
            "vale la pena mencionar", "en definitiva", "de esta manera",
            "en primer lugar", "por lo tanto", "sin embargo", "además",
            "en consecuencia", "por consiguiente", "en este sentido"
        ]
        
        self.phrases_intro = [
            "en la sociedad actual", "en el contexto actual", "a lo largo de la historia",
            "el impacto de", "en el marco de", "es innegable que"
        ]
        
        # Jerga algorítmica expandida (Ingeniería Inversa)
        self.vocab = [
            "aprovechar", "impulsar", "profundizar", "abordar", "dinámica", "reto", "clave",
            "sin duda", "claramente", "evidentemente", "en efecto", "crucial", "multifacético",
            "intrínseco", "empoderar", "sinergia", "apalancar", "paisaje", "imperativo", "tapiz"
        ]

    def _clean_text(self, text: str) -> str:
        return text.lower().strip()

    def analyze_paragraph(self, text: str, has_shading_residue: bool = False) -> Dict[str, Any]:
        text_lower = self._clean_text(text)
        if not text_lower:
            return {"score": 0, "is_ai_generated": False, "matches": [], "length": 0}
            
        matches = []
        score = 0
        
        # 1. Puntuación Monótona (Falta de respiración)
        if len(text.split()) > 30:
            human_punct = sum(text.count(p) for p in ["-", "...", "!", "?"])
            if human_punct == 0:
                matches.append("puntuación aséptica (ausencia de signos humanos)")
                score += 15
        
        # Check starts (Conectores al inicio)
        for p in self.phrases_start:
            if text_lower.startswith(p):
                matches.append(p)
                score += 20
                break
                
        # Check intros
        for p in self.phrases_intro:
            if p in text_lower:
                matches.append(p)
                score += 15
                
        # Check vocab (Jerga IA)
        vocab_matches = 0
        for v in self.vocab:
            if re.search(r'\b' + re.escape(v) + r'\b', text_lower):
                matches.append(v)
                vocab_matches += 1
                
        score += min(30, vocab_matches * 10)
        
        # Residuos de Formato (Modo Oscuro ChatGPT)
        if has_shading_residue:
            score += 50
            matches.append("residuos de formato web (sombreado sospechoso)")
        
        final_score = min(100, score)
        
        return {
            "score": final_score,
            "is_ai_generated": final_score >= self.strictness_threshold,
            "matches": matches,
            "length": len(text.split())
        }
        
    def analyze_document(
        self, 
        paragraphs: List[str], 
        forensic_metadata: Dict[str, Any] = None,
        paragraph_shading: List[bool] = None
    ) -> List[Dict[str, Any]]:
        
        if paragraph_shading is None:
            paragraph_shading = [False] * len(paragraphs)
            
        results = []
        lengths = []
        
        # Análisis base por párrafo
        for i, p in enumerate(paragraphs):
            has_shading = paragraph_shading[i] if i < len(paragraph_shading) else False
            res = self.analyze_paragraph(p, has_shading)
            lengths.append(res["length"])
            results.append(res)
            
        # 2. Varianza de Longitud de Oraciones (Homogeneidad Sintáctica)
        if len(lengths) > 2:
            valid_lengths = [l for l in lengths if l > 5]
            if len(valid_lengths) > 5:
                mean = sum(valid_lengths) / len(valid_lengths)
                variance = sum((l - mean) ** 2 for l in valid_lengths) / len(valid_lengths)
                std_dev = math.sqrt(variance)
                
                # Si la desviación estándar es muy baja, es demasiado uniforme (IA)
                if std_dev < (mean * 0.15):  # Menos del 15% de varianza
                    for r in results:
                        if r["length"] > 10:
                            r["score"] = min(100, r["score"] + 25)
                            r["is_ai_generated"] = r["score"] >= self.strictness_threshold
                            if "varianza sintáctica robótica" not in r["matches"]:
                                r["matches"].append("varianza sintáctica robótica (desviación < 15%)")

        # 3. Metadatos Forenses (Tiempo vs. Volumen)
        if forensic_metadata:
            total_time = forensic_metadata.get("total_editing_time_minutes", 0)
            words = forensic_metadata.get("words", 0)
            rev_count = forensic_metadata.get("revision_count", 0)
            
            if total_time > 0 and words > 500:
                wpm = words / total_time
                if wpm > 80:  # Imposible tipeo humano constante (80+ WPM en un documento académico largo)
                    for r in results:
                        r["score"] = min(100, r["score"] + 40)
                        r["is_ai_generated"] = r["score"] >= self.strictness_threshold
                        if "velocidad de tipeo sobrehumana" not in r["matches"]:
                            r["matches"].append(f"velocidad de tipeo sobrehumana ({wpm:.0f} WPM detectado en metadatos)")

        return results

_detector = AITextDetector(strictness_threshold=40)

def get_ai_text_detector(strictness_threshold: int = 40) -> AITextDetector:
    if _detector.strictness_threshold != strictness_threshold:
        return AITextDetector(strictness_threshold)
    return _detector
