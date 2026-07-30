from collections import defaultdict
import re
from typing import List, Dict, Tuple
from models import ElementModel, ElementType

class StyleFingerprint:
    """Huella de estilo que agrupa párrafos con formato idéntico."""
    def __init__(self, is_bold: bool, is_italic: bool, alignment: str, 
                 font_size_bucket: str, has_indent: bool, ends_with_period: bool, 
                 word_count_bucket: str):
        self.is_bold = is_bold
        self.is_italic = is_italic
        self.alignment = alignment or "left"
        self.font_size_bucket = font_size_bucket
        self.has_indent = has_indent
        self.ends_with_period = ends_with_period
        self.word_count_bucket = word_count_bucket

    def fingerprint_key(self) -> str:
        return (f"{self.is_bold}|{self.is_italic}|{self.alignment}|"
                f"{self.font_size_bucket}|{self.has_indent}|"
                f"{self.ends_with_period}|{self.word_count_bucket}")

def compute_fingerprint(elem: ElementModel, median_font_size: float) -> StyleFingerprint:
    """Calcula la huella de estilo de un elemento."""
    font_size = elem.font_size or 12.0
    
    if font_size > median_font_size + 1.5:
        font_size_bucket = "large"
    elif font_size < median_font_size - 1.5:
        font_size_bucket = "small"
    else:
        font_size_bucket = "medium"
        
    has_indent = (elem.left_indent_cm or 0) >= 0.5
    
    txt = (elem.text or "").strip()
    ends_with_period = bool(txt) and txt.endswith(".")
    
    words = len(txt.split())
    if words <= 12:
        word_count_bucket = "short"
    elif 13 <= words <= 25:
        word_count_bucket = "medium"
    else:
        word_count_bucket = "long"
        
    return StyleFingerprint(
        is_bold=elem.is_bold,
        is_italic=elem.is_italic,
        alignment=elem.alignment,
        font_size_bucket=font_size_bucket,
        has_indent=has_indent,
        ends_with_period=ends_with_period,
        word_count_bucket=word_count_bucket
    )

def is_heading_candidate(elem: ElementModel) -> bool:
    """Determina si un elemento es candidato a ser un título."""
    if elem.is_cover_section or elem.type in (ElementType.IMAGE, ElementType.TABLE, ElementType.EMPTY):
        return False
    if not elem.text or not elem.text.strip():
        return False
    # No considerar párrafos muy largos como candidatos a título a menos que tengan formato especial
    words = len(elem.text.split())
    if words > 40:
        return False
    # Si tiene formato resaltado, es candidato
    if elem.is_bold or (elem.alignment == "center") or (elem.font_size or 0) > 13:
        return True
    
    # Si tiene un estilo heading, obvio es candidato
    style_lower = (elem.style_name or "").lower()
    if "heading" in style_lower or "título" in style_lower or "titulo" in style_lower:
        return True
        
    # Numeración explícita
    if re.match(r"^(?:(?:\d+\.){1,4}\d*|[A-Z]\.)\s+", elem.text):
        return True
        
    return False

def apply_heading_clustering(elements: List[ElementModel], median_font_size: float):
    """
    Agrupa párrafos por huella de estilo y asigna niveles jerárquicos a cada cluster.
    Modifica 'elements' in-place.
    """
    candidates = [e for e in elements if is_heading_candidate(e)]
    if not candidates:
        return
        
    fingerprints = {e.id: compute_fingerprint(e, median_font_size) for e in candidates}
    
    clusters: Dict[str, List[ElementModel]] = defaultdict(list)
    for e in candidates:
        # Si ya fue clasificado con confianza máxima (ej. Estilo Nativo), lo ignoramos para el cluster
        if e.confidence == 0.99 and e.type == ElementType.HEADING:
            continue
        key = fingerprints[e.id].fingerprint_key()
        clusters[key].append(e)
        
    significant_clusters = {k: v for k, v in clusters.items() if len(v) >= 2 or v[0].alignment == "center"}
    
    # Ordenar clusters para asignar niveles
    def cluster_score(key: str, elems: List[ElementModel]) -> tuple:
        fp = fingerprints[elems[0].id]
        
        # 1. Numeración explícita en el texto del cluster
        has_numbering = any(re.match(r"^(?:\d+\.){1,4}\d*\s+", e.text) for e in elems)
        num_segments = 0
        if has_numbering:
            first_match = re.search(r"^((?:\d+\.){1,4}\d*)", elems[0].text)
            if first_match:
                num_segments = len(first_match.group(1).strip(".").split("."))
                
        # 2. Sangría
        indent_score = 1 if fp.has_indent else 0
        
        # 3. Alineación
        align_score = 0 if fp.alignment == "center" else 1
        
        # 4. Tamaño de fuente (GDocs no exporta pStyle, solo tamaño)
        font_score = 0 if fp.font_size_bucket == "large" else (1 if fp.font_size_bucket == "medium" else 2)
        
        # 5. Frecuencia
        freq = len(elems)
        
        # Queremos ordenar de Nivel 1 a Nivel 5 (menor a mayor índice)
        return (
            num_segments if has_numbering else 99, 
            indent_score,
            align_score,
            font_score,
            fp.word_count_bucket != "short", # Preferir cortos
            -freq if fp.alignment == "center" or fp.font_size_bucket == "large" else freq
        )
        
    sorted_clusters = sorted(significant_clusters.items(), key=lambda x: cluster_score(x[0], x[1]))
    
    current_level = 1
    for key, elems in sorted_clusters:
        fp = fingerprints[elems[0].id]
        
        # Reglas base para niveles
        target_level = current_level
        if fp.font_size_bucket == "large" and fp.is_bold and fp.word_count_bucket != "long":
            target_level = 1
        elif fp.alignment == "center" and fp.is_bold:
            target_level = 1
        elif fp.alignment in ("left", "justify") and fp.is_bold and not fp.has_indent:
            target_level = 2 if current_level <= 2 else current_level
        elif fp.has_indent and fp.is_bold and fp.ends_with_period:
            target_level = max(4, current_level)
            
        for e in elems:
            e.type = ElementType.HEADING
            e.heading_level = min(target_level, 5)
            e.confidence = 0.85
            e.needs_review = e.confidence < 0.90
            e.pre_classifier_rule = "cluster"
            
        if target_level == current_level:
            current_level += 1
